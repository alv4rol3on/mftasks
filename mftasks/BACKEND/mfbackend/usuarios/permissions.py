from rest_framework.permissions import BasePermission

from .models import RolePermission


class EsAdministrador(BasePermission):

    def has_permission(self, request, view):

        return request.user.roles.filter(
            rol__nombre="Administrador"
        ).exists()
    permission_code = "user.view"

