import logging

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework_simplejwt.tokens import RefreshToken

from .azure import AzureTokenValidationError, AzureTokenValidator

from .models import Equipo, EquipoMiembro, Rol, User
from .permissions import EsAdministrador, IsAuthenticatedActivo, puede_gestionar_miembros
from .serializers import (
    EquipoDetailSerializer,
    RolSerializer,
    UserDetailSerializer,
    UserSerializer,
)

logger = logging.getLogger(__name__)


class MicrosoftLoginView(APIView):

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):

        access_token = (
            request.data.get("id_token")
            or request.data.get("access_token")
        )

        if not access_token:
            return Response(
                {"detail": "El token de acceso es obligatorio."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            claims = AzureTokenValidator.validar(access_token)
        except AzureTokenValidationError as e:
            logger.warning("Login SSO rechazado: %s", e)
            return Response(
                {"detail": str(e)},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        email = claims.get("email")
        azure_id = claims.get("azure_id")

        usuario = None

        if azure_id:
            try:
                usuario = User.objects.get(azure_id=azure_id)
            except User.DoesNotExist:
                usuario = None

        if usuario is None and email:
            try:
                usuario = User.objects.get(email__iexact=email)
            except User.DoesNotExist:
                usuario = None

        if usuario is None:
            logger.warning(
                "Login SSO: usuario no registrado (%s)", email
            )
            return Response(
                {
                    "detail": (
                        "Acceso denegado: tu cuenta no está registrada "
                        "en el sistema."
                    )
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not usuario.activo:
            logger.warning(
                "Login SSO: usuario inactivo (%s)", usuario.email
            )
            return Response(
                {"detail": "Acceso denegado: usuario inactivo."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if azure_id and usuario.azure_id != azure_id:
            usuario.azure_id = azure_id

        usuario.last_login = timezone.now()
        usuario.save(update_fields=["azure_id", "last_login"])

        refresh = RefreshToken.for_user(usuario)

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserDetailSerializer(usuario).data,
            },
            status=status.HTTP_200_OK,
        )


class MeView(APIView):

    permission_classes = [IsAuthenticatedActivo]

    def get(self, request):

        return Response(
            UserDetailSerializer(request.user).data,
            status=status.HTTP_200_OK,
        )


class UserViewSet(ModelViewSet):

    queryset = User.objects.all()

    serializer_class = UserSerializer

    permission_classes = [IsAuthenticatedActivo]

    def get_permissions(self):

        permisos = super().get_permissions()

        if self.action in ("create", "update", "partial_update", "destroy"):
            permisos += [EsAdministrador()]

        return permisos


class RolViewSet(ModelViewSet):

    queryset = Rol.objects.all()

    serializer_class = RolSerializer

    permission_classes = [IsAuthenticatedActivo]

    def get_permissions(self):

        permisos = super().get_permissions()

        if self.action in ("create", "update", "partial_update", "destroy"):
            permisos += [EsAdministrador()]

        return permisos


class EquipoViewSet(ModelViewSet):

    queryset = Equipo.objects.all()

    serializer_class = EquipoDetailSerializer

    permission_classes = [IsAuthenticatedActivo]

    def get_permissions(self):

        permisos = super().get_permissions()

        if self.action in ("create", "update", "partial_update", "destroy"):
            permisos += [EsAdministrador()]

        return permisos

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Equipo.objects.none()
        # Administrador ve todos
        if user.roles.filter(rol__nombre__iexact="Administrador").exists():
            return Equipo.objects.all().select_related("lider").prefetch_related("miembros__usuario")
        # Cliente puro (solo CLIENTE, sin otros roles ni liderazgo) ve equipos activos disponibles para solicitar
        es_cliente_puro = user.roles.filter(rol__nombre__iexact="CLIENTE").exists() and not user.roles.filter(rol__nombre__iexact="ASIGNADOR").exists() and not user.roles.filter(rol__nombre__iexact="ASISTENTE").exists() and not Equipo.objects.filter(lider=user).exists()
        # Si tiene también EquipoMiembro, no es cliente puro; usará filtro de miembro
        if es_cliente_puro and not EquipoMiembro.objects.filter(usuario=user).exists():
            return Equipo.objects.filter(activo=True).select_related("lider").prefetch_related("miembros__usuario")
        # Si es cliente pero también miembro/líder, mostrar también lo disponible + pertenencia
        # Para evitar duplicar, si es cliente y además miembro, combinar
        if user.roles.filter(rol__nombre__iexact="CLIENTE").exists():
            # Mostrar equipos donde es miembro/líder + todos activos (para solicitar)
            # Para no exponer todos si no debe, mostramos todos activos (según req: clientes ven equipos de los que puede solicitar)
            return Equipo.objects.filter(
                Q(activo=True)
            ).distinct().select_related("lider").prefetch_related("miembros__usuario")
        # Asignador / Asistente / miembro general: solo equipos donde es líder o miembro activo/no inactivo
        return Equipo.objects.filter(
            Q(lider=user) | Q(miembros__usuario=user)
        ).distinct().select_related("lider").prefetch_related("miembros__usuario")

    @staticmethod
    def _validar_estado(payload):
        estado = (payload.get("estado") or "").upper().strip()
        if estado not in [EquipoMiembro.EstadoMiembro.ACTIVO, EquipoMiembro.EstadoMiembro.INACTIVO, EquipoMiembro.EstadoMiembro.INDISPONIBLE]:
            return None, "Estado inválido. Use ACTIVO, INACTIVO o INDISPONIBLE."
        return estado, None

    @action(detail=True, methods=["post"], url_path="miembros/(?P<usuario_id>[^/.]+)/rol")
    def gestionar_rol(self, request, pk=None, usuario_id=None):
        equipo = self.get_object()
        if not puede_gestionar_miembros(request.user, equipo):
            return Response({"detail": "Solo el líder del equipo puede administrar roles."}, status=status.HTTP_403_FORBIDDEN)
        try:
            miembro = EquipoMiembro.objects.get(equipo=equipo, usuario_id=usuario_id)
        except EquipoMiembro.DoesNotExist:
            return Response({"detail": "El usuario no es miembro del equipo."}, status=status.HTTP_404_NOT_FOUND)
        if str(miembro.usuario_id) == str(equipo.lider_id):
            return Response({"detail": "No se puede modificar el rol del líder."}, status=status.HTTP_400_BAD_REQUEST)
        nuevo_rol = (request.data.get("rol_en_equipo") or request.data.get("rol") or "").upper().strip()
        if nuevo_rol not in [EquipoMiembro.RolEnEquipo.MIEMBRO, EquipoMiembro.RolEnEquipo.SUB_LIDER]:
            return Response({"detail": "Rol inválido. Use MIEMBRO o SUB_LIDER."}, status=status.HTTP_400_BAD_REQUEST)
        if miembro.estado == EquipoMiembro.EstadoMiembro.INACTIVO and nuevo_rol == EquipoMiembro.RolEnEquipo.SUB_LIDER:
            return Response({"detail": "No se puede otorgar SUB_LIDER a un miembro inactivo."}, status=status.HTTP_400_BAD_REQUEST)
        miembro.rol_en_equipo = nuevo_rol
        miembro.save(update_fields=["rol_en_equipo"])
        return Response({"detail": "Rol actualizado.", "rol_en_equipo": miembro.rol_en_equipo}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="miembros/(?P<usuario_id>[^/.]+)/estado")
    def gestionar_estado(self, request, pk=None, usuario_id=None):
        equipo = self.get_object()
        # Validar permiso: solo líder (o admin) puede administrar estados; para líder auto-gestión también se permite
        es_request_lider = str(request.user.id) == str(equipo.lider_id)
        es_request_admin = request.user.roles.filter(rol__nombre__iexact="Administrador").exists()
        if not (puede_gestionar_miembros(request.user, equipo) or (es_request_lider and str(usuario_id) == str(request.user.id))):
            return Response({"detail": "Solo el líder del equipo puede administrar estados."}, status=status.HTTP_403_FORBIDDEN)
        try:
            miembro = EquipoMiembro.objects.select_related("usuario").get(equipo=equipo, usuario_id=usuario_id)
        except EquipoMiembro.DoesNotExist:
            return Response({"detail": "El usuario no es miembro del equipo."}, status=status.HTTP_404_NOT_FOUND)
        es_lider_objetivo = str(miembro.usuario_id) == str(equipo.lider_id) or miembro.rol_en_equipo == EquipoMiembro.RolEnEquipo.LIDER
        # Si el objetivo es líder, solo él mismo o admin puede modificarlo
        if es_lider_objetivo and not (es_request_lider and str(usuario_id) == str(request.user.id)) and not es_request_admin:
            return Response({"detail": "Solo el propio líder (o administrador) puede modificar su disponibilidad."}, status=status.HTTP_403_FORBIDDEN)
        estado, err = self._validar_estado(request.data)
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)

        # Gate específico líder -> INDISPONIBLE requiere sub-líder activo
        if es_lider_objetivo and estado == EquipoMiembro.EstadoMiembro.INDISPONIBLE:
            has_sub = EquipoMiembro.objects.filter(
                equipo=equipo,
                rol_en_equipo=EquipoMiembro.RolEnEquipo.SUB_LIDER,
                estado=EquipoMiembro.EstadoMiembro.ACTIVO,
            ).exists()
            if not has_sub:
                return Response(
                    {"detail": "No puedes pasar a indisponible: el equipo debe tener al menos un sub-líder activo."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Si se intenta pasar a INDISPONIBLE, verificar subtareas pendientes
        if estado == EquipoMiembro.EstadoMiembro.INDISPONIBLE:
            from tasks.models import Subtarea, Tarea
            pendientes_qs = Subtarea.objects.filter(
                asignado_id=miembro.usuario_id,
                estado__in=[Subtarea.Estado.EN_ESPERA, Subtarea.Estado.EN_DESARROLLO],
                tarea__equipo=equipo,
                tarea__estado=Tarea.Estado.EN_DESARROLLO,
            ).select_related("tarea")
            pendientes = list(pendientes_qs)
            if pendientes:
                # Intentar reasignación si viene en payload
                reassignments = request.data.get("reassignments") or request.data.get("reasignaciones") or None
                reassign_all_to = request.data.get("reassign_all_to") or request.data.get("reassignAllTo") or None
                if reassign_all_to:
                    try:
                        reassign_all_to = int(reassign_all_to)
                    except (TypeError, ValueError):
                        return Response({"detail": "reassign_all_to debe ser un id de usuario válido."}, status=status.HTTP_400_BAD_REQUEST)
                    reassignments = [{"subtarea_id": p.id, "nuevo_asignado": reassign_all_to} for p in pendientes]
                if reassignments:
                    # Validar y aplicar reasignaciones
                    # Miembros activos disponibles (incluye líder)
                    miembros_activos_ids = set(
                        EquipoMiembro.objects.filter(
                            equipo=equipo, estado=EquipoMiembro.EstadoMiembro.ACTIVO
                        ).values_list("usuario_id", flat=True)
                    )
                    miembros_activos_ids.add(equipo.lider_id)
                    # Excluir al propio usuario origen si está por pasar a indisponible (ya no debería reasignarse a sí mismo)
                    # pero si lo intentan, se valida
                    pendientes_ids = {p.id for p in pendientes}
                    reassign_map = {}
                    for item in reassignments:
                        sid = item.get("subtarea_id") or item.get("subtarea") or item.get("id")
                        nid = item.get("nuevo_asignado") or item.get("nuevo_asignado_id") or item.get("destino")
                        try:
                            sid = int(sid)
                            nid = int(nid)
                        except (TypeError, ValueError):
                            return Response({"detail": f"Reasignación inválida: {item}"}, status=status.HTTP_400_BAD_REQUEST)
                        if sid not in pendientes_ids:
                            return Response({"detail": f"La subtarea {sid} no está entre las pendientes del usuario."}, status=status.HTTP_400_BAD_REQUEST)
                        if nid == int(miembro.usuario_id):
                            return Response({"detail": "No puedes reasignar una subtarea al mismo usuario que pasará a indisponible."}, status=status.HTTP_400_BAD_REQUEST)
                        if nid not in miembros_activos_ids:
                            return Response({"detail": f"El usuario {nid} no es miembro activo del equipo."}, status=status.HTTP_400_BAD_REQUEST)
                        # Verificar que destino no esté inactivo/indisponible
                        try:
                            dest_miembro = EquipoMiembro.objects.get(equipo=equipo, usuario_id=nid)
                            if dest_miembro.estado != EquipoMiembro.EstadoMiembro.ACTIVO:
                                return Response({"detail": f"El usuario {nid} no está activo (estado {dest_miembro.estado})."}, status=status.HTTP_400_BAD_REQUEST)
                        except EquipoMiembro.DoesNotExist:
                            if nid != equipo.lider_id:
                                return Response({"detail": f"El usuario {nid} no es miembro del equipo."}, status=status.HTTP_400_BAD_REQUEST)
                        reassign_map[sid] = nid
                    # Aplicar en transacción
                    with transaction.atomic():
                        for sid, nid in reassign_map.items():
                            Subtarea.objects.filter(id=sid).update(asignado_id=nid)
                    # Recalcular pendientes restantes
                    restantes = Subtarea.objects.filter(
                        asignado_id=miembro.usuario_id,
                        estado__in=[Subtarea.Estado.EN_ESPERA, Subtarea.Estado.EN_DESARROLLO],
                        tarea__equipo=equipo,
                        tarea__estado=Tarea.Estado.EN_DESARROLLO,
                    ).select_related("tarea")
                    if restantes.exists():
                        pendientes_rest = list(restantes)
                        detalle = [
                            {"subtarea_id": p.id, "descripcion": p.descripcion, "tarea_id": p.tarea_id, "tarea_asunto": p.tarea.asunto, "estado": p.estado}
                            for p in pendientes_rest
                        ]
                        return Response(
                            {
                                "detail": "el siguiente usuario tiene subtareas pendientes, estas deben completarse o re-asignarse",
                                "usuario": {"id": miembro.usuario_id, "nombre": f"{miembro.usuario.nombres} {miembro.usuario.apellidos}"},
                                "pendientes": detalle,
                                "restantes": len(pendientes_rest),
                            },
                            status=status.HTTP_409_CONFLICT,
                        )
                    # Si todo reasignado, continuar a guardar estado
                else:
                    detalle = [
                        {"subtarea_id": p.id, "descripcion": p.descripcion, "tarea_id": p.tarea_id, "tarea_asunto": p.tarea.asunto, "estado": p.estado}
                        for p in pendientes
                    ]
                    return Response(
                        {
                            "detail": "el siguiente usuario tiene subtareas pendientes, estas deben completarse o re-asignarse",
                            "usuario": {"id": miembro.usuario_id, "nombre": f"{miembro.usuario.nombres} {miembro.usuario.apellidos}"},
                            "pendientes": detalle,
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

        # Aplicar cambio de estado
        miembro.estado = estado
        if estado == EquipoMiembro.EstadoMiembro.INDISPONIBLE:
            miembro.fecha_inicio_indisponibilidad = request.data.get("fecha_inicio_indisponibilidad") or request.data.get("fecha_inicio") or None
            miembro.fecha_fin_indisponibilidad = request.data.get("fecha_fin_indisponibilidad") or request.data.get("fecha_fin") or None
            miembro.motivo_indisponibilidad = (request.data.get("motivo_indisponibilidad") or request.data.get("motivo") or "").strip()
            if miembro.rol_en_equipo == EquipoMiembro.RolEnEquipo.SUB_LIDER:
                miembro.rol_en_equipo = EquipoMiembro.RolEnEquipo.MIEMBRO
            # LIDER mantiene rol LIDER aun indisponible
        elif estado == EquipoMiembro.EstadoMiembro.ACTIVO:
            miembro.fecha_inicio_indisponibilidad = None
            miembro.fecha_fin_indisponibilidad = None
            miembro.motivo_indisponibilidad = ""
        elif estado == EquipoMiembro.EstadoMiembro.INACTIVO:
            if miembro.rol_en_equipo == EquipoMiembro.RolEnEquipo.SUB_LIDER:
                miembro.rol_en_equipo = EquipoMiembro.RolEnEquipo.MIEMBRO
            # Si es LIDER no se permite INACTIVO (debería transferirse liderazgo) -> bloquear
            if es_lider_objetivo:
                return Response({"detail": "No se puede inactivar al líder del equipo. Transfiera el liderazgo primero."}, status=status.HTTP_400_BAD_REQUEST)
            miembro.fecha_inicio_indisponibilidad = None
            miembro.fecha_fin_indisponibilidad = None
            miembro.motivo_indisponibilidad = ""
        miembro.save(update_fields=["estado", "rol_en_equipo", "fecha_inicio_indisponibilidad", "fecha_fin_indisponibilidad", "motivo_indisponibilidad"])
        return Response({"detail": f"Estado actualizado a {estado}.", "estado": miembro.estado}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="miembros/(?P<usuario_id>[^/.]+)/subtareas-pendientes")
    def subtareas_pendientes(self, request, pk=None, usuario_id=None):
        equipo = self.get_object()
        try:
            miembro = EquipoMiembro.objects.get(equipo=equipo, usuario_id=usuario_id)
        except EquipoMiembro.DoesNotExist:
            return Response({"detail": "El usuario no es miembro del equipo."}, status=status.HTTP_404_NOT_FOUND)
        from tasks.models import Subtarea, Tarea
        pendientes = Subtarea.objects.filter(
            asignado_id=miembro.usuario_id,
            estado__in=[Subtarea.Estado.EN_ESPERA, Subtarea.Estado.EN_DESARROLLO],
            tarea__equipo=equipo,
            tarea__estado=Tarea.Estado.EN_DESARROLLO,
        ).select_related("tarea")
        data = [
            {"subtarea_id": p.id, "descripcion": p.descripcion, "tarea_id": p.tarea_id, "tarea_asunto": p.tarea.asunto, "estado": p.estado, "peso": p.peso}
            for p in pendientes
        ]
        return Response({"usuario": {"id": miembro.usuario_id, "nombre": f"{miembro.usuario.nombres} {miembro.usuario.apellidos}"}, "pendientes": data, "total": len(data)}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="miembros/(?P<usuario_id>[^/.]+)/reasignar-subtareas")
    def reasignar_subtareas(self, request, pk=None, usuario_id=None):
        from tasks.models import Subtarea, Tarea
        from tasks.permissions import es_asignador_del_equipo
        equipo = self.get_object()
        if not es_asignador_del_equipo(request.user, equipo):
            return Response({"detail": "Solo líder/sub-líder/asignador puede reasignar."}, status=status.HTTP_403_FORBIDDEN)
        try:
            miembro = EquipoMiembro.objects.get(equipo=equipo, usuario_id=usuario_id)
        except EquipoMiembro.DoesNotExist:
            return Response({"detail": "El usuario no es miembro del equipo."}, status=status.HTTP_404_NOT_FOUND)
        pendientes_ids = set(
            Subtarea.objects.filter(
                asignado_id=miembro.usuario_id,
                estado__in=[Subtarea.Estado.EN_ESPERA, Subtarea.Estado.EN_DESARROLLO],
                tarea__equipo=equipo,
                tarea__estado=Tarea.Estado.EN_DESARROLLO,
            ).values_list("id", flat=True)
        )
        reassignments = request.data.get("reassignments") or request.data.get("reasignaciones") or []
        reassign_all_to = request.data.get("reassign_all_to") or request.data.get("reassignAllTo")
        if reassign_all_to and not reassignments:
            try:
                reassign_all_to = int(reassign_all_to)
            except (TypeError, ValueError):
                return Response({"detail": "reassign_all_to inválido."}, status=status.HTTP_400_BAD_REQUEST)
            reassignments = [{"subtarea_id": sid, "nuevo_asignado": reassign_all_to} for sid in pendientes_ids]
        if not reassignments:
            return Response({"detail": "Debe enviar reassignments o reassign_all_to."}, status=status.HTTP_400_BAD_REQUEST)
        miembros_activos_ids = set(
            EquipoMiembro.objects.filter(equipo=equipo, estado=EquipoMiembro.EstadoMiembro.ACTIVO).values_list("usuario_id", flat=True)
        )
        miembros_activos_ids.add(equipo.lider_id)
        reassign_map = {}
        for item in reassignments:
            sid = item.get("subtarea_id") or item.get("subtarea") or item.get("id")
            nid = item.get("nuevo_asignado") or item.get("nuevo_asignado_id") or item.get("destino")
            try:
                sid = int(sid); nid = int(nid)
            except (TypeError, ValueError):
                return Response({"detail": f"Reasignación inválida {item}"}, status=status.HTTP_400_BAD_REQUEST)
            if sid not in pendientes_ids:
                return Response({"detail": f"Subtarea {sid} no pendiente del usuario."}, status=status.HTTP_400_BAD_REQUEST)
            if nid not in miembros_activos_ids:
                return Response({"detail": f"Usuario {nid} no activo del equipo."}, status=status.HTTP_400_BAD_REQUEST)
            if nid == int(usuario_id):
                return Response({"detail": "No puedes reasignar al mismo usuario."}, status=status.HTTP_400_BAD_REQUEST)
            reassign_map[sid] = nid
        with transaction.atomic():
            for sid, nid in reassign_map.items():
                Subtarea.objects.filter(id=sid).update(asignado_id=nid)
        return Response({"detail": f"Se reasignaron {len(reassign_map)} subtareas.", "reasignadas": len(reassign_map)}, status=status.HTTP_200_OK)