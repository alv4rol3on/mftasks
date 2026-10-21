from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from usuarios.models import User

from .models import Entidad


class EntidadApiTestCase(APITestCase):

    def setUp(self):
        self.admin = User.objects.create_user(
            email="admin-entidades@empresa.com",
            nombres="Admin",
            apellidos="Entidades",
            password="segura-123",
        )
        self.admin.tipo_usuario = "ADMINISTRADOR"
        self.admin.save(update_fields=["tipo_usuario"])
        self.client.force_authenticate(user=self.admin)

    def test_admin_crea_y_lista_entidad(self):
        res = self.client.post(
            reverse("entidad-list"),
            {
                "nombre": "Entidad Nueva",
                "razon_social": "Entidad Nueva SAC",
                "ruc": "20123456789",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertTrue(Entidad.objects.filter(nombre="Entidad Nueva").exists())

        res = self.client.get(reverse("entidad-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
