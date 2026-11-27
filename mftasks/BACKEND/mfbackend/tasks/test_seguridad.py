import tempfile
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.http import Http404
from django.test import RequestFactory, TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from campanas.models import Campana, SubCampana
from usuarios.models import (
    Equipo,
    EquipoMiembro,
    Nivel,
    TipoUsuario,
    User,
    UserNivel,
)

from .models import Subtarea, Tarea
from .services.cancelacion import cancelar_tarea
from .views import _cuota_imagenes_usuario


def _crear_usuario(email, nombres="X", apellidos="Y", **extra):
    return User.objects.create_user(
        email=email,
        nombres=nombres,
        apellidos=apellidos,
        password="segura-123",
        **extra,
    )


class _BaseTareas(APITestCase):
    def setUp(self):
        self.admin = _crear_usuario(
            "admin-seg@empresa.com",
            tipo_usuario=TipoUsuario.ADMINISTRADOR,
        )
        self.lider = _crear_usuario("lider-seg@empresa.com", "Líder", "Seg")
        self.miembro = _crear_usuario(
            "miembro-seg@empresa.com", "Miembro", "Seg"
        )

        self.campana = Campana.objects.create(
            nombre="Campana Seg", codigo="CAMP_SEG"
        )
        self.sub = SubCampana.objects.create(
            campana=self.campana, nombre="Sub Seg", codigo="SUB_SEG"
        )
        self.equipo = Equipo.objects.create(
            nombre="Equipo Seg", lider=self.lider
        )
        EquipoMiembro.objects.create(
            equipo=self.equipo, usuario=self.miembro
        )

        self.tarea = Tarea.objects.create(
            asunto="Solicitud Seg",
            descripcion="d",
            subcampana=self.sub,
            estado=Tarea.Estado.EN_ESPERA,
            equipo=self.equipo,
            solicitante=self.lider,
        )


class GuardsEstadoTestCase(_BaseTareas):
    def test_aprobar_cancelada_no_muta_estado(self):
        cancelar_tarea(self.tarea, self.admin, "cancelada")

        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            reverse("task-aprobar", args=[self.tarea.id])
        )

        self.assertIn(
            res.status_code,
            (status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN),
        )
        self.tarea.refresh_from_db()
        self.assertEqual(self.tarea.estado, Tarea.Estado.CANCELADO)

    def test_iniciar_cancelada_no_muta_estado(self):
        cancelar_tarea(self.tarea, self.admin, "cancelada")

        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            reverse("task-iniciar", args=[self.tarea.id]), {}
        )

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.tarea.refresh_from_db()
        self.assertEqual(self.tarea.estado, Tarea.Estado.CANCELADO)

    def test_aprobar_con_plazo_vencido_rechaza_automaticamente(self):
        Tarea.objects.filter(pk=self.tarea.pk).update(
            fecha_limite_aprobacion=timezone.now() - timedelta(hours=1)
        )

        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            reverse("task-aprobar", args=[self.tarea.id])
        )

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.tarea.refresh_from_db()
        self.assertEqual(self.tarea.estado, Tarea.Estado.RECHAZADO)

    def test_agregar_subtarea_en_espera_rechazado(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            reverse("task-agregar-subtarea", args=[self.tarea.id]),
            {"descripcion": "Subtarea", "asignado": self.miembro.id},
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            Subtarea.objects.filter(tarea=self.tarea).exists()
        )

    def test_empezar_subtarea_en_espera_rechazado(self):
        subtarea = Subtarea.objects.create(
            tarea=self.tarea,
            descripcion="Subtarea",
            asignado=self.miembro,
            peso=1,
        )

        self.client.force_authenticate(user=self.miembro)
        res = self.client.post(
            reverse(
                "task-empezar-subtarea",
                args=[self.tarea.id, subtarea.id],
            )
        )

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.tarea.refresh_from_db()
        self.assertEqual(self.tarea.estado, Tarea.Estado.EN_ESPERA)

    def test_completar_subtarea_de_cancelada_rechazado(self):
        self.tarea.estado = Tarea.Estado.EN_DESARROLLO
        self.tarea.save(update_fields=["estado"])

        subtarea = Subtarea.objects.create(
            tarea=self.tarea,
            descripcion="Subtarea",
            asignado=self.miembro,
            peso=1,
            estado=Subtarea.Estado.EN_DESARROLLO,
            fecha_inicio=timezone.now(),
        )

        cancelar_tarea(self.tarea, self.admin, "cancelada")

        self.client.force_authenticate(user=self.miembro)
        res = self.client.post(
            reverse(
                "task-completar-subtarea",
                args=[self.tarea.id, subtarea.id],
            )
        )

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.tarea.refresh_from_db()
        self.assertEqual(self.tarea.estado, Tarea.Estado.CANCELADO)

    def test_reactivar_subtarea_de_cancelada_rechazado(self):
        self.tarea.estado = Tarea.Estado.EN_DESARROLLO
        self.tarea.save(update_fields=["estado"])

        subtarea = Subtarea.objects.create(
            tarea=self.tarea,
            descripcion="Subtarea",
            asignado=self.miembro,
            peso=1,
            estado=Subtarea.Estado.EN_DESARROLLO,
        )
        subtarea.activo = False
        subtarea.save(update_fields=["activo"])

        cancelar_tarea(self.tarea, self.admin, "cancelada")

        self.client.force_authenticate(user=self.admin)
        res = self.client.post(
            reverse(
                "task-reactivar-subtarea",
                args=[self.tarea.id, subtarea.id],
            )
        )

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        subtarea.refresh_from_db()
        self.assertFalse(subtarea.activo)


