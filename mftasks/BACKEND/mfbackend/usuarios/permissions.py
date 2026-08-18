from rest_framework.permissions import BasePermission, IsAuthenticated


class IsAuthenticatedActivo(IsAuthenticated):

    def has_permission(self, request, view):

        if not super().has_permission(request, view):
            return False

        return request.user.activo


class EsAdministrador(BasePermission):

    def has_permission(self, request, view):

        if not request.user or not request.user.is_authenticated:
            return False

        return request.user.roles.filter(
            rol__nombre="Administrador"
        ).exists()