from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from usuarios.permissions import EsAdministrador, IsAuthenticatedActivo

from .models import Campana, SubCampana, PermisoCampana
from .serializers import CampanaSerializer, SubCampanaSerializer, PermisoCampanaSerializer


class CampanaViewSet(ModelViewSet):
    queryset = Campana.objects.all().select_related("cliente").prefetch_related("subcampanas")
    serializer_class = CampanaSerializer
    permission_classes = [IsAuthenticatedActivo]

    def get_permissions(self):
        perms = super().get_permissions()
        if self.action in ("create", "update", "partial_update", "destroy"):
            perms += [EsAdministrador()]
        return perms

    def get_queryset(self):
        user = self.request.user
        qs = Campana.objects.all().select_related("cliente").prefetch_related("subcampanas")
        if not user or not user.is_authenticated:
            return Campana.objects.none()
        if user.roles.filter(rol__nombre__iexact="Administrador").exists():
            return qs
        # cliente ve solo campañas donde tiene permiso (campana o subcampana)
        if user.roles.filter(rol__nombre__iexact="CLIENTE").exists():
            campana_ids = set(PermisoCampana.objects.filter(usuario=user, campana__isnull=False).values_list("campana_id", flat=True))
            sub_campana_ids = PermisoCampana.objects.filter(usuario=user, subcampana__isnull=False).values_list("subcampana__campana_id", flat=True)
            campana_ids.update(sub_campana_ids)
            if campana_ids:
                return qs.filter(id__in=campana_ids)
            return qs.none()
        # miembro/lider/otro: ve todas activas
        return qs.filter(activo=True)


class SubCampanaViewSet(ModelViewSet):
    queryset = SubCampana.objects.all().select_related("campana", "campana__cliente")
    serializer_class = SubCampanaSerializer
    permission_classes = [IsAuthenticatedActivo]

    def get_permissions(self):
        perms = super().get_permissions()
        if self.action in ("create", "update", "partial_update", "destroy"):
            perms += [EsAdministrador()]
        return perms

    def get_queryset(self):
        user = self.request.user
        qs = SubCampana.objects.all().select_related("campana", "campana__cliente")
        campana_id = self.request.query_params.get("campana_id") or self.request.query_params.get("campana")
        if campana_id:
            qs = qs.filter(campana_id=campana_id)
        if not user or not user.is_authenticated:
            return SubCampana.objects.none()
        if user.roles.filter(rol__nombre__iexact="Administrador").exists():
            return qs
        if user.roles.filter(rol__nombre__iexact="CLIENTE").exists():
            # permisos mixtos
            permisos_campana = PermisoCampana.objects.filter(usuario=user, campana__isnull=False).values_list("campana_id", flat=True)
            permisos_sub = PermisoCampana.objects.filter(usuario=user, subcampana__isnull=False).values_list("subcampana_id", flat=True)
            # si tiene permiso a campana padre, ve todas sus subcampanas
            if permisos_campana:
                return qs.filter(Q(campana_id__in=permisos_campana) | Q(id__in=permisos_sub)).distinct()
            return qs.filter(id__in=permisos_sub)
        return qs.filter(activo=True)


class PermisoCampanaViewSet(ModelViewSet):
    queryset = PermisoCampana.objects.all().select_related("usuario", "campana", "subcampana")
    serializer_class = PermisoCampanaSerializer
    permission_classes = [IsAuthenticatedActivo, EsAdministrador]

