from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from clientes.models import Cliente
from usuarios.models import Equipo, EquipoMiembro, Rol, User, UserRol

from .models import Subtarea, Tarea


def _crear_usuario(email, nombres="X", apellidos="Y"):
    return User.objects.create_user(
        email=email,
        nombres=nombres,
        apellidos=apellidos,
        password="segura-123",
    )


def _asignar_rol(user, nombre):
    rol, _ = Rol.objects.get_or_create(nombre=nombre)
    return UserRol.objects.get_or_create(usuario=user, rol=rol)


class TareaFlujoTestCase(APITestCase):

    def setUp(self):

        self.admin = _crear_usuario("admin@empresa.com")
        _asignar_rol(self.admin, "Administrador")

        self.lider1 = _crear_usuario("lider1@empresa.com")
        self.asignador1 = _crear_usuario("asignador1@empresa.com")
        _asignar_rol(self.asignador1, "ASIGNADOR")
        self.miembro1 = _crear_usuario("miembro1@empresa.com")

        self.lider2 = _crear_usuario("lider2@empresa.com")

        self.cliente = Cliente.objects.create(nombre="Cliente A")

        self.equipo1 = Equipo.objects.create(
            nombre="Equipo 1",
            lider=self.lider1,
        )

        EquipoMiembro.objects.create(
            equipo=self.equipo1,
            usuario=self.asignador1,
        )

        EquipoMiembro.objects.create(
            equipo=self.equipo1,
            usuario=self.miembro1,
        )

        self.equipo2 = Equipo.objects.create(
            nombre="Equipo 2",
            lider=self.lider2,
        )

        self.tarea1 = Tarea.objects.create(
            asunto="Solicitud 1",
            descripcion="d1",
            cliente=self.cliente,
            estado=Tarea.Estado.EN_ESPERA,
            aprobador=self.admin,
            equipo=self.equipo1,
        )

        self.tarea2 = Tarea.objects.create(
            asunto="Solicitud 2",
            descripcion="d2",
            cliente=self.cliente,
            estado=Tarea.Estado.EN_ESPERA,
            aprobador=self.admin,
            equipo=self.equipo2,
        )

    def test_miembro_ve_solo_su_equipo(self):

        self.client.force_authenticate(user=self.miembro1)

        res = self.client.get(reverse("task-list"))

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = {t["id"] for t in res.data}
        self.assertEqual(ids, {self.tarea1.id})

    def test_admin_ve_todo(self):

        self.client.force_authenticate(user=self.admin)

        res = self.client.get(reverse("task-list"))

        ids = {t["id"] for t in res.data}
        self.assertEqual(ids, {self.tarea1.id, self.tarea2.id})

    def test_no_miembro_no_puede_acceder_a_tarea(self):

        self.client.force_authenticate(user=self.miembro1)

        res = self.client.get(
            reverse("task-detail", args=[self.tarea2.id])
        )

        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_miembro_sin_rol_no_puede_aprobar(self):

        self.client.force_authenticate(user=self.miembro1)

        res = self.client.post(
            reverse("task-aprobar", args=[self.tarea1.id])
        )

        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_asignador_puede_aprobar(self):

        self.client.force_authenticate(user=self.asignador1)

        res = self.client.post(
            reverse("task-aprobar", args=[self.tarea1.id])
        )

        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.tarea1.refresh_from_db()

        self.assertEqual(self.tarea1.estado, Tarea.Estado.APROBADO)
        self.assertEqual(self.tarea1.aprobador, self.asignador1)

    def test_lider_puede_aprobar(self):

        self.client.force_authenticate(user=self.lider1)

        res = self.client.post(
            reverse("task-aprobar", args=[self.tarea1.id])
        )

        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_rechazo_requiere_motivo(self):

        self.client.force_authenticate(user=self.asignador1)

        res = self.client.post(
            reverse("task-rechazar", args=[self.tarea1.id]),
            {},
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rechazo_ok(self):

        self.client.force_authenticate(user=self.asignador1)

        res = self.client.post(
            reverse("task-rechazar", args=[self.tarea1.id]),
            {"motivo_rechazo": "Duplicada"},
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.tarea1.refresh_from_db()

        self.assertEqual(self.tarea1.estado, Tarea.Estado.RECHAZADO)
        self.assertEqual(self.tarea1.motivo_rechazo, "Duplicada")

    def test_aprobar_solo_en_espera(self):

        self.tarea1.estado = Tarea.Estado.APROBADO
        self.tarea1.save()

        self.client.force_authenticate(user=self.admin)

        res = self.client.post(
            reverse("task-aprobar", args=[self.tarea1.id])
        )

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_iniciar_requiere_subtareas_del_equipo(self):

        self.tarea1.estado = Tarea.Estado.APROBADO
        self.tarea1.save()

        self.client.force_authenticate(user=self.admin)

        payload = {
            "fecha_inicio": "2026-08-17T09:00:00Z",
            "fecha_entrega_aproximada": "2026-08-20T18:00:00Z",
            "subtareas": [
                {
                    "descripcion": "Revisar",
                    "asignado": self.miembro1.id,
                    "peso": 5,
                }
            ],
        }

        res = self.client.post(
            reverse("task-iniciar", args=[self.tarea1.id]),
            payload,
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.tarea1.refresh_from_db()

        self.assertEqual(self.tarea1.estado, Tarea.Estado.EN_DESARROLLO)
        self.assertEqual(
            Subtarea.objects.filter(tarea=self.tarea1).count(),
            1,
        )

    def test_iniciar_rechaza_asignado_fuera_del_equipo(self):

        self.tarea1.estado = Tarea.Estado.APROBADO
        self.tarea1.save()

        self.client.force_authenticate(user=self.admin)

        payload = {
            "fecha_inicio": "2026-08-17T09:00:00Z",
            "fecha_entrega_aproximada": "2026-08-20T18:00:00Z",
            "subtareas": [
                {
                    "descripcion": "Revisar",
                    "asignado": self.lider2.id,
                    "peso": 5,
                }
            ],
        }

        res = self.client.post(
            reverse("task-iniciar", args=[self.tarea1.id]),
            payload,
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_iniciar_solo_aprobada(self):

        self.client.force_authenticate(user=self.admin)

        res = self.client.post(
            reverse("task-iniciar", args=[self.tarea1.id]),
            {},
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_agregar_subtarea(self):

        self.tarea1.estado = Tarea.Estado.EN_DESARROLLO
        self.tarea1.save()

        self.client.force_authenticate(user=self.asignador1)

        res = self.client.post(
            reverse("task-agregar-subtarea", args=[self.tarea1.id]),
            {
                "descripcion": "Nueva",
                "asignado": self.miembro1.id,
                "peso": 3,
            },
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

    def test_crear_solo_admin(self):

        self.client.force_authenticate(user=self.asignador1)

        res = self.client.post(
            reverse("task-list"),
            {
                "asunto": "X",
                "descripcion": "x",
                "cliente": self.cliente.id,
                "equipo": self.equipo1.id,
                "aprobador": self.admin.id,
            },
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
