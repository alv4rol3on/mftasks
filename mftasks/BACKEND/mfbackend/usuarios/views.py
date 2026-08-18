import logging

from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework_simplejwt.tokens import RefreshToken

from .azure import AzureTokenValidationError, AzureTokenValidator
from .models import Equipo, Rol, User
from .permissions import EsAdministrador, IsAuthenticatedActivo
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