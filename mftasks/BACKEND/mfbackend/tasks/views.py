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


def _tiene_dependencias_pendientes_subtarea(subtarea):
    # retorna lista bloqueadoras no solucionadas
    from .models import DependenciaSubtarea
    deps = DependenciaSubtarea.objects.filter(bloqueada=subtarea).select_related("bloqueadora")
    pendientes = [d.bloqueadora for d in deps if d.bloqueadora.estado != Subtarea.Estado.SOLUCIONADO]
    return pendientes


def _tiene_dependencias_pendientes_tarea(tarea):
    from .models import DependenciaTarea
    deps = DependenciaTarea.objects.filter(bloqueada=tarea).select_related("bloqueadora")
    pendientes = [d.bloqueadora for d in deps if d.bloqueadora.estado != Tarea.Estado.SOLUCIONADO]
    return pendientes


def _detecta_ciclo_subtarea(bloqueada_id, bloqueadora_id):
    # DFS para evitar ciclo
    from .models import DependenciaSubtarea
    visitados = set()
    stack = [bloqueadora_id]
    while stack:
        cur = stack.pop()
        if cur == bloqueada_id:
            return True
        if cur in visitados:
            continue
        visitados.add(cur)
        for nxt in DependenciaSubtarea.objects.filter(bloqueada_id=cur).values_list("bloqueadora_id", flat=True):
            stack.append(nxt)
    return False


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer

    permission_classes = [IsAuthenticatedActivo]

    def get_queryset(self):

        user = self.request.user
        from usuarios.models import Equipo, EquipoMiembro

        # base queryset con search
        search = self.request.query_params.get("search") or self.request.query_params.get("q")
        def apply_search(qs):
            if search:
                qs = qs.filter(Q(ticket__icontains=search) | Q(asunto__icontains=search) | Q(descripcion__icontains=search))
            return qs

        if user.roles.filter(rol__nombre__iexact="Administrador").exists():
            qs = Tarea.objects.all().prefetch_related("subtareas", "equipo", "solicitante")
            return apply_search(qs)

        # CLIENTE nunca es miembro de equipo: solo ve sus propias solicitudes (no espía)
        if user.roles.filter(rol__nombre__iexact="CLIENTE").exists():
            qs = Tarea.objects.filter(solicitante=user).prefetch_related("subtareas", "equipo", "solicitante")
            return apply_search(qs)

        # Detectar lider por-equipo (Fase 1: 4 roles) -> lider = Equipo.lider o miembro LIDER activo
        es_lider = Equipo.objects.filter(lider=user).exists() or EquipoMiembro.objects.filter(usuario=user, rol_en_equipo=EquipoMiembro.RolEnEquipo.LIDER, estado=EquipoMiembro.EstadoMiembro.ACTIVO).exists()
        # compat ASIGNADOR todavía considerado lider hasta migración completa
        es_asignador_global = user.roles.filter(rol__nombre__iexact="ASIGNADOR").exists()
        es_asignador_amplio = es_asignador_global or es_lider

        # LIDER / SUB-LIDER / ASIGNADOR: ven todas las tareas de su equipo (pueden aprobar/iniciar/asignar)
        if es_asignador_amplio:
            qs = Tarea.objects.filter(
                Q(equipo__lider=user)
                | Q(equipo__miembros__usuario=user)
            ).distinct().prefetch_related("subtareas", "equipo", "solicitante")
            return apply_search(qs)

        # Miembro (rol miembro o lider): ve todas las tareas de su equipo
        qs = Tarea.objects.filter(
            Q(equipo__lider=user)
            | Q(equipo__miembros__usuario=user)
        ).distinct().prefetch_related("subtareas", "equipo", "solicitante")
        return apply_search(qs)

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

        # Validar dependencias de tarea
        pendientes_t = _tiene_dependencias_pendientes_tarea(tarea)
        if pendientes_t:
            return Response(
                {"detail": "La tarea tiene dependencias no solucionadas.", "bloqueadoras": [{"id": t.id, "asunto": t.asunto, "estado": t.estado} for t in pendientes_t]},
                status=status.HTTP_409_CONFLICT,
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

        from usuarios.models import EquipoMiembro
        miembros_ids = set(
            equipo.miembros.filter(
                estado=EquipoMiembro.EstadoMiembro.ACTIVO
            ).values_list("usuario_id", flat=True)
        )
        # líder siempre asignable si está activo a nivel User
        miembros_ids.add(equipo.lider_id)
        # sub-líder activo también ya está en miembros ACTIVO

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

        from usuarios.models import EquipoMiembro
        miembros_ids = set(
            equipo.miembros.filter(
                estado=EquipoMiembro.EstadoMiembro.ACTIVO
            ).values_list("usuario_id", flat=True)
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

    def _tareas_con_pendientes(self, user):
        """Retorna detalle agrupado de tareas donde user tiene subtareas pendientes."""
        pendientes = Subtarea.objects.filter(
            asignado=user,
            estado__in=[Subtarea.Estado.EN_ESPERA, Subtarea.Estado.EN_DESARROLLO],
            tarea__estado=Tarea.Estado.EN_DESARROLLO,
        ).select_related("tarea", "tarea__equipo")
        agrupado = {}
        for s in pendientes:
            tid = s.tarea_id
            if tid not in agrupado:
                agrupado[tid] = {
                    "tarea_id": tid,
                    "asunto": s.tarea.asunto,
                    "equipo_nombre": s.tarea.equipo.nombre if s.tarea.equipo else "",
                    "estado_tarea": s.tarea.estado,
                    "subtareas": [],
                }
            agrupado[tid]["subtareas"].append({
                "subtarea_id": s.id,
                "descripcion": s.descripcion,
                "estado": s.estado,
                "peso": s.peso,
            })
        return list(agrupado.values())

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsAuthenticatedActivo],
        url_path="mis-pendientes",
    )
    def mis_pendientes(self, request):
        detalle = self._tareas_con_pendientes(request.user)
        total_sub = sum(len(t["subtareas"]) for t in detalle)
        return Response({
            "total_tareas": len(detalle),
            "total_subtareas": total_sub,
            "tareas": detalle,
        })

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsAuthenticatedActivo],
        url_path="resumen",
    )
    def resumen(self, request):
        user = request.user

        # CLIENTE siempre ve solo sus solicitudes, sin importar otros roles/miembro
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

        # Administrador ve todo por aprobar + detalle pendientes propios
        if user.roles.filter(rol__nombre__iexact="Administrador").exists():
            por_aprobar = Tarea.objects.filter(estado=Tarea.Estado.EN_ESPERA).count()
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
            detalle = self._tareas_con_pendientes(user)
            return Response({
                "tipo": "admin",
                "por_aprobar": por_aprobar,
                "pendientes": pendientes,
                "tareas_pendientes": tareas_pendientes,
                "tareas_con_pendientes": detalle,
            })

        es_asignador = False
        if user.roles.filter(rol__nombre__iexact="ASIGNADOR").exists():
            es_asignador = True
        if Equipo.objects.filter(lider=user).exists():
            es_asignador = True
        if EquipoMiembro.objects.filter(usuario=user, rol_en_equipo=EquipoMiembro.RolEnEquipo.SUB_LIDER, estado=EquipoMiembro.EstadoMiembro.ACTIVO).exists():
            es_asignador = True

        if es_asignador:
            # tareas por aprobar de sus equipos
            por_aprobar = Tarea.objects.filter(
                Q(equipo__lider=user) | Q(equipo__miembros__usuario=user),
                estado=Tarea.Estado.EN_ESPERA,
            ).distinct().count()
            # Además informar pendientes propios con detalle
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
            detalle = self._tareas_con_pendientes(user)
            return Response({
                "tipo": "asignador",
                "por_aprobar": por_aprobar,
                "pendientes": pendientes,
                "tareas_pendientes": tareas_pendientes,
                "tareas_con_pendientes": detalle,
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
        detalle = self._tareas_con_pendientes(user)
        # Si tiene rol ASISTENTE, tipo asistente, sino si tiene pendientes lo tratamos como asistente
        tipo = "asistente" if user.roles.filter(rol__nombre__iexact="ASISTENTE").exists() or pendientes > 0 else "asistente"
        return Response({
            "tipo": tipo,
            "pendientes": pendientes,
            "tareas_pendientes": tareas_pendientes,
            "tareas_con_pendientes": detalle,
        })


    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticatedActivo],
        url_path=r"subtareas/(?P<subtarea_id>[^/.]+)/empezar",
    )
    def empezar_subtarea(self, request, pk=None, subtarea_id=None):
        tarea = self.get_object()

        subtarea = get_object_or_404(
            Subtarea,
            id=subtarea_id,
            tarea=tarea
        )

        # Administrador no puede empezar subtareas
        if request.user.roles.filter(
            rol__nombre__iexact="Administrador"
        ).exists():
            return Response(
                {
                    "detail": "Los administradores no pueden empezar subtareas."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Verificar que pertenece al equipo
        is_member = (
            tarea.equipo.lider_id == request.user.id
            or tarea.equipo.miembros.filter(
                usuario=request.user
            ).exists()
        )

        if not is_member:
            return Response(
                {
                    "detail": "No perteneces al equipo de esta solicitud."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Solo el usuario asignado puede empezar
        if subtarea.asignado_id != request.user.id:
            return Response(
                {
                    "detail": "Solo el usuario asignado puede empezar esta subtarea."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Solo se puede empezar desde EN_ESPERA
        if subtarea.estado != Subtarea.Estado.EN_ESPERA:
            return Response(
                {
                    "detail": "La subtarea no está en espera."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validar dependencias
        pendientes = _tiene_dependencias_pendientes_subtarea(subtarea)
        if pendientes:
            return Response(
                {"detail": "La subtarea tiene dependencias no solucionadas.", "bloqueadoras": [{"id": s.id, "descripcion": s.descripcion, "estado": s.estado} for s in pendientes]},
                status=status.HTTP_409_CONFLICT,
            )

        if subtarea.estado == Subtarea.Estado.STAND_BY:
            return Response({"detail": "La subtarea está en pausa (STAND_BY). Debe reanudarla primero."}, status=status.HTTP_400_BAD_REQUEST)

        # Cambiar estado
        subtarea.estado = Subtarea.Estado.EN_DESARROLLO
        subtarea.fecha_inicio = timezone.now()
        subtarea.save()

        return Response(
            SubtareaSerializer(subtarea).data,
            status=status.HTTP_200_OK,
        )

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
            tarea.fecha_solucion = timezone.now()
        # Si tarea estaba en STAND_BY y ya no quedan subtareas en STAND_BY, volver a EN_DESARROLLO (si no está solucionada)
        elif tarea.estado == Tarea.Estado.STAND_BY and not any(s.estado == Subtarea.Estado.STAND_BY for s in subtareas):
            tarea.estado = Tarea.Estado.EN_DESARROLLO
            tarea.motivo_standby = ""
            tarea.fecha_standby = None
            tarea.standby_por = None

        tarea.save()

        return Response(SubtareaSerializer(subtarea).data)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticatedActivo, EsAsignadorDeEquipoDeTarea],
        url_path=r"subtareas/(?P<subtarea_id>[^/.]+)/reasignar",
    )
    def reasignar_subtarea(self, request, pk=None, subtarea_id=None):
        tarea = self.get_object()
        subtarea = get_object_or_404(Subtarea, id=subtarea_id, tarea=tarea)
        if subtarea.estado == Subtarea.Estado.SOLUCIONADO:
            return Response({"detail": "No se puede reasignar una subtarea solucionada."}, status=status.HTTP_400_BAD_REQUEST)
        if tarea.estado not in [Tarea.Estado.EN_DESARROLLO, Tarea.Estado.STAND_BY]:
            return Response({"detail": "Solo se pueden reasignar subtareas de tareas en desarrollo o en pausa."}, status=status.HTTP_400_BAD_REQUEST)
        nuevo_id = request.data.get("nuevo_asignado") or request.data.get("nuevo_asignado_id") or request.data.get("asignado") or request.data.get("destino")
        if not nuevo_id:
            return Response({"detail": "Debe indicar nuevo_asignado."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            nuevo_id = int(nuevo_id)
        except (TypeError, ValueError):
            return Response({"detail": "nuevo_asignado inválido."}, status=status.HTTP_400_BAD_REQUEST)
        if nuevo_id == subtarea.asignado_id:
            return Response({"detail": "El nuevo asignado es el mismo que el actual."}, status=status.HTTP_400_BAD_REQUEST)
        # Validar que nuevo asignado sea miembro activo del equipo (o líder)
        from usuarios.models import EquipoMiembro
        equipo = tarea.equipo
        miembros_activos = set(
            equipo.miembros.filter(estado=EquipoMiembro.EstadoMiembro.ACTIVO).values_list("usuario_id", flat=True)
        )
        miembros_activos.add(equipo.lider_id)
        if nuevo_id not in miembros_activos:
            return Response({"detail": f"El usuario {nuevo_id} no es miembro activo del equipo."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            dest = EquipoMiembro.objects.get(equipo=equipo, usuario_id=nuevo_id)
            if dest.estado != EquipoMiembro.EstadoMiembro.ACTIVO:
                return Response({"detail": f"El usuario destino está {dest.estado}."}, status=status.HTTP_400_BAD_REQUEST)
        except EquipoMiembro.DoesNotExist:
            if nuevo_id != equipo.lider_id:
                return Response({"detail": f"El usuario {nuevo_id} no es miembro del equipo."}, status=status.HTTP_400_BAD_REQUEST)
        subtarea.asignado_id = nuevo_id
        subtarea.save(update_fields=["asignado"])
        return Response(SubtareaSerializer(subtarea).data, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticatedActivo],
        url_path=r"subtareas/(?P<subtarea_id>[^/.]+)/standby",
    )
    def standby_subtarea(self, request, pk=None, subtarea_id=None):
        tarea = self.get_object()
        subtarea = get_object_or_404(Subtarea, id=subtarea_id, tarea=tarea)
        # solo miembro/lider del equipo puede poner standby (tu r3)
        is_member = tarea.equipo.lider_id == request.user.id or tarea.equipo.miembros.filter(usuario=request.user).exclude(estado="INACTIVO").exists()
        if not is_member:
            return Response({"detail": "No perteneces al equipo."}, status=status.HTTP_403_FORBIDDEN)
        if subtarea.asignado_id != request.user.id and tarea.equipo.lider_id != request.user.id:
            # lider puede pausar cualquier subtarea, miembro solo la suya
            from usuarios.models import EquipoMiembro
            is_lider = EquipoMiembro.objects.filter(equipo=tarea.equipo, usuario=request.user, rol_en_equipo=EquipoMiembro.RolEnEquipo.LIDER, estado=EquipoMiembro.EstadoMiembro.ACTIVO).exists() or tarea.equipo.lider_id == request.user.id
            if not is_lider:
                return Response({"detail": "Solo el asignado o el líder puede pausar."}, status=status.HTTP_403_FORBIDDEN)
        if subtarea.estado not in [Subtarea.Estado.EN_DESARROLLO, Subtarea.Estado.EN_ESPERA]:
            return Response({"detail": "Solo se puede pausar desde EN_ESPERA o EN_DESARROLLO."}, status=status.HTTP_400_BAD_REQUEST)
        motivo = (request.data.get("motivo") or request.data.get("motivo_standby") or "").strip()
        if not motivo:
            return Response({"detail": "El motivo de pausa es obligatorio."}, status=status.HTTP_400_BAD_REQUEST)
        subtarea.estado = Subtarea.Estado.STAND_BY
        subtarea.motivo_standby = motivo
        subtarea.fecha_standby = timezone.now()
        subtarea.standby_por = request.user
        subtarea.save(update_fields=["estado", "motivo_standby", "fecha_standby", "standby_por"])
        # Propagar a Tarea: si alguna subtarea en STAND_BY, Tarea pasa a STAND_BY
        if tarea.estado != Tarea.Estado.STAND_BY:
            tarea.estado = Tarea.Estado.STAND_BY
            tarea.motivo_standby = f"Pausa por subtarea #{subtarea.id}: {motivo}"
            tarea.fecha_standby = timezone.now()
            tarea.standby_por = request.user
            tarea.save(update_fields=["estado", "motivo_standby", "fecha_standby", "standby_por"])
        return Response(SubtareaSerializer(subtarea).data, status=status.HTTP_200_OK)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticatedActivo],
        url_path=r"subtareas/(?P<subtarea_id>[^/.]+)/reanudar",
    )
    def reanudar_subtarea(self, request, pk=None, subtarea_id=None):
        tarea = self.get_object()
        subtarea = get_object_or_404(Subtarea, id=subtarea_id, tarea=tarea)
        is_member = tarea.equipo.lider_id == request.user.id or tarea.equipo.miembros.filter(usuario=request.user).exclude(estado="INACTIVO").exists()
        if not is_member:
            return Response({"detail": "No perteneces al equipo."}, status=status.HTTP_403_FORBIDDEN)
        if subtarea.estado != Subtarea.Estado.STAND_BY:
            return Response({"detail": "La subtarea no está en STAND_BY."}, status=status.HTTP_400_BAD_REQUEST)
        # solo asignado o lider puede reanudar (requisito: cualquier miembro asignado)
        if subtarea.asignado_id != request.user.id and tarea.equipo.lider_id != request.user.id:
            from usuarios.models import EquipoMiembro
            is_lider = EquipoMiembro.objects.filter(equipo=tarea.equipo, usuario=request.user, rol_en_equipo=EquipoMiembro.RolEnEquipo.LIDER).exists()
            if not is_lider:
                return Response({"detail": "Solo el asignado o el líder puede reanudar."}, status=status.HTTP_403_FORBIDDEN)
        # validar dependencias antes de reanudar
        pendientes = _tiene_dependencias_pendientes_subtarea(subtarea)
        if pendientes:
            return Response({"detail": "Dependencias pendientes.", "bloqueadoras": [{"id": s.id, "descripcion": s.descripcion} for s in pendientes]}, status=status.HTTP_409_CONFLICT)
        # Reanudar a EN_ESPERA (requisito: trae de vuelta select en EN_ESPERA)
        subtarea.estado = Subtarea.Estado.EN_ESPERA
        subtarea.motivo_standby = ""
        subtarea.fecha_standby = None
        subtarea.standby_por = None
        subtarea.save(update_fields=["estado", "motivo_standby", "fecha_standby", "standby_por"])
        # Si ya no quedan subtareas en STAND_BY, Tarea vuelve a EN_DESARROLLO
        if not Subtarea.objects.filter(tarea=tarea, estado=Subtarea.Estado.STAND_BY).exists():
            if tarea.estado == Tarea.Estado.STAND_BY:
                tarea.estado = Tarea.Estado.EN_DESARROLLO
                tarea.motivo_standby = ""
                tarea.fecha_standby = None
                tarea.standby_por = None
                tarea.save(update_fields=["estado", "motivo_standby", "fecha_standby", "standby_por"])
        return Response(SubtareaSerializer(subtarea).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticatedActivo, EsAsignadorDeEquipoDeTarea], url_path=r"subtareas/(?P<subtarea_id>[^/.]+)/dependencias")
    def agregar_dependencia_subtarea(self, request, pk=None, subtarea_id=None):
        tarea = self.get_object()
        subtarea = get_object_or_404(Subtarea, id=subtarea_id, tarea=tarea)
        bloqueadora_id = request.data.get("bloqueadora_id") or request.data.get("depende_de")
        if not bloqueadora_id:
            return Response({"detail": "Debe indicar bloqueadora_id."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            bloqueadora_id = int(bloqueadora_id)
        except (TypeError, ValueError):
            return Response({"detail": "bloqueadora_id inválido."}, status=status.HTTP_400_BAD_REQUEST)
        if bloqueadora_id == subtarea.id:
            return Response({"detail": "No puede depender de sí misma."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            bloqueadora = Subtarea.objects.get(id=bloqueadora_id)
        except Subtarea.DoesNotExist:
            return Response({"detail": "Subtarea bloqueadora no existe."}, status=status.HTTP_404_NOT_FOUND)
        if _detecta_ciclo_subtarea(subtarea.id, bloqueadora_id):
            return Response({"detail": "Ciclo detectado."}, status=status.HTTP_400_BAD_REQUEST)
        from .models import DependenciaSubtarea
        obj, created = DependenciaSubtarea.objects.get_or_create(bloqueada=subtarea, bloqueadora_id=bloqueadora_id)
        if not created:
            return Response({"detail": "Dependencia ya existe."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Dependencia creada.", "bloqueada": subtarea.id, "bloqueadora": bloqueadora_id}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticatedActivo, EsAsignadorDeEquipoDeTarea], url_path="dependencias-tarea")
    def agregar_dependencia_tarea(self, request, pk=None):
        tarea = self.get_object()
        bloqueadora_id = request.data.get("bloqueadora_id") or request.data.get("depende_de")
        if not bloqueadora_id:
            return Response({"detail": "Debe indicar bloqueadora_id."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            bloqueadora_id = int(bloqueadora_id)
        except (TypeError, ValueError):
            return Response({"detail": "bloqueadora_id inválido."}, status=status.HTTP_400_BAD_REQUEST)
        if bloqueadora_id == tarea.id:
            return Response({"detail": "No puede depender de sí misma."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            bloqueadora = Tarea.objects.get(id=bloqueadora_id)
        except Tarea.DoesNotExist:
            return Response({"detail": "Tarea bloqueadora no existe."}, status=status.HTTP_404_NOT_FOUND)
        from .models import DependenciaTarea
        # ciclo simple
        if DependenciaTarea.objects.filter(bloqueada_id=bloqueadora_id, bloqueadora_id=tarea.id).exists():
            return Response({"detail": "Ciclo detectado."}, status=status.HTTP_400_BAD_REQUEST)
        obj, created = DependenciaTarea.objects.get_or_create(bloqueada=tarea, bloqueadora_id=bloqueadora_id)
        if not created:
            return Response({"detail": "Dependencia ya existe."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Dependencia creada."}, status=status.HTTP_201_CREATED)
