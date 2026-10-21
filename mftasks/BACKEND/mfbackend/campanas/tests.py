from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from clientes.models import Entidad
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

    def test_mis_permisos_incluye_entidad(self):
        self.client.force_authenticate(user=self.usuario)
        res = self._get()
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertIn("entidad_nombre", res.data[0])
        self.assertTrue(res.data[0]["entidad_nombre"])


class CampanaJerarquiaTestCase(APITestCase):

    def setUp(self):
        self.admin = _crear_usuario("admin-entidad@empresa.com", tipo="ADMINISTRADOR")
        self.entidad = Entidad.objects.create(
            nombre="Entidad API", razon_social="Entidad API SAC"
        )
        self.client.force_authenticate(user=self.admin)

    def test_crear_campana_requiere_entidad(self):
        res = self.client.post(
            reverse("campana-list"),
            {"nombre": "Campa?a sin entidad"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_crear_campana_con_entidad(self):
        res = self.client.post(
            reverse("campana-list"),
            {"entidad": self.entidad.id, "nombre": "Campa?a API"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        campana = Campana.objects.get(id=res.data["id"])
        self.assertEqual(campana.entidad_id, self.entidad.id)
        self.assertEqual(res.data["entidad_nombre"], self.entidad.nombre)

    def test_no_permite_mismo_nombre_en_entidad(self):
        Campana.objects.create(entidad=self.entidad, nombre="Repetida")
        res = self.client.post(
            reverse("campana-list"),
            {"entidad": self.entidad.id, "nombre": "repetida"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
