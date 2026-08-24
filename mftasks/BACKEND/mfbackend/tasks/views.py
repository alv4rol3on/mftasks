from datetime import datetime

from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from usuarios.permissions import EsAdministrador, IsAuthenticatedActivo

from .models import Subtarea, Tarea
from .permissions import EsAsignadorDeEquipoDeTarea, es_asignador_del_equipo, es_cliente
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

        if user.roles.filter(rol__nombre__iexact="Administrador").exists():
            return Tarea.objects.all().prefetch_related("subtareas", "equipo", "solicitante")

        # CLIENTE ve solo sus solicitudes
        if user.roles.filter(rol__nombre__iexact="CLIENTE").exists():
            # Si tiene también rol ASIGNADOR, prima asignador? cliente puro
            if user.roles.filter(rol__nombre__iexact="ASIGNADOR").exists() or user.roles.filter(rol__nombre__iexact="ASISTENTE").exists():
                # si tiene múltiples roles, priorizar asignador/asistente (no cliente)
                pass
            else:
                return Tarea.objects.filter(solicitante=user).prefetch_related("subtareas", "equipo", "solicitante")

        # Si es asignador (lider o rol ASIGNADOR) ve todas las tareas de su equipo
        es_asignador = False
        if user.roles.filter(rol__nombre__iexact="ASIGNADOR").exists():
            es_asignador = True
        from usuarios.models import Equipo
        if Equipo.objects.filter(lider=user).exists():
            es_asignador = True

        if es_asignador:
            return Tarea.objects.filter(
                Q(equipo__lider=user)
                | Q(equipo__miembros__usuario=user)
            ).distinct().prefetch_related("subtareas", "equipo", "solicitante")

        # Asistente explícito: solo tareas donde participa vía subtarea asignada
        if user.roles.filter(rol__nombre__iexact="ASISTENTE").exists():
            return Tarea.objects.filter(
                subtareas__asignado=user
            ).distinct().prefetch_related("subtareas", "equipo", "solicitante")

        # CLIENTE fallback (si no se capturo arriba por multi-rol)
        if user.roles.filter(rol__nombre__iexact="CLIENTE").exists():
            return Tarea.objects.filter(solicitante=user).prefetch_related("subtareas", "equipo", "solicitante")

        # Miembro sin rol específico: ve todas las tareas de su equipo (compatibilidad con tests viejos)
        return Tarea.objects.filter(
            Q(equipo__lider=user)
            | Q(equipo__miembros__usuario=user)
        ).distinct().prefetch_related("subtareas", "equipo", "solicitante")

    def get_permissions(self):

        permisos = super().get_permissions()

        if self.action == "create":
            # CLIENTE puede crear solicitudes, Admin también
            # Validación fina en perform_create / has_permission manual
            from rest_framework.permissions import BasePermission

            class EsClienteOAdmin(BasePermission):
                def has_permission(self, request, view):
                    if not request.user or not request.user.is_authenticated:
                        return False
                    if request.user.roles.filter(rol__nombre__iexact="Administrador").exists():
                        return True
                    if request.user.roles.filter(rol__nombre__iexact="CLIENTE").exists():
                        return True
                    # Admin ya cubre; asignador no debe crear solicitudes (según spec)
                    return False

            # Reemplaza el check: mantenemos IsAuthenticatedActivo + cliente/admin
            # permisos ya tiene IsAuthenticatedActivo, añadimos cliente/admin
            permisos = [IsAuthenticatedActivo(), EsClienteOAdmin()]

        elif self.action in (
            "update",
            "partial_update",
            "destroy",
        ):
            permisos += [EsAdministrador()]

        return permisos

    def perform_create(self, serializer):
        user = self.request.user
        # CLIENTE crea en EN_ESPERA con solicitante = user
        if user.roles.filter(rol__nombre__iexact="CLIENTE").exists():
            serializer.save(
                solicitante=user,
                estado=Tarea.Estado.EN_ESPERA,
                progreso=0,
            )
        else:
            # Admin u otros: si no viene solicitante, lo deja null; estado por defecto EN_ESPERA
            serializer.save()

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

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsAuthenticatedActivo],
        url_path="resumen",
    )
    def resumen(self, request):
        user = request.user

        # CLIENTE resumen de sus solicitudes
        if user.roles.filter(rol__nombre__iexact="CLIENTE").exists() and not user.roles.filter(rol__nombre__iexact="Administrador").exists() and not user.roles.filter(rol__nombre__iexact="ASIGNADOR").exists() and not user.roles.filter(rol__nombre__iexact="ASISTENTE").exists():
            qs = Tarea.objects.filter(solicitante=user)
            return Response({
                "tipo": "cliente",
                "en_espera": qs.filter(estado=Tarea.Estado.EN_ESPERA).count(),
                "aprobadas": qs.filter(estado=Tarea.Estado.APROBADO).count(),
                "en_desarrollo": qs.filter(estado=Tarea.Estado.EN_DESARROLLO).count(),
                "rechazadas": qs.filter(estado=Tarea.Estado.RECHAZADO).count(),
                "solucionadas": qs.filter(estado=Tarea.Estado.SOLUCIONADO).count(),
                "total": qs.count(),
            })
        # Si tiene CLIENTE + otros roles, priorizar otros roles, pero también dar datos cliente
        if user.roles.filter(rol__nombre__iexact="CLIENTE").exists():
            # no retornar solo cliente, seguir a lógica asignador/asistente si corresponde
            pass

        # Administrador ve todo por aprobar
        if user.roles.filter(rol__nombre__iexact="Administrador").exists():
            por_aprobar = Tarea.objects.filter(estado=Tarea.Estado.EN_ESPERA).count()
            pendientes = Subtarea.objects.filter(
                asignado=user,
                estado__in=[Subtarea.Estado.EN_ESPERA, Subtarea.Estado.EN_DESARROLLO],
                tarea__estado=Tarea.Estado.EN_DESARROLLO,
            ).count()
            return Response({
                "tipo": "admin",
                "por_aprobar": por_aprobar,
                "pendientes": pendientes,
            })

        es_asignador = False
        if user.roles.filter(rol__nombre__iexact="ASIGNADOR").exists():
            es_asignador = True
        from usuarios.models import Equipo
        if Equipo.objects.filter(lider=user).exists():
            es_asignador = True

        if es_asignador:
            # tareas por aprobar de sus equipos
            por_aprobar = Tarea.objects.filter(
                Q(equipo__lider=user) | Q(equipo__miembros__usuario=user),
                estado=Tarea.Estado.EN_ESPERA,
            ).distinct().count()
            return Response({
                "tipo": "asignador",
                "por_aprobar": por_aprobar,
            })

        if user.roles.filter(rol__nombre__iexact="CLIENTE").exists():
            qs = Tarea.objects.filter(solicitante=user)
            return Response({
                "tipo": "cliente",
                "en_espera": qs.filter(estado=Tarea.Estado.EN_ESPERA).count(),
                "aprobadas": qs.filter(estado=Tarea.Estado.APROBADO).count(),
                "en_desarrollo": qs.filter(estado=Tarea.Estado.EN_DESARROLLO).count(),
                "rechazadas": qs.filter(estado=Tarea.Estado.RECHAZADO).count(),
                "solucionadas": qs.filter(estado=Tarea.Estado.SOLUCIONADO).count(),
                "total": qs.count(),
            })

        # asistente explícito o miembro sin rol (mostrar pendientes si tiene subtareas)
        pendientes = Subtarea.objects.filter(
            asignado=user,
            estado__in=[Subtarea.Estado.EN_ESPERA, Subtarea.Estado.EN_DESARROLLO],
            tarea__estado=Tarea.Estado.EN_DESARROLLO,
        ).count()
        tareas_pendientes = Tarea.objects.filter(
            subtareas__asignado=user,
            subtareas__estado__in=[Subtarea.Estado.EN_ESPERA, Subtarea.Estado.EN_DESARROLLO],
            estado=Tarea.Estado.EN_DESARROLLO,
        ).distinct().count()
        # Si tiene rol ASISTENTE, tipo asistente, sino si tiene pendientes lo tratamos como asistente
        tipo = "asistente" if user.roles.filter(rol__nombre__iexact="ASISTENTE").exists() or pendientes > 0 else "asistente"
        return Response({
            "tipo": tipo,
            "pendientes": pendientes,
            "tareas_pendientes": tareas_pendientes,
        })

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticatedActivo],
        url_path=r"subtareas/(?P<subtarea_id>[^/.]+)/completar",
    )
    def completar_subtarea(self, request, pk=None, subtarea_id=None):
        tarea = self.get_object()
        subtarea = get_object_or_404(Subtarea, id=subtarea_id, tarea=tarea)

        # Administrador no puede completar subtareas (según requerimiento base)
        if request.user.roles.filter(rol__nombre__iexact="Administrador").exists():
            return Response(
                {"detail": "Los administradores no pueden completar subtareas."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Asignador/ASISTENTE (y también CLIENTE) solo si es de su equipo y es el asignado
        is_member = (
            tarea.equipo.lider_id == request.user.id
            or tarea.equipo.miembros.filter(usuario=request.user).exists()
        )
        if not is_member:
            return Response(
                {"detail": "No perteneces al equipo de esta solicitud."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if subtarea.asignado_id != request.user.id:
            return Response(
                {"detail": "Solo el usuario asignado puede completar esta subtarea."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if subtarea.estado == Subtarea.Estado.SOLUCIONADO:
            return Response(
                {"detail": "La subtarea ya está solucionada."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subtarea.estado = Subtarea.Estado.SOLUCIONADO
        subtarea.fecha_fin = timezone.now()
        if not subtarea.fecha_inicio:
            subtarea.fecha_inicio = timezone.now()
        subtarea.save()

        # Recalcular progreso de la tarea basado en peso
        subtareas = Subtarea.objects.filter(tarea=tarea)
        total_peso = sum(s.peso for s in subtareas)
        peso_solucionado = sum(s.peso for s in subtareas if s.estado == Subtarea.Estado.SOLUCIONADO)
        if total_peso > 0:
            tarea.progreso = round((peso_solucionado / total_peso) * 100, 2)
        else:
            tarea.progreso = 0

        # Si todas solucionadas, marcar tarea solucionada
        if all(s.estado == Subtarea.Estado.SOLUCIONADO for s in subtareas):
            tarea.estado = Tarea.Estado.SOLUCIONADO

        tarea.save()

        return Response(SubtareaSerializer(subtarea).data)
