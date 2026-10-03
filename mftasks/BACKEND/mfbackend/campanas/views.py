from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from usuarios.permissions import (
    EsAdministrador,
    IsAuthenticatedActivo,
    es_administrador,
    es_cliente,
)

from .models import Campana, SubCampana, PermisoCampana
from .serializers import CampanaSerializer, SubCampanaSerializer, PermisoCampanaSerializer


def _serializar_subcampana(sub):
    return {
        "id": sub.id,
        "campana": sub.campana_id,
        "campana_nombre": sub.campana.nombre,
        "nombre": sub.nombre,
        "codigo": sub.codigo,
        "activo": sub.activo,
    }


class CampanaViewSet(ModelViewSet):
    queryset = Campana.objects.all().prefetch_related("subcampanas")
    serializer_class = CampanaSerializer
    permission_classes = [IsAuthenticatedActivo]

    def get_permissions(self):
        perms = super().get_permissions()
        if self.action in ("create", "update", "partial_update", "destroy"):
            perms += [EsAdministrador()]
        return perms

    @action(detail=False, methods=["get"], url_path="mis-permisos")
    def mis_permisos(self, request):
        """Campañas y subcampañas permitidas del usuario autenticado.

        - Admin: todas las campañas/subcampañas activas (acceso total).
        - Resto: derivado de sus PermisoCampana (subcampaña puntual o campaña
          completa). Se excluyen campañas/subcampañas inactivas.
        """
        user = request.user
        agrupadas = {}

        def _entrada(campana):
            return agrupadas.setdefault(
                campana.id,
                {
                    "id": campana.id,
                    "nombre": campana.nombre,
                    "codigo": campana.codigo,
                    "activo": campana.activo,
                    "_subcampanas": {},
                },
            )

        def _agregar_subcampana(campana, sub):
            entrada = _entrada(campana)
            entrada["_subcampanas"][sub.id] = _serializar_subcampana(sub)

        if es_administrador(user):
            for campana in Campana.objects.filter(activo=True).prefetch_related("subcampanas"):
                for sub in campana.subcampanas.all():
                    if sub.activo:
                        _agregar_subcampana(campana, sub)
        else:
            permisos = (
                PermisoCampana.objects
                .filter(usuario=user)
                .select_related("campana", "subcampana", "subcampana__campana")
            )
            for permiso in permisos:
                sub = permiso.subcampana
                if sub is not None:
                    if not sub.activo or not sub.campana.activo:
                        continue
                    _agregar_subcampana(sub.campana, sub)
                    continue
                campana = permiso.campana
                if campana is None or not campana.activo:
                    continue
                for sub_campana in campana.subcampanas.filter(activo=True):
                    _agregar_subcampana(campana, sub_campana)

        resultado = []
        for entrada in agrupadas.values():
            subcampanas = list(entrada.pop("_subcampanas").values())
            subcampanas.sort(key=lambda s: s["nombre"].lower())
            entrada["subcampanas"] = subcampanas
            resultado.append(entrada)
        resultado.sort(key=lambda c: c["nombre"].lower())
        return Response(resultado)

    def get_queryset(self):
        user = self.request.user
        qs = Campana.objects.all().prefetch_related("subcampanas")
        if not user or not user.is_authenticated:
            return Campana.objects.none()
        if es_administrador(user):
            return qs
        # cliente ve solo campañas activas donde tiene permiso puntual a subcampana activa
        if es_cliente(user):
            campana_ids = PermisoCampana.objects.filter(usuario=user, subcampana__isnull=False, subcampana__activo=True, subcampana__campana__activo=True).values_list("subcampana__campana_id", flat=True)
            campana_ids = set(campana_ids)
            if campana_ids:
                return qs.filter(id__in=campana_ids, activo=True)
            return qs.none()
        # miembro/lider/otro: ve todas activas
        return qs.filter(activo=True)


class SubCampanaViewSet(ModelViewSet):
    queryset = SubCampana.objects.all().select_related("campana")
    serializer_class = SubCampanaSerializer
    permission_classes = [IsAuthenticatedActivo]

    def get_permissions(self):
        perms = super().get_permissions()
        if self.action in ("create", "update", "partial_update", "destroy"):
            perms += [EsAdministrador()]
        return perms

    def get_queryset(self):
        user = self.request.user
        qs = SubCampana.objects.all().select_related("campana")
        campana_id = self.request.query_params.get("campana_id") or self.request.query_params.get("campana")
        if campana_id:
            qs = qs.filter(campana_id=campana_id)
        if not user or not user.is_authenticated:
            return SubCampana.objects.none()
        if user.roles.filter(rol__nombre__iexact="Administrador").exists():
            return qs
        if user.roles.filter(rol__nombre__iexact="CLIENTE").exists():
            # permiso puntual solo a subcampana activa y campaña activa
            permisos_sub = PermisoCampana.objects.filter(usuario=user, subcampana__isnull=False, subcampana__activo=True, subcampana__campana__activo=True).values_list("subcampana_id", flat=True)
            return qs.filter(id__in=permisos_sub, activo=True, campana__activo=True)
        return qs.filter(activo=True, campana__activo=True)


class PermisoCampanaViewSet(ModelViewSet):
    queryset = PermisoCampana.objects.all().select_related("usuario", "campana", "subcampana")
    serializer_class = PermisoCampanaSerializer
    permission_classes = [IsAuthenticatedActivo, EsAdministrador]

    def get_queryset(self):
        qs = super().get_queryset()
        usuario_id = self.request.query_params.get("usuario") or self.request.query_params.get("usuario_id")
        subcampana_id = self.request.query_params.get("subcampana") or self.request.query_params.get("subcampana_id")
        campana_id = self.request.query_params.get("campana") or self.request.query_params.get("campana_id")
        if usuario_id:
            try:
                qs = qs.filter(usuario_id=int(usuario_id))
            except (TypeError, ValueError):
                pass
        if subcampana_id:
            try:
                qs = qs.filter(subcampana_id=int(subcampana_id))
            except (TypeError, ValueError):
                pass
        if campana_id:
            try:
                qs = qs.filter(campana_id=int(campana_id))
            except (TypeError, ValueError):
                pass
        return qs

