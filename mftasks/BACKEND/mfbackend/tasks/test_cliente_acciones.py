from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from usuarios.models import Equipo, User

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
        self.assertTrue(
            TareaLog.objects.filter(
                tarea=self.tarea,
                tipo_evento=TareaLog.TipoEvento.INFORMACION_ADICIONAL,
            ).exists()
        )
        self.assertEqual(self.tarea.archivos.count(), 1)

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
