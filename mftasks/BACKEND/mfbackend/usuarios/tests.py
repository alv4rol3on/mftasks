from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from campanas.models import Campana, SubCampana

from .azure import AzureTokenValidationError
from .models import Equipo, EquipoAprobador, EquipoMiembro, Rol, User, UserRol


def _crear_usuario(email, nombres="X", apellidos="Y"):
    return User.objects.create_user(
        email=email,
        nombres=nombres,
        apellidos=apellidos,
        password="segura-123",
    )


def _asignar_rol(user, nombre):
    rol = Rol.objects.filter(nombre__iexact=nombre).first()
    if rol is None:
        rol = Rol.objects.create(nombre=nombre)
    return UserRol.objects.get_or_create(usuario=user, rol=rol)


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
        return_value={
            "azure_id": "08a3b2c1-0000-0000-0000-000000000002",
            "email": "jose@empresa.com",
            "nombres": "José Pérez",
        },
    )
    def test_login_ignora_sesion_django_autenticada(self, mock_validar):
        # Con una sesión Django activa (cookie sessionid) el login JWT no debe
        # fallar por CSRF: DRF ya no usa SessionAuthentication.
        self.assertTrue(
            self.client.login(
                email="jose@empresa.com",
                password="clave-segura-123",
            )
        )

        respuesta = self.client.post(
            self.url_login,
            {"access_token": "token-azure-falso"},
            format="json",
        )

        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertIn("access", respuesta.data)

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

        self.usuario.is_active = False
        self.usuario.save(update_fields=["is_active"])

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


class EquipoVisibilidadTestCase(APITestCase):

    def setUp(self):
        self.lider_a = User.objects.create_user(
            email="lidera@empresa.com", nombres="Líder", apellidos="A", password="x"
        )
        self.lider_b = User.objects.create_user(
            email="liderb@empresa.com", nombres="Líder", apellidos="B", password="x"
        )
        self.miembro = User.objects.create_user(
            email="miembro@empresa.com", nombres="Miem", apellidos="Bro", password="x"
        )

        self.equipo_a = Equipo.objects.create(nombre="Equipo A", lider=self.lider_a)
        self.equipo_b = Equipo.objects.create(nombre="Equipo B", lider=self.lider_b)

        EquipoMiembro.objects.create(equipo=self.equipo_a, usuario=self.miembro)

    def test_miembro_ve_todos_los_equipos(self):
        self.client.force_authenticate(user=self.miembro)

        res = self.client.get(reverse("equipo-list"))

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data if isinstance(res.data, list) else res.data.get("results", [])
        ids = {e["id"] for e in data}
        self.assertEqual(ids, {self.equipo_a.id, self.equipo_b.id})


class EquipoTipoTestCase(APITestCase):

    def test_tipo_equipo_se_deriva_del_rol(self):
        gerente = _crear_usuario("g@empresa.com")
        _asignar_rol(gerente, "GERENTE")
        jefe = _crear_usuario("j@empresa.com")
        _asignar_rol(jefe, "JEFE")
        gtr = _crear_usuario("t@empresa.com")
        _asignar_rol(gtr, "GTR")

        self.assertEqual(
            Equipo.objects.create(nombre="Eq G", lider=gerente).tipo_equipo,
            "GERENTE",
        )
        self.assertEqual(
            Equipo.objects.create(nombre="Eq J", lider=jefe).tipo_equipo,
            "JEFE",
        )
        self.assertEqual(
            Equipo.objects.create(nombre="Eq T", lider=gtr).tipo_equipo,
            "GTR",
        )

    def test_lider_no_ve_equipos_de_sus_integrantes(self):
        """Se eliminó la visibilidad hacia abajo: el líder solo ve sus equipos."""
        from .permissions import ids_equipos_visibles

        jefe = _crear_usuario("jefe@empresa.com")
        _asignar_rol(jefe, "JEFE")
        gtr = _crear_usuario("gtr@empresa.com")
        _asignar_rol(gtr, "GTR")

        equipo_jefe = Equipo.objects.create(nombre="Eq Jefe", lider=jefe)
        equipo_gtr = Equipo.objects.create(nombre="Eq GTR", lider=gtr)

        EquipoMiembro.objects.create(equipo=equipo_jefe, usuario=gtr)

        visibles = ids_equipos_visibles(jefe)
        self.assertIn(equipo_jefe.id, visibles)
        self.assertNotIn(equipo_gtr.id, visibles)


class EquipoCreacionPermisosTestCase(APITestCase):

    def setUp(self):
        self.admin = _crear_usuario("adminc@empresa.com")
        _asignar_rol(self.admin, "Administrador")
        self.gtr = _crear_usuario("gtrc@empresa.com")
        _asignar_rol(self.gtr, "GTR")
        self.miembro = _crear_usuario("miembroc@empresa.com")
        _asignar_rol(self.miembro, "miembro")

    def test_no_admin_no_puede_crear_equipo(self):
        self.client.force_authenticate(user=self.gtr)

        res = self.client.post(
            reverse("equipo-list"),
            {"nombre": "Equipo propio", "lider": self.gtr.codigo},
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_miembro_no_puede_crear_equipo(self):
        self.client.force_authenticate(user=self.miembro)

        res = self.client.post(
            reverse("equipo-list"),
            {"nombre": "No permitido", "lider": self.miembro.codigo},
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_crea_con_lider_elegible(self):
        self.client.force_authenticate(user=self.admin)

        res = self.client.post(
            reverse("equipo-list"),
            {"nombre": "Equipo admin", "lider": self.gtr.codigo},
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        equipo = Equipo.objects.get(nombre="Equipo admin")
        self.assertEqual(equipo.lider_id, self.gtr.id)

    def test_admin_requiere_lider(self):
        self.client.force_authenticate(user=self.admin)

        res = self.client.post(
            reverse("equipo-list"),
            {"nombre": "Sin lider"},
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_rechaza_lider_no_elegible(self):
        self.client.force_authenticate(user=self.admin)

        res = self.client.post(
            reverse("equipo-list"),
            {"nombre": "Equipo invalido", "lider": self.miembro.codigo},
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class AsignarAprobadoresTestCase(APITestCase):

    def setUp(self):
        self.admin = _crear_usuario("adminap@empresa.com")
        _asignar_rol(self.admin, "Administrador")
        self.lider = _crear_usuario("liderap@empresa.com")
        _asignar_rol(self.lider, "GTR")
        self.equipo = Equipo.objects.create(nombre="Equipo AP", lider=self.lider)

        self.gerente = _crear_usuario("gerap@empresa.com")
        _asignar_rol(self.gerente, "GERENTE")
        self.subgerente = _crear_usuario("subap@empresa.com")
        _asignar_rol(self.subgerente, "SUBGERENTE")
        self.jefe = _crear_usuario("jefeap@empresa.com")
        _asignar_rol(self.jefe, "JEFE")
        self.miembro = _crear_usuario("miempap@empresa.com")
        _asignar_rol(self.miembro, "miembro")

        self.lider_jefe = _crear_usuario("liderjefeap@empresa.com")
        _asignar_rol(self.lider_jefe, "JEFE")
        self.equipo_jefe = Equipo.objects.create(nombre="Equipo Jefe AP", lider=self.lider_jefe)

        self.lider_sub = _crear_usuario("lidersubap@empresa.com")
        _asignar_rol(self.lider_sub, "SUBGERENTE")
        self.equipo_sub = Equipo.objects.create(nombre="Equipo Sub AP", lider=self.lider_sub)

        self.lider_ger = _crear_usuario("lidergera@empresa.com")
        _asignar_rol(self.lider_ger, "GERENTE")
        self.equipo_ger = Equipo.objects.create(nombre="Equipo Ger AP", lider=self.lider_ger)

    def _post(self, equipo, aprobadores):
        return self.client.post(
            reverse("equipo-asignar-aprobadores", args=[equipo.id]),
            {"aprobadores": aprobadores},
            format="json",
        )

    def test_admin_asigna_un_aprobador_en_gtr(self):
        self.client.force_authenticate(user=self.admin)
        res = self._post(self.equipo, [{"rol": "GERENTE", "codigo": self.gerente.codigo}])
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(self.equipo.aprobadores.count(), 1)

    def test_admin_asigna_los_tres_roles_en_gtr(self):
        self.client.force_authenticate(user=self.admin)
        res = self._post(self.equipo, [
            {"rol": "GERENTE", "codigo": self.gerente.codigo},
            {"rol": "SUBGERENTE", "codigo": self.subgerente.codigo},
            {"rol": "JEFE", "codigo": self.jefe.codigo},
        ])
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(
            set(self.equipo.aprobadores.values_list("rol_aprobador__nombre", flat=True)),
            {"GERENTE", "SUBGERENTE", "JEFE"},
        )

    def test_permite_varios_aprobadores_del_mismo_rol(self):
        self.client.force_authenticate(user=self.admin)
        otro_jefe = _crear_usuario("otrojefeap@empresa.com")
        _asignar_rol(otro_jefe, "JEFE")
        res = self._post(self.equipo, [
            {"rol": "JEFE", "codigo": self.jefe.codigo},
            {"rol": "JEFE", "codigo": otro_jefe.codigo},
        ])
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(self.equipo.aprobadores.count(), 2)

    def test_no_permite_administrador_como_aprobador(self):
        self.client.force_authenticate(user=self.admin)
        admin2 = _crear_usuario("admin2ap@empresa.com")
        _asignar_rol(admin2, "Administrador")
        res = self._post(self.equipo, [{"rol": "JEFE", "codigo": admin2.codigo}])
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sin_aprobadores_rechaza(self):
        self.client.force_authenticate(user=self.admin)
        res = self._post(self.equipo, [])
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.equipo.aprobadores.count(), 0)

    def test_usuario_sin_rol_correcto(self):
        self.client.force_authenticate(user=self.admin)
        res = self._post(self.equipo, [{"rol": "JEFE", "codigo": self.miembro.codigo}])
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_lider_no_puede_asignar(self):
        self.client.force_authenticate(user=self.lider)
        res = self._post(self.equipo, [{"rol": "GERENTE", "codigo": self.gerente.codigo}])
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_equipo_jefe_solo_gerente_o_subgerente(self):
        self.client.force_authenticate(user=self.admin)
        res = self._post(self.equipo_jefe, [{"rol": "JEFE", "codigo": self.jefe.codigo}])
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        res = self._post(self.equipo_jefe, [
            {"rol": "GERENTE", "codigo": self.gerente.codigo},
            {"rol": "SUBGERENTE", "codigo": self.subgerente.codigo},
        ])
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(self.equipo_jefe.aprobadores.count(), 2)

    def test_equipo_subgerente_solo_gerente(self):
        self.client.force_authenticate(user=self.admin)
        res = self._post(self.equipo_sub, [{"rol": "SUBGERENTE", "codigo": self.subgerente.codigo}])
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        res = self._post(self.equipo_sub, [{"rol": "GERENTE", "codigo": self.gerente.codigo}])
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(
            set(self.equipo_sub.aprobadores.values_list("rol_aprobador__nombre", flat=True)),
            {"GERENTE"},
        )

    def test_equipo_gerente_no_requiere_aprobadores(self):
        self.client.force_authenticate(user=self.admin)
        res = self._post(self.equipo_ger, [{"rol": "GERENTE", "codigo": self.gerente.codigo}])
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.equipo_ger.aprobadores.count(), 0)


class EquipoBajaMiembroTestCase(APITestCase):

    def setUp(self):
        from tasks.models import Tarea

        self.lider = _crear_usuario("liderbaja@empresa.com")
        _asignar_rol(self.lider, "GTR")
        self.miembro = _crear_usuario("miembrobaja@empresa.com")
        _asignar_rol(self.miembro, "miembro")

        self.equipo = Equipo.objects.create(nombre="Equipo Baja", lider=self.lider)
        self.membresia = EquipoMiembro.objects.create(
            equipo=self.equipo,
            usuario=self.miembro,
            rol_en_equipo=EquipoMiembro.RolEnEquipo.MIEMBRO,
            estado=EquipoMiembro.EstadoMiembro.ACTIVO,
        )

        self.campana = Campana.objects.create(nombre="Camp Baja", codigo="CAMP_BAJA")
        self.sub = SubCampana.objects.create(campana=self.campana, nombre="Sub Baja", codigo="SUB_BAJA")
        self.tarea = Tarea.objects.create(
            asunto="Tarea baja",
            descripcion="d",
            subcampana=self.sub,
            estado=Tarea.Estado.EN_DESARROLLO,
            equipo=self.equipo,
        )

    def _url_estado(self):
        return reverse("equipo-gestionar-estado", args=[self.equipo.id, self.miembro.id])

    def test_baja_elimina_la_membresia(self):
        self.client.force_authenticate(user=self.lider)

        res = self.client.post(self._url_estado(), {"estado": "INACTIVO"}, format="json")

        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertTrue(res.data.get("deleted"))
        self.assertFalse(
            EquipoMiembro.objects.filter(equipo=self.equipo, usuario=self.miembro).exists()
        )

    def test_baja_con_subtareas_pendientes_no_elimina(self):
        from tasks.models import Subtarea

        Subtarea.objects.create(
            tarea=self.tarea,
            descripcion="pendiente",
            asignado=self.miembro,
            peso=1,
            estado=Subtarea.Estado.EN_ESPERA,
        )

        self.client.force_authenticate(user=self.lider)
        res = self.client.post(self._url_estado(), {"estado": "INACTIVO"}, format="json")

        self.assertEqual(res.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(
            EquipoMiembro.objects.filter(equipo=self.equipo, usuario=self.miembro).exists()
        )


class AgregarMiembroRolesTestCase(APITestCase):

    def setUp(self):
        self.jefe = _crear_usuario("jefeeq@empresa.com")
        _asignar_rol(self.jefe, "JEFE")
        self.equipo = Equipo.objects.create(nombre="Equipo Jefe", lider=self.jefe)

        self.gtr = _crear_usuario("gtrmiembro@empresa.com")
        _asignar_rol(self.gtr, "GTR")
        self.equipo_gtr = Equipo.objects.create(nombre="Equipo GTR X", lider=self.gtr)

        self.miembro = _crear_usuario("miembroeq@empresa.com")
        _asignar_rol(self.miembro, "miembro")

        self.cliente = _crear_usuario("clienteeq@empresa.com")
        _asignar_rol(self.cliente, "CLIENTE")

    def test_agregar_gtr_como_miembro(self):
        self.client.force_authenticate(user=self.jefe)

        res = self.client.post(
            reverse("equipo-agregar-miembro", args=[self.equipo.id]),
            {"codigo": self.gtr.codigo},
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertTrue(
            EquipoMiembro.objects.filter(equipo=self.equipo, usuario=self.gtr).exists()
        )

    def test_no_agregar_cliente(self):
        self.client.force_authenticate(user=self.jefe)

        res = self.client.post(
            reverse("equipo-agregar-miembro", args=[self.equipo.id]),
            {"codigo": self.cliente.codigo},
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_no_agregar_miembro_a_equipo_de_jefe(self):
        self.client.force_authenticate(user=self.jefe)

        res = self.client.post(
            reverse("equipo-agregar-miembro", args=[self.equipo.id]),
            {"codigo": self.miembro.codigo},
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_agregar_miembro_a_equipo_gtr(self):
        self.client.force_authenticate(user=self.gtr)

        res = self.client.post(
            reverse("equipo-agregar-miembro", args=[self.equipo_gtr.id]),
            {"codigo": self.miembro.codigo},
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)

    def test_no_agregar_jefe_a_equipo_gtr(self):
        self.client.force_authenticate(user=self.gtr)

        res = self.client.post(
            reverse("equipo-agregar-miembro", args=[self.equipo_gtr.id]),
            {"codigo": self.jefe.codigo},
            format="json",
        )

        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)


class JerarquiaDinamicaTestCase(TestCase):
    """La jerarquía se deriva de Rol.superior, sin niveles numéricos."""

    def _rol(self, nombre):
        return Rol.objects.get(nombre__iexact=nombre)

    def test_cadena_aprobacion_gtr(self):
        from .jerarquia import cadena_aprobacion

        cadena = [r.nombre.upper() for r in cadena_aprobacion(self._rol("GTR"))]
        self.assertEqual(cadena, ["JEFE", "SUBGERENTE", "GERENTE"])

    def test_cadena_no_persiste_herencia(self):
        # La herencia se calcula; solo se almacena la relación directa.
        gtr = self._rol("GTR")
        self.assertEqual(gtr.superior.nombre.upper(), "JEFE")
        self.assertEqual(gtr.subordinados.count(), 1)
        self.assertEqual(gtr.subordinados.first().nombre.upper(), "MIEMBRO")

    def test_roles_al_mismo_nivel_heredan_misma_cadena(self):
        from .jerarquia import cadena_aprobacion

        jefe_chain = [r.nombre.upper() for r in cadena_aprobacion(self._rol("Jefe"))]
        coordinador_chain = [
            r.nombre.upper() for r in cadena_aprobacion(self._rol("Coordinador"))
        ]
        self.assertEqual(coordinador_chain, ["JEFE"] + jefe_chain)

    def test_rol_no_puede_ser_su_propio_superior(self):
        rol = self._rol("Jefe")
        rol.superior = rol
        with self.assertRaises(ValidationError):
            rol.full_clean()

    def test_no_se_permiten_ciclos(self):
        gerente = self._rol("Gerente")
        gerente.superior = self._rol("Jefe")
        with self.assertRaises(ValidationError):
            gerente.full_clean()

    def test_rol_efectivo_y_liderazgo(self):
        from .jerarquia import puede_ser_lider, rol_efectivo

        usuario = _crear_usuario("liderdin@empresa.com")
        _asignar_rol(usuario, "GTR")
        _asignar_rol(usuario, "Gerente")
        # El rol de mayor rango (menor profundidad) es Gerente.
        self.assertEqual(rol_efectivo(usuario).nombre.upper(), "GERENTE")
        self.assertTrue(puede_ser_lider(usuario))

        cliente = _crear_usuario("clientedin@empresa.com")
        cliente.tipo_usuario = "CLIENTE"
        cliente.save(update_fields=["tipo_usuario"])
        self.assertFalse(puede_ser_lider(cliente))

    def test_equipo_deriva_rol_equipo_del_lider(self):
        lider = _crear_usuario("liderrol@empresa.com")
        _asignar_rol(lider, "GTR")
        equipo = Equipo.objects.create(nombre="Equipo Dinamico", lider=lider)
        self.assertIsNotNone(equipo.rol_equipo)
        self.assertEqual(equipo.rol_equipo.nombre.upper(), "GTR")

    def test_aprobadores_de_equipo_desde_cadena(self):
        from .jerarquia import roles_aprobador_de_equipo

        lider = _crear_usuario("lidercad@empresa.com")
        _asignar_rol(lider, "GTR")
        equipo = Equipo.objects.create(nombre="Equipo Cadena", lider=lider)
        nombres = {r.nombre.upper() for r in roles_aprobador_de_equipo(equipo)}
        self.assertEqual(nombres, {"JEFE", "SUBGERENTE", "GERENTE"})

    def test_equipo_aprobador_rechaza_rol_fuera_de_cadena(self):
        lider = _crear_usuario("liderval@empresa.com")
        _asignar_rol(lider, "GTR")
        equipo = Equipo.objects.create(nombre="Equipo Val", lider=lider)
        aprobador = _crear_usuario("aprobval@empresa.com")
        # Gerente SÍ pertenece a la cadena de un equipo GTR.
        valido = EquipoAprobador(
            equipo=equipo,
            usuario=aprobador,
            rol_aprobador=self._rol("Gerente"),
        )
        valido.full_clean()

        # Miembro NO pertenece a la cadena de aprobación.
        invalido = EquipoAprobador(
            equipo=equipo,
            usuario=aprobador,
            rol_aprobador=self._rol("Miembro"),
        )
        with self.assertRaises(ValidationError):
            invalido.full_clean()