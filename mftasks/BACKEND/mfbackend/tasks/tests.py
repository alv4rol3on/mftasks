from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from campanas.models import Campana, SubCampana
from usuarios.models import Equipo, EquipoMiembro, Rol, User, UserRol

from .models import Subtarea, Tarea, TareaLog
from .services.tiempo_laboral import calcular_tiempo_laboral, sumar_tiempo_laboral


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

        self.campana = Campana.objects.create(nombre="Campana Test", codigo="CAMP_TEST")
        self.subcampana = SubCampana.objects.create(campana=self.campana, nombre="Sub Test", codigo="SUB_TEST")

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
            subcampana=self.subcampana,
            estado=Tarea.Estado.EN_ESPERA,
            aprobador=self.admin,
            equipo=self.equipo1,
        )

        self.tarea2 = Tarea.objects.create(
            asunto="Solicitud 2",
            descripcion="d2",
            subcampana=self.subcampana,
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
                "subcampana": self.subcampana.id,
                "equipo": self.equipo1.id,
                "aprobador": self.admin.id,
            },
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)


class TiempoLaboralTestCase(TestCase):
    """El horario laboral debe evaluarse en America/Lima (no UTC)."""

    lima = ZoneInfo("America/Lima")

    def test_lunes_a_viernes_9_18_cuenta(self):
        inicio = datetime(2026, 9, 14, 10, 0, tzinfo=self.lima)  # lunes
        fin = datetime(2026, 9, 14, 11, 0, tzinfo=self.lima)
        self.assertEqual(calcular_tiempo_laboral(inicio, fin), timedelta(hours=1))

    def test_mismo_instante_en_utc_da_igual(self):
        inicio = datetime(2026, 9, 14, 10, 0, tzinfo=self.lima)
        fin = datetime(2026, 9, 14, 11, 0, tzinfo=self.lima)
        self.assertEqual(
            calcular_tiempo_laboral(
                inicio.astimezone(timezone.utc), fin.astimezone(timezone.utc)
            ),
            timedelta(hours=1),
        )

    def test_fuera_de_jornada_no_cuenta(self):
        inicio = datetime(2026, 9, 14, 19, 0, tzinfo=self.lima)
        fin = datetime(2026, 9, 14, 20, 0, tzinfo=self.lima)
        self.assertEqual(calcular_tiempo_laboral(inicio, fin), timedelta(0))

    def test_sabado_siempre_cuenta(self):
        inicio = datetime(2026, 9, 19, 10, 0, tzinfo=self.lima)  # sábado
        fin = datetime(2026, 9, 19, 11, 0, tzinfo=self.lima)
        self.assertEqual(calcular_tiempo_laboral(inicio, fin), timedelta(hours=1))

    def test_sabado_fuera_de_jornada_no_cuenta(self):
        inicio = datetime(2026, 9, 19, 14, 0, tzinfo=self.lima)  # sábado 14:00
        fin = datetime(2026, 9, 19, 15, 0, tzinfo=self.lima)
        self.assertEqual(calcular_tiempo_laboral(inicio, fin), timedelta(0))

    def test_domingo_nunca_cuenta(self):
        inicio = datetime(2026, 9, 20, 10, 0, tzinfo=self.lima)  # domingo
        fin = datetime(2026, 9, 20, 11, 0, tzinfo=self.lima)
        self.assertEqual(calcular_tiempo_laboral(inicio, fin), timedelta(0))
        # tampoco de madrugada ni con cualquier flag
        madrugada_i = datetime(2026, 9, 20, 2, 0, tzinfo=self.lima)
        madrugada_f = datetime(2026, 9, 20, 2, 30, tzinfo=self.lima)
        self.assertEqual(
            calcular_tiempo_laboral(madrugada_i, madrugada_f, incluye_sabado=True),
            timedelta(0),
        )

    def test_sumar_tiempo_laboral_dentro_de_jornada(self):
        base = datetime(2026, 9, 14, 10, 0, tzinfo=self.lima)  # lunes
        self.assertEqual(
            sumar_tiempo_laboral(base, timedelta(hours=3)),
            datetime(2026, 9, 14, 13, 0, tzinfo=self.lima),
        )

    def test_sumar_tiempo_laboral_cruza_fin_de_jornada(self):
        # viernes 17:00 + 2h laborales -> sábado 10:00 (sábado 9-13 cuenta)
        base = datetime(2026, 9, 18, 17, 0, tzinfo=self.lima)  # viernes
        res = sumar_tiempo_laboral(base, timedelta(hours=2))
        self.assertEqual(res, datetime(2026, 9, 19, 10, 0, tzinfo=self.lima))


class ReanudarSubtareaTestCase(APITestCase):

    def setUp(self):
        self.lider = _crear_usuario("lider-r@empresa.com")
        self.miembro = _crear_usuario("miembro-r@empresa.com")

        campana = Campana.objects.create(nombre="C R", codigo="CAMP_R")
        sub = SubCampana.objects.create(campana=campana, nombre="S R", codigo="SUB_R")

        self.equipo = Equipo.objects.create(nombre="Equipo R", lider=self.lider)
        EquipoMiembro.objects.create(equipo=self.equipo, usuario=self.miembro)

        self.tarea = Tarea.objects.create(
            asunto="Tarea R",
            descripcion="d",
            subcampana=sub,
            estado=Tarea.Estado.EN_DESARROLLO,
            equipo=self.equipo,
            incluye_sabado=True,
            fecha_inicio=timezone.now() - timedelta(hours=2),
            fecha_entrega_aproximada=timezone.now() + timedelta(days=2),
        )
        self.subtarea = Subtarea.objects.create(
            tarea=self.tarea,
            descripcion="Sub R",
            asignado=self.miembro,
            peso=1,
            estado=Subtarea.Estado.STAND_BY,
            motivo_standby="pausa",
            fecha_standby=timezone.now() - timedelta(days=7),
        )

    def _url(self):
        return reverse(
            "task-reanudar-subtarea", args=[self.tarea.id, self.subtarea.id]
        )

    def _ultimo_standby_fin(self):
        return (
            TareaLog.objects.filter(
                tarea=self.tarea,
                subtarea=self.subtarea,
                tipo_evento=TareaLog.TipoEvento.STANDBY_FIN,
            )
            .order_by("-id")
            .first()
        )

    def test_tarea_pausada_si_subtarea_en_standby(self):
        from .services.tiempo_laboral import obtener_contador_tarea

        self.tarea.estado = Tarea.Estado.EN_DESARROLLO
        self.tarea.save(update_fields=["estado"])
        self.subtarea.estado = Subtarea.Estado.STAND_BY
        self.subtarea.save(update_fields=["estado", "motivo_standby"])

        contador = obtener_contador_tarea(self.tarea)

        self.assertTrue(contador["pausado"])
        self.assertFalse(contador["activo"])

    def test_reanudar_continuar_amplia_fecha(self):
        self.client.force_authenticate(user=self.miembro)
        entrega = self.tarea.fecha_entrega_aproximada

        res = self.client.post(self._url(), {"modo": "continuar"}, format="json")

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.subtarea.refresh_from_db()
        self.tarea.refresh_from_db()
        self.assertEqual(self.subtarea.estado, Subtarea.Estado.EN_DESARROLLO)
        self.assertGreater(self.tarea.fecha_entrega_aproximada, entrega)
        log = self._ultimo_standby_fin()
        self.assertIsNotNone(log)
        self.assertFalse(log.standby_excluido)

    def test_reanudar_con_nueva_fecha(self):
        self.client.force_authenticate(user=self.miembro)
        nueva = (timezone.now() + timedelta(days=5)).isoformat()

        res = self.client.post(
            self._url(),
            {"modo": "nueva_fecha", "nueva_fecha_entrega": nueva},
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.tarea.refresh_from_db()
        self.assertGreater(
            self.tarea.fecha_entrega_aproximada,
            timezone.now() + timedelta(days=4),
        )

    def test_reanudar_mantener_no_cambia_fecha(self):
        self.client.force_authenticate(user=self.miembro)
        entrega = self.tarea.fecha_entrega_aproximada

        res = self.client.post(self._url(), {"modo": "mantener"}, format="json")

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.tarea.refresh_from_db()
        self.assertEqual(self.tarea.fecha_entrega_aproximada, entrega)
        log = self._ultimo_standby_fin()
        self.assertIsNotNone(log)
        self.assertFalse(log.standby_excluido)

    def test_reanudar_modo_invalido_falla(self):
        self.client.force_authenticate(user=self.miembro)

        res = self.client.post(self._url(), {"modo": "otro"}, format="json")

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reanudar_fecha_no_posterior_falla(self):
        self.client.force_authenticate(user=self.miembro)
        anterior = (timezone.now() + timedelta(days=1)).isoformat()

        res = self.client.post(
            self._url(),
            {"modo": "nueva_fecha", "nueva_fecha_entrega": anterior},
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class LogsClienteTestCase(APITestCase):

    def setUp(self):
        self.lider = _crear_usuario("lider-logs@empresa.com")
        self.cliente = _crear_usuario("cliente-logs@empresa.com")
        _asignar_rol(self.cliente, "CLIENTE")
        self.otro_cliente = _crear_usuario("otro-logs@empresa.com")
        _asignar_rol(self.otro_cliente, "CLIENTE")

        campana = Campana.objects.create(nombre="C L", codigo="CAMP_L")
        sub = SubCampana.objects.create(campana=campana, nombre="S L", codigo="SUB_L")

        self.equipo = Equipo.objects.create(nombre="Equipo L", lider=self.lider)
        self.tarea = Tarea.objects.create(
            asunto="Tarea L",
            descripcion="d",
            subcampana=sub,
            estado=Tarea.Estado.EN_DESARROLLO,
            equipo=self.equipo,
            solicitante=self.cliente,
        )

        # Evento de solicitud (visible) y evento interno de subtarea (no visible).
        TareaLog.objects.create(
            tarea=self.tarea,
            tipo_evento=TareaLog.TipoEvento.CREACION,
            estado_nuevo="EN_ESPERA",
        )
        subtarea = Subtarea.objects.create(
            tarea=self.tarea, descripcion="Sub", asignado=self.lider, peso=1
        )
        TareaLog.objects.create(
            tarea=self.tarea,
            subtarea=subtarea,
            tipo_evento=TareaLog.TipoEvento.CAMBIO_ASIGNADO,
            detalle="interno",
        )

    def test_cliente_solicitante_ve_solo_eventos_de_solicitud(self):
        self.client.force_authenticate(user=self.cliente)

        res = self.client.get(reverse("task-logs", args=[self.tarea.id]))

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        eventos = {l["tipo_evento"] for l in res.data}
        self.assertIn("CREACION", eventos)
        self.assertNotIn("CAMBIO_ASIGNADO", eventos)
        self.assertTrue(all(l["subtarea_id"] is None for l in res.data))
        self.assertTrue(all(l["usuario"] is None for l in res.data))
        self.assertTrue(all(l["detalle"] == "" for l in res.data))

    def test_otro_cliente_no_ve_logs(self):
        self.client.force_authenticate(user=self.otro_cliente)

        res = self.client.get(reverse("task-logs", args=[self.tarea.id]))

        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)
