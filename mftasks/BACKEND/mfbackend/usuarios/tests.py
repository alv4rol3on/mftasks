from unittest.mock import patch

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .azure import AzureTokenValidationError
from .models import Rol, User, UserRol


class UsuarioSSOTestCase(APITestCase):

    def setUp(self):

        self.usuario = User.objects.create_user(
            email="jose@empresa.com",
            nombres="José",
            apellidos="Pérez",
            cargo="Asistente",
            password="clave-segura-123",
        )

        self.rol_admin, _ = Rol.objects.get_or_create(
            nombre="Administrador",
            defaults={"descripcion": "Administra el sistema"},
        )

        UserRol.objects.create(
            usuario=self.usuario,
            rol=self.rol_admin,
        )

        self.claims_validos = {
            "azure_id": "08a3b2c1-0000-0000-0000-000000000001",
            "email": "jose@empresa.com",
            "nombres": "José Pérez",
        }

        self.url_login = reverse("microsoft-login")

    @patch(
        "usuarios.views.AzureTokenValidator.validar",
        return_value={
            "azure_id": "08a3b2c1-0000-0000-0000-000000000001",
            "email": "jose@empresa.com",
            "nombres": "José Pérez",
        },
    )
    def test_login_valido_retorna_tokens(self, mock_validar):

        respuesta = self.client.post(
            self.url_login,
            {"access_token": "token-azure-falso"},
            format="json",
        )

        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)

        self.assertIn("access", respuesta.data)
        self.assertIn("refresh", respuesta.data)
        self.assertEqual(
            respuesta.data["user"]["email"],
            "jose@empresa.com",
        )
        self.assertIn("Administrador", respuesta.data["user"]["roles"])

        self.usuario.refresh_from_db()

        self.assertEqual(
            self.usuario.azure_id,
            "08a3b2c1-0000-0000-0000-000000000001",
        )

    @patch(
        "usuarios.views.AzureTokenValidator.validar",
        side_effect=AzureTokenValidationError("Token inválido."),
    )
    def test_login_token_invalido_rechazado(self, mock_validar):

        respuesta = self.client.post(
            self.url_login,
            {"access_token": "token-azure-invalido"},
            format="json",
        )

        self.assertEqual(
            respuesta.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_login_sin_token_devuelve_400(self):

        respuesta = self.client.post(self.url_login, {}, format="json")

        self.assertEqual(
            respuesta.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    @patch(
        "usuarios.views.AzureTokenValidator.validar",
        return_value={
            "azure_id": "08a3b2c1-0000-0000-0000-000000000003",
            "email": "jose@empresa.com",
            "nombres": "José Pérez",
        },
    )
    def test_login_acepta_id_token(self, mock_validar):

        respuesta = self.client.post(
            self.url_login,
            {"id_token": "id-token-azure-falso"},
            format="json",
        )

        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertIn("access", respuesta.data)

    @patch(
        "usuarios.views.AzureTokenValidator.validar",
        return_value={
            "azure_id": "08a3b2c1-0000-0000-0000-000000000099",
            "email": "desconocido@otra.com",
            "nombres": "X",
        },
    )
    def test_login_usuario_no_registrado_rechazado(self, mock_validar):

        respuesta = self.client.post(
            self.url_login,
            {"access_token": "token-azure"},
            format="json",
        )

        self.assertEqual(
            respuesta.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    @patch(
        "usuarios.views.AzureTokenValidator.validar",
        return_value={
            "azure_id": "08a3b2c1-0000-0000-0000-000000000002",
            "email": "jose@empresa.com",
            "nombres": "José Pérez",
        },
    )
    def test_login_usuario_inactivo_rechazado(self, mock_validar):

        self.usuario.activo = False
        self.usuario.save()

        respuesta = self.client.post(
            self.url_login,
            {"access_token": "token-azure"},
            format="json",
        )

        self.assertEqual(
            respuesta.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_me_requiere_autenticacion(self):

        respuesta = self.client.get(reverse("me"))

        self.assertEqual(
            respuesta.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_me_devuelve_usuario_autenticado(self):

        self.client.force_authenticate(user=self.usuario)

        respuesta = self.client.get(reverse("me"))

        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(
            respuesta.data["email"],
            "jose@empresa.com",
        )
        self.assertIn("Administrador", respuesta.data["roles"])