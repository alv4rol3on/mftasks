from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from usuarios.permissions import (
    EsAdministrador,
    IsAuthenticatedActivo,
    es_administrador,
)
from usuarios.models import Equipo, EquipoMiembro

from .models import Campana, SubCampana, PermisoCampana
from .serializers import CampanaSerializer, SubCampanaSerializer, PermisoCampanaSerializer
from .services import (
    eliminar_campana,
    eliminar_subcampana,
    restaurar_campana,
    restaurar_subcampana,
)


def _incluir_eliminados(request):
    valor = str(request.query_params.get("incluir_eliminados", "")).lower()
    return valor in ("1", "true", "yes", "si")


def _serializar_subcampana(sub):
    return {
        "id": sub.id,
        "entidad": sub.campana.entidad_id,
        "entidad_nombre": sub.campana.entidad.nombre,
        "campana": sub.campana_id,
        "campana_nombre": sub.campana.nombre,
        "nombre": sub.nombre,
        "codigo": sub.codigo,
        "activo": sub.activo,
    }


class CampanaViewSet(ModelViewSet):
    queryset = Campana.objects.all().select_related("entidad").prefetch_related("subcampanas")
    serializer_class = CampanaSerializer
    permission_classes = [IsAuthenticatedActivo]

    def get_permissions(self):
        perms = super().get_permissions()
        if self.action in (
            "create",
            "update",
            "partial_update",
            "destroy",
            "restaurar",
        ):
            perms += [EsAdministrador()]
        return perms

    def destroy(self, request, *args, **kwargs):
        campana = self.get_object()
        resultado = eliminar_campana(campana, request.user)
        return Response(resultado, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="restaurar")
    def restaurar(self, request, pk=None):
        campana = self.get_object()
        if not campana.eliminado:
            return Response(
                {"detail": "La campaña no está eliminada."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        resultado = restaurar_campana(campana)
        codigo = (
            status.HTTP_200_OK
            if resultado["restaurados"]
            else status.HTTP_400_BAD_REQUEST
        )
        return Response(resultado, status=codigo)

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
                    "entidad": campana.entidad_id,
                    "entidad_nombre": campana.entidad.nombre,
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
            for campana in (
                Campana.objects.filter(
                    activo=True,
                    eliminado=False,
                    entidad__activo=True,
                    entidad__eliminado=False,
                )
                .select_related("entidad")
                .prefetch_related("subcampanas")
            ):
                for sub in campana.subcampanas.all():
                    if sub.activo and not sub.eliminado:
                        _agregar_subcampana(campana, sub)
        else:
            # Permisos propios + los del líder de cada equipo al que pertenece.
            equipos_ids = set(
                EquipoMiembro.objects.filter(
                    usuario=user,
                    estado=EquipoMiembro.EstadoMiembro.ACTIVO,
                ).values_list("equipo_id", flat=True)
            )
            lideres_ids = set(
                Equipo.objects.filter(id__in=equipos_ids).values_list(
                    "lider_id", flat=True
                )
            )
            usuarios_ids = {user.id} | {lider for lider in lideres_ids if lider}

            permisos = (
                PermisoCampana.objects
                .filter(usuario_id__in=usuarios_ids)
                .select_related(
                    "campana",
                    "campana__entidad",
                    "subcampana",
                    "subcampana__campana",
                    "subcampana__campana__entidad",
                )
            )
            for permiso in permisos:
                sub = permiso.subcampana
                if sub is not None:
                    if (
                        not sub.activo
                        or sub.eliminado
                        or not sub.campana.activo
                        or sub.campana.eliminado
                        or not sub.campana.entidad.activo
                        or sub.campana.entidad.eliminado
                    ):
                        continue
                    _agregar_subcampana(sub.campana, sub)
                    continue
                campana = permiso.campana
                if (
                    campana is None
                    or not campana.activo
                    or campana.eliminado
                    or not campana.entidad.activo
                    or campana.entidad.eliminado
                ):
                    continue
                for sub_campana in campana.subcampanas.filter(
                    activo=True,
                    eliminado=False,
                ):
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
        qs = (
            Campana.objects.all()
            .select_related("entidad")
            .prefetch_related("subcampanas")
        )
        if not user or not user.is_authenticated:
            return Campana.objects.none()
        if es_administrador(user):
            if _incluir_eliminados(self.request) or self.action == "restaurar":
                return qs
            return qs.filter(eliminado=False)
        qs = qs.filter(eliminado=False, entidad__eliminado=False)
        # Colaboradores ven todas las campañas activas; el formulario de
        # solicitudes usa /mis-permisos para limitar las que pueden usar.
        return qs.filter(activo=True, entidad__activo=True)


class SubCampanaViewSet(ModelViewSet):
    queryset = SubCampana.objects.all().select_related("campana", "campana__entidad")
    serializer_class = SubCampanaSerializer
    permission_classes = [IsAuthenticatedActivo]

    def get_permissions(self):
        perms = super().get_permissions()
        if self.action in (
            "create",
            "update",
            "partial_update",
            "destroy",
            "restaurar",
        ):
            perms += [EsAdministrador()]
        return perms

    def destroy(self, request, *args, **kwargs):
        subcampana = self.get_object()
        resultado = eliminar_subcampana(subcampana, request.user)
        return Response(resultado, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="restaurar")
    def restaurar(self, request, pk=None):
        subcampana = self.get_object()
        if not subcampana.eliminado:
            return Response(
                {"detail": "La subcampaña no está eliminada."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        resultado = restaurar_subcampana(subcampana)
        codigo = (
            status.HTTP_200_OK
            if resultado["restaurados"]
            else status.HTTP_400_BAD_REQUEST
        )
        return Response(resultado, status=codigo)

    def get_queryset(self):
        user = self.request.user
        qs = SubCampana.objects.all().select_related("campana", "campana__entidad")
        if not user or not user.is_authenticated:
            return SubCampana.objects.none()
        if es_administrador(user):
            if _incluir_eliminados(self.request) or self.action == "restaurar":
                incluir = qs
            else:
                incluir = qs.filter(eliminado=False)
        else:
            incluir = qs.filter(
                eliminado=False,
                campana__eliminado=False,
                campana__entidad__eliminado=False,
            )
        campana_id = self.request.query_params.get("campana_id") or self.request.query_params.get("campana")
        entidad_id = self.request.query_params.get("entidad_id") or self.request.query_params.get("entidad")
        if entidad_id:
            incluir = incluir.filter(campana__entidad_id=entidad_id)
        if campana_id:
            incluir = incluir.filter(campana_id=campana_id)
        if es_administrador(user):
            return incluir
        return incluir.filter(
            activo=True,
            campana__activo=True,
            campana__entidad__activo=True,
        )


class PermisoCampanaViewSet(ModelViewSet):
    queryset = PermisoCampana.objects.all().select_related(
        "usuario",
        "campana",
        "campana__entidad",
        "subcampana",
        "subcampana__campana",
        "subcampana__campana__entidad",
    )
    serializer_class = PermisoCampanaSerializer
    permission_classes = [IsAuthenticatedActivo, EsAdministrador]

    def get_queryset(self):
        qs = super().get_queryset().filter(
            Q(
                campana__isnull=False,
                campana__eliminado=False,
                campana__entidad__eliminado=False,
            )
            | Q(
                subcampana__isnull=False,
                subcampana__eliminado=False,
                subcampana__campana__eliminado=False,
                subcampana__campana__entidad__eliminado=False,
            )
        )
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

