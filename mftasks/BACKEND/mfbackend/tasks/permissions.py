from rest_framework.permissions import BasePermission


def es_miembro_del_equipo(user, equipo):

    if not user or not user.is_authenticated:
        return False

    if user.roles.filter(rol__nombre="Administrador").exists():
        return True

    if equipo.lider_id == user.id:
        return True

    return equipo.miembros.filter(usuario=user).exists()


def es_asignador_del_equipo(user, equipo):

    if not user or not user.is_authenticated:
        return False

    if user.roles.filter(rol__nombre="Administrador").exists():
        return True

    if not es_miembro_del_equipo(user, equipo):
        return False

    if equipo.lider_id == user.id:
        return True

    return user.roles.filter(rol__nombre="ASIGNADOR").exists()


class EsMiembroDelEquipoDeTarea(BasePermission):

    def has_object_permission(self, request, view, obj):
        return es_miembro_del_equipo(request.user, obj.equipo)


class EsAsignadorDeEquipoDeTarea(BasePermission):

    def has_object_permission(self, request, view, obj):
        return es_asignador_del_equipo(request.user, obj.equipo)
