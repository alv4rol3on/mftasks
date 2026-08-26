import logging

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
        if not puede_gestionar_miembros(request.user, equipo):
            return Response({"detail": "Solo el líder del equipo puede administrar estados."}, status=status.HTTP_403_FORBIDDEN)
        try:
            miembro = EquipoMiembro.objects.get(equipo=equipo, usuario_id=usuario_id)
        except EquipoMiembro.DoesNotExist:
            return Response({"detail": "El usuario no es miembro del equipo."}, status=status.HTTP_404_NOT_FOUND)
        if str(miembro.usuario_id) == str(equipo.lider_id):
            return Response({"detail": "No se puede modificar el estado del líder."}, status=status.HTTP_400_BAD_REQUEST)
        estado, err = self._validar_estado(request.data)
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        miembro.estado = estado
        if estado == EquipoMiembro.EstadoMiembro.INDISPONIBLE:
            miembro.fecha_inicio_indisponibilidad = request.data.get("fecha_inicio_indisponibilidad") or request.data.get("fecha_inicio") or None
            miembro.fecha_fin_indisponibilidad = request.data.get("fecha_fin_indisponibilidad") or request.data.get("fecha_fin") or None
            miembro.motivo_indisponibilidad = (request.data.get("motivo_indisponibilidad") or request.data.get("motivo") or "").strip()
            # si pasa a indisponible, revocar sub-lider automáticamente para evitar operar estando indisponible
            if miembro.rol_en_equipo == EquipoMiembro.RolEnEquipo.SUB_LIDER:
                miembro.rol_en_equipo = EquipoMiembro.RolEnEquipo.MIEMBRO
        elif estado == EquipoMiembro.EstadoMiembro.ACTIVO:
            miembro.fecha_inicio_indisponibilidad = None
            miembro.fecha_fin_indisponibilidad = None
            miembro.motivo_indisponibilidad = ""
        elif estado == EquipoMiembro.EstadoMiembro.INACTIVO:
            # inactivar revoca sub-lider
            miembro.rol_en_equipo = EquipoMiembro.RolEnEquipo.MIEMBRO
            miembro.fecha_inicio_indisponibilidad = None
            miembro.fecha_fin_indisponibilidad = None
            miembro.motivo_indisponibilidad = ""
        miembro.save(update_fields=["estado", "rol_en_equipo", "fecha_inicio_indisponibilidad", "fecha_fin_indisponibilidad", "motivo_indisponibilidad"])
        return Response({"detail": f"Estado actualizado a {estado}.", "estado": miembro.estado}, status=status.HTTP_200_OK)