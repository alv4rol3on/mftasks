from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from usuarios.models import Equipo, EquipoMiembro, User

from .models import Subtarea, Tarea, TareaLog
from .services.confirmacion import confirmar_automaticamente


class ClienteAccionesTestCase(APITestCase):
    def setUp(self):
        self.cliente = User.objects.create_user(
            email="cliente@test.com",
            nombres="Cliente",
            apellidos="Uno",
            password="segura-123",
            tipo_usuario="CLIENTE",
        )
        self.otro_cliente = User.objects.create_user(
            email="otro@test.com",
            nombres="Otro",
            apellidos="Cliente",
            password="segura-123",
            tipo_usuario="CLIENTE",
        )
        self.lider = User.objects.create_user(
            email="lider@test.com",
            nombres="Lider",
            apellidos="Equipo",
            password="segura-123",
        )
        self.equipo = Equipo.objects.create(nombre="Equipo Cliente", lider=self.lider)
        self.tarea = Tarea.objects.create(
            asunto="Solicitud cliente",
            descripcion="Descripcion",
            equipo=self.equipo,
            solicitante=self.cliente,
            estado=Tarea.Estado.EN_ESPERA,
        )

    def _auth(self, user=None):
        self.client.force_authenticate(user=user or self.cliente)

    def test_cliente_cancela_antes_de_iniciar(self):
        self._auth()
        res = self.client.delete(
            f"/api/tasks/tasks/{self.tarea.id}/",
            {"motivo_cancelacion": "Ya no lo necesito"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.tarea.refresh_from_db()
        self.assertEqual(self.tarea.estado, Tarea.Estado.CANCELADO)
        self.assertFalse(self.tarea.activo)

    def test_cliente_no_cancela_en_desarrollo(self):
        self.tarea.estado = Tarea.Estado.EN_DESARROLLO
        self.tarea.save(update_fields=["estado"])
        self._auth()
        res = self.client.delete(
            f"/api/tasks/tasks/{self.tarea.id}/",
            {"motivo_cancelacion": "Ya no lo necesito"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.tarea.refresh_from_db()
        self.assertEqual(self.tarea.estado, Tarea.Estado.EN_DESARROLLO)

    def test_otro_cliente_no_cancela(self):
        self._auth(self.otro_cliente)
        res = self.client.delete(
            f"/api/tasks/tasks/{self.tarea.id}/",
            {"motivo_cancelacion": "No es mía"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_cliente_agrega_informacion_y_archivo(self):
        self._auth()
        archivo = SimpleUploadedFile("nota.txt", b"contenido", content_type="text/plain")
        res = self.client.post(
            f"/api/tasks/tasks/{self.tarea.id}/informacion-adicional/",
            {"detalle": "Adjunto información", "archivos": archivo},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        log = TareaLog.objects.get(
            tarea=self.tarea,
            tipo_evento=TareaLog.TipoEvento.INFORMACION_ADICIONAL,
        )
        self.assertTrue(
            TareaLog.objects.filter(
                tarea=self.tarea,
                tipo_evento=TareaLog.TipoEvento.INFORMACION_ADICIONAL,
            ).exists()
        )
        self.assertEqual(self.tarea.archivos.count(), 1)
        self.assertEqual(self.tarea.archivos.first().informacion_log_id, log.id)

    def test_cliente_ve_su_informacion_agregada(self):
        self._auth()
        archivo = SimpleUploadedFile("mi-dato.txt", b"dato", content_type="text/plain")
        res = self.client.post(
            f"/api/tasks/tasks/{self.tarea.id}/informacion-adicional/",
            {"detalle": "Mi nota", "archivos": archivo},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        res = self.client.get(
            f"/api/tasks/tasks/{self.tarea.id}/informacion-cliente/"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["detalle"], "Mi nota")
        self.assertEqual(len(res.data[0]["archivos"]), 1)

    def test_miembro_del_equipo_ve_informacion_cliente(self):
        miembro = User.objects.create_user(
            email="miembro@test.com",
            nombres="Miembro",
            apellidos="Equipo",
            password="segura-123",
        )
        EquipoMiembro.objects.create(equipo=self.equipo, usuario=miembro)
        self._auth()
        archivo = SimpleUploadedFile("datos.txt", b"datos", content_type="text/plain")
        res = self.client.post(
            f"/api/tasks/tasks/{self.tarea.id}/informacion-adicional/",
            {"detalle": "Datos faltantes", "archivos": archivo},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self._auth(miembro)
        res = self.client.get(
            f"/api/tasks/tasks/{self.tarea.id}/informacion-cliente/"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]["detalle"], "Datos faltantes")
        self.assertEqual(len(res.data[0]["archivos"]), 1)
        self.assertEqual(res.data[0]["archivos"][0]["nombre"], "datos.txt")

    def test_informacion_rechaza_extension(self):
        self._auth()
        archivo = SimpleUploadedFile("malware.exe", b"x", content_type="application/octet-stream")
        res = self.client.post(
            f"/api/tasks/tasks/{self.tarea.id}/informacion-adicional/",
            {"archivos": archivo},
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def _tarea_solucionada(self, **kwargs):
        ahora = timezone.localtime(timezone.now())
        datos = {
            "asunto": "Solucionada",
            "descripcion": "Descripcion",
            "equipo": self.equipo,
            "solicitante": self.cliente,
            "estado": Tarea.Estado.SOLUCIONADO,
            "fecha_solucion": ahora,
            "confirmacion_cliente": Tarea.ConfirmacionCliente.PENDIENTE,
            "fecha_limite_confirmacion": ahora + timedelta(days=5),
        }
        datos.update(kwargs)
        return Tarea.objects.create(**datos)

    def test_cliente_confirma_solucion(self):
        tarea = self._tarea_solucionada()
        self._auth()
        res = self.client.post(f"/api/tasks/tasks/{tarea.id}/confirmar-solucion/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        tarea.refresh_from_db()
        self.assertEqual(tarea.confirmacion_cliente, "CONFIRMADA")
        self.assertIsNotNone(tarea.fecha_confirmacion_cliente)
        self.assertTrue(
            TareaLog.objects.filter(
                tarea=tarea,
                tipo_evento=TareaLog.TipoEvento.CONFIRMACION_CLIENTE,
            ).exists()
        )

    def test_cliente_reabre_y_crea_subtarea(self):
        tarea = self._tarea_solucionada()
        self._auth()
        res = self.client.post(
            f"/api/tasks/tasks/{tarea.id}/reabrir/",
            {"motivo": "El error continúa"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        tarea.refresh_from_db()
        self.assertEqual(tarea.estado, Tarea.Estado.EN_DESARROLLO)
        self.assertEqual(tarea.reaperturas_cliente, 1)
        self.assertEqual(tarea.confirmacion_cliente, "REABIERTA")
        self.assertTrue(
            Subtarea.objects.filter(
                tarea=tarea,
                descripcion__icontains="El error continúa",
            ).exists()
        )

    def test_reabrir_respeta_maximo(self):
        tarea = self._tarea_solucionada(reaperturas_cliente=2)
        self._auth()
        res = self.client.post(
            f"/api/tasks/tasks/{tarea.id}/reabrir/",
            {"motivo": "Otra vez"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reabrir_fuera_de_plazo(self):
        tarea = self._tarea_solucionada(
            fecha_limite_confirmacion=timezone.now() - timedelta(minutes=1)
        )
        self._auth()
        res = self.client.post(
            f"/api/tasks/tasks/{tarea.id}/reabrir/",
            {"motivo": "Tarde"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirmacion_automatica_vencida(self):
        tarea = self._tarea_solucionada(
            fecha_limite_confirmacion=timezone.now() - timedelta(minutes=1)
        )
        confirmar_automaticamente(tarea)
        tarea.refresh_from_db()
        self.assertEqual(tarea.confirmacion_cliente, "CONFIRMADA")
        self.assertTrue(
            TareaLog.objects.filter(
                tarea=tarea,
                tipo_evento=TareaLog.TipoEvento.CONFIRMACION_AUTOMATICA,
            ).exists()
        )

    def test_constancia_pdf(self):
        self._auth()
        res = self.client.get(f"/api/tasks/tasks/{self.tarea.id}/constancia/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res["Content-Type"], "application/pdf")
        self.assertTrue(res.content.startswith(b"%PDF"))

    def test_detalle_expone_explicacion_y_permisos(self):
        self._auth()
        res = self.client.get(f"/api/tasks/tasks/{self.tarea.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("estado_explicado", res.data)
        self.assertIn("siguiente_paso", res.data)
        self.assertTrue(res.data["puede_cancelar"])
        self.assertFalse(res.data["puede_confirmar_solucion"])

    def test_lider_puede_actualizar_triage(self):
        self._auth(self.lider)
        res = self.client.patch(
            f"/api/tasks/tasks/{self.tarea.id}/triage/",
            {
                "prioridad": "ALTA",
                "severidad": "CRITICA",
                "impacto": "ALTO",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.tarea.refresh_from_db()
        self.assertEqual(self.tarea.prioridad, "ALTA")
        self.assertEqual(self.tarea.severidad, "CRITICA")
        self.assertEqual(self.tarea.impacto, "ALTO")
        self.assertTrue(
            TareaLog.objects.filter(
                tarea=self.tarea,
                tipo_evento=TareaLog.TipoEvento.CAMBIO_PRIORIDAD,
            ).exists()
        )

    def test_sugerencias_asignacion_por_carga(self):
        miembro1 = User.objects.create_user(
            email="miembro1@test.com",
            nombres="Ana",
            apellidos="Uno",
            password="segura-123",
        )
        miembro2 = User.objects.create_user(
            email="miembro2@test.com",
            nombres="Beto",
            apellidos="Dos",
            password="segura-123",
        )
        EquipoMiembro.objects.create(equipo=self.equipo, usuario=miembro1)
        EquipoMiembro.objects.create(equipo=self.equipo, usuario=miembro2)

        otra_tarea = Tarea.objects.create(
            asunto="Carga previa",
            descripcion="Carga",
            equipo=self.equipo,
            estado=Tarea.Estado.EN_DESARROLLO,
        )
        Subtarea.objects.create(
            tarea=otra_tarea,
            descripcion="Trabajo cargado",
            asignado=miembro1,
            peso=10,
            estado=Subtarea.Estado.EN_DESARROLLO,
        )
        Subtarea.objects.create(
            tarea=self.tarea,
            descripcion="Nueva subtarea",
            asignado=miembro1,
            peso=1,
            estado=Subtarea.Estado.EN_ESPERA,
        )

        self._auth(self.lider)
        res = self.client.get(
            f"/api/tasks/tasks/{self.tarea.id}/sugerencias-asignacion/"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertNotEqual(res.data[0]["sugerido"], miembro1.id)
        self.assertIn(res.data[0]["sugerido"], {self.lider.id, miembro2.id})

    def test_lider_reabre_subtarea_solucionada(self):
        subtarea = Subtarea.objects.create(
            tarea=self.tarea,
            descripcion="Trabajo solucionado",
            asignado=self.lider,
            peso=1,
            estado=Subtarea.Estado.SOLUCIONADO,
        )
        self.tarea.estado = Tarea.Estado.SOLUCIONADO
        self.tarea.fecha_solucion = timezone.now()
        self.tarea.save(update_fields=["estado", "fecha_solucion"])

        self._auth(self.lider)
        res = self.client.post(
            f"/api/tasks/tasks/{self.tarea.id}/subtareas/{subtarea.id}/reabrir/",
            {"motivo": "El cliente reportó un error"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        subtarea.refresh_from_db()
        self.tarea.refresh_from_db()
        self.assertEqual(subtarea.estado, Subtarea.Estado.EN_DESARROLLO)
        self.assertEqual(self.tarea.estado, Tarea.Estado.EN_DESARROLLO)
        self.assertIsNone(self.tarea.fecha_solucion)
        self.assertEqual(self.tarea.confirmacion_cliente, "REABIERTA")
        self.assertTrue(
            TareaLog.objects.filter(
                tarea=self.tarea,
                subtarea=subtarea,
                tipo_evento=TareaLog.TipoEvento.REAPERTURA,
            ).exists()
        )

    def test_reabrir_subtarea_requiere_motivo(self):
        subtarea = Subtarea.objects.create(
            tarea=self.tarea,
            descripcion="Trabajo solucionado",
            asignado=self.lider,
            peso=1,
            estado=Subtarea.Estado.SOLUCIONADO,
        )
        self._auth(self.lider)
        res = self.client.post(
            f"/api/tasks/tasks/{self.tarea.id}/subtareas/{subtarea.id}/reabrir/",
            {},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
