from datetime import datetime

from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from usuarios.permissions import EsAdministrador, IsAuthenticatedActivo

from .models import Subtarea, Tarea
from .permissions import EsAsignadorDeEquipoDeTarea
from .serializers import SubtareaSerializer, TaskSerializer


def _parsear_fecha(valor):

    if not valor:
        return None

    if isinstance(valor, datetime):
        return valor

    return parse_datetime(valor)


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer

    permission_classes = [IsAuthenticatedActivo]

    def get_queryset(self):

        user = self.request.user

        if user.roles.filter(rol__nombre="Administrador").exists():
            return Tarea.objects.all()

        return Tarea.objects.filter(
            Q(equipo__lider=user)
            | Q(equipo__miembros__usuario=user)
        ).distinct()

    def get_permissions(self):

        permisos = super().get_permissions()

        if self.action in (
            "create",
            "update",
            "partial_update",
            "destroy",
        ):
            permisos += [EsAdministrador()]

        return permisos

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticatedActivo, EsAsignadorDeEquipoDeTarea],
    )
    def aprobar(self, request, pk=None):

        tarea = self.get_object()

        if tarea.estado != Tarea.Estado.EN_ESPERA:
            return Response(
                {"detail": "Solo se pueden aprobar solicitudes en espera."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tarea.estado = Tarea.Estado.APROBADO
        tarea.aprobador = request.user
        tarea.fecha_respuesta = timezone.now()
        tarea.save()

        return Response(TaskSerializer(tarea).data)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticatedActivo, EsAsignadorDeEquipoDeTarea],
    )
    def rechazar(self, request, pk=None):

        tarea = self.get_object()

        if tarea.estado != Tarea.Estado.EN_ESPERA:
            return Response(
                {"detail": "Solo se pueden rechazar solicitudes en espera."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        motivo = (request.data.get("motivo_rechazo") or "").strip()

        if not motivo:
            return Response(
                {"detail": "El motivo de rechazo es obligatorio."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tarea.estado = Tarea.Estado.RECHAZADO
        tarea.aprobador = request.user
        tarea.motivo_rechazo = motivo
        tarea.fecha_respuesta = timezone.now()
        tarea.save()

        return Response(TaskSerializer(tarea).data)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticatedActivo, EsAsignadorDeEquipoDeTarea],
    )
    def iniciar(self, request, pk=None):

        tarea = self.get_object()

        if tarea.estado != Tarea.Estado.APROBADO:
            return Response(
                {"detail": "La tarea debe estar aprobada para iniciarse."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fecha_inicio = _parsear_fecha(request.data.get("fecha_inicio"))
        fecha_entrega = _parsear_fecha(
            request.data.get("fecha_entrega_aproximada")
        )

        if not fecha_inicio:
            return Response(
                {"detail": "La fecha de inicio es obligatoria."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not fecha_entrega:
            return Response(
                {"detail": "La fecha de entrega aproximada es obligatoria."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subtareas_data = request.data.get("subtareas") or []

        if not subtareas_data:
            return Response(
                {"detail": "Debe asignar al menos una subtarea."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        equipo = tarea.equipo

        miembros_ids = set(
            equipo.miembros.values_list("usuario_id", flat=True)
        )
        miembros_ids.add(equipo.lider_id)

        subtareas_crear = []

        for item in subtareas_data:
            descripcion = (item.get("descripcion") or "").strip()
            asignado_id = item.get("asignado")
            peso = item.get("peso") or 0

            if not descripcion or not asignado_id:
                continue

            try:
                asignado_id = int(asignado_id)
            except (TypeError, ValueError):
                continue

            if asignado_id not in miembros_ids:
                return Response(
                    {
                        "detail": (
                            f"El usuario {asignado_id} no es miembro "
                            "del equipo."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            subtareas_crear.append(
                Subtarea(
                    tarea=tarea,
                    descripcion=descripcion,
                    asignado_id=asignado_id,
                    peso=peso,
                )
            )

        if not subtareas_crear:
            return Response(
                {"detail": "Debe asignar al menos una subtarea válida."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        Subtarea.objects.bulk_create(subtareas_crear)

        tarea.estado = Tarea.Estado.EN_DESARROLLO
        tarea.fecha_inicio = fecha_inicio
        tarea.fecha_entrega_aproximada = fecha_entrega
        tarea.save()

        return Response(TaskSerializer(tarea).data)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticatedActivo, EsAsignadorDeEquipoDeTarea],
    )
    def agregar_subtarea(self, request, pk=None):

        tarea = self.get_object()

        descripcion = (request.data.get("descripcion") or "").strip()
        asignado_id = request.data.get("asignado")
        peso = request.data.get("peso") or 0

        if not descripcion:
            return Response(
                {"detail": "La descripción de la subtarea es obligatoria."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not asignado_id:
            return Response(
                {"detail": "Debe indicar el usuario asignado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        equipo = tarea.equipo

        miembros_ids = set(
            equipo.miembros.values_list("usuario_id", flat=True)
        )
        miembros_ids.add(equipo.lider_id)

        try:
            asignado_id = int(asignado_id)
        except (TypeError, ValueError):
            return Response(
                {"detail": "El usuario asignado no es válido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if asignado_id not in miembros_ids:
            return Response(
                {"detail": "El usuario no es miembro del equipo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subtarea = Subtarea.objects.create(
            tarea=tarea,
            descripcion=descripcion,
            asignado_id=asignado_id,
            peso=peso,
        )

        return Response(
            SubtareaSerializer(subtarea).data,
            status=status.HTTP_201_CREATED,
        )