class MediaDescripcionesTestCase(TestCase):
    def test_traversal_a_tareas_es_rechazado(self):
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "descripciones").mkdir()
            Path(tmp, "tareas").mkdir()
            Path(tmp, "tareas", "privado.txt").write_text(
                "contenido-privado", encoding="utf-8"
            )
            Path(tmp, "descripciones", "publica.txt").write_text(
                "contenido-publico", encoding="utf-8"
            )

            with override_settings(MEDIA_ROOT=tmp):
                from mfbackend.urls import servir_descripcion

                request = RequestFactory().get("/media/x")

                for path in (
                    "descripciones/../tareas/privado.txt",
                    "descripciones\\..\\tareas\\privado.txt",
                    "tareas/privado.txt",
                    "descripciones/../../privado.txt",
                ):
                    with self.assertRaises(Http404):
                        servir_descripcion(request, path)

                respuesta = servir_descripcion(
                    request, "descripciones/publica.txt"
                )
                self.assertEqual(respuesta.status_code, 200)
                respuesta.close()


class CuotaImagenesTestCase(_BaseTareas):
    def test_cuota_detecta_archivos_del_usuario(self):
        with tempfile.TemporaryDirectory() as tmp:
            directorio = Path(tmp, "descripciones", str(self.admin.id))
            directorio.mkdir(parents=True)
            (directorio / "a.png").write_bytes(b"1234")
            (directorio / "b.png").write_bytes(b"12")

            with override_settings(MEDIA_ROOT=tmp):
                cantidad, total = _cuota_imagenes_usuario(self.admin)

            self.assertEqual(cantidad, 2)
            self.assertEqual(total, 6)

    def test_subida_rechazada_al_exceder_cantidad(self):
        with tempfile.TemporaryDirectory() as tmp:
            with override_settings(
                MEDIA_ROOT=tmp,
                DESCRIPCION_MAX_IMAGENES_POR_USUARIO=1,
            ), patch(
                "tasks.views.default_storage",
                FileSystemStorage(location=tmp),
            ):
                nivel, _ = Nivel.objects.get_or_create(
                    nombre="NIVEL_SOLICITANTE_SEG",
                    defaults={"puede_crear_solicitudes": True},
                )
                UserNivel.objects.get_or_create(
                    usuario=self.lider,
                    nivel=nivel,
                )
                self.client.force_authenticate(user=self.lider)

                def subir(nombre):
                    return self.client.post(
                        reverse("task-subir-imagen"),
                        {
                            "imagen": SimpleUploadedFile(
                                nombre,
                                b"\x89PNG\r\n\x1a\n" + b"contenido",
                                content_type="image/png",
                            )
                        },
                        format="multipart",
                    )

                primera = subir("uno.png")
                segunda = subir("dos.png")

        self.assertEqual(
            primera.status_code, status.HTTP_201_CREATED, primera.data
        )
        self.assertEqual(
            segunda.status_code, status.HTTP_400_BAD_REQUEST, segunda.data
        )
