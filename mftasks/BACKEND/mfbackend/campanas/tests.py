from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from usuarios.models import User

from .models import Campana, SubCampana, PermisoCampana


def _crear_usuario(email, tipo=None):
    user = User.objects.create_user(
        email=email,
        nombres="X",
        apellidos="Y",
        password="segura-123",
    )
    if tipo:
        user.tipo_usuario = tipo
        user.save(update_fields=["tipo_usuario"])
    return user


class MisPermisosTestCase(APITestCase):
    """GET /api/campanas/campanas/mis-permisos/ (campañas permitidas del usuario)."""

    def setUp(self):
        self.campana = Campana.objects.create(nombre="Camp", codigo="CAMP")
        self.sub1 = SubCampana.objects.create(campana=self.campana, nombre="Sub1", codigo="SUB1")
        self.sub2 = SubCampana.objects.create(campana=self.campana, nombre="Sub2", codigo="SUB2")
        self.usuario = _crear_usuario("user@empresa.com")
        PermisoCampana.objects.create(usuario=self.usuario, subcampana=self.sub1)

    def _get(self):
        return self.client.get(reverse("campana-mis-permisos"))

    def test_devuelve_solo_subcampanas_permitidas(self):
        self.client.force_authenticate(user=self.usuario)
        res = self._get()
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["id"], self.campana.id)
        self.assertEqual([s["id"] for s in res.data[0]["subcampanas"]], [self.sub1.id])

    def test_permiso_de_campana_completa_incluye_subcampanas(self):
        user2 = _crear_usuario("user2@empresa.com")
        PermisoCampana.objects.create(usuario=user2, campana=self.campana)
        self.client.force_authenticate(user=user2)
        res = self._get()
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(
            {s["id"] for s in res.data[0]["subcampanas"]},
            {self.sub1.id, self.sub2.id},
        )

    def test_admin_ve_todas_las_subcampanas_activas(self):
        admin = _crear_usuario("admin@empresa.com", tipo="ADMINISTRADOR")
        self.client.force_authenticate(user=admin)
        res = self._get()
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        entrada = next(c for c in res.data if c["id"] == self.campana.id)
        self.assertEqual(
            {s["id"] for s in entrada["subcampanas"]},
            {self.sub1.id, self.sub2.id},
        )

    def test_sin_permisos_devuelve_lista_vacia(self):
        user3 = _crear_usuario("user3@empresa.com")
        self.client.force_authenticate(user=user3)
        res = self._get()
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(res.data, [])
