from django.db import migrations
from django.contrib.auth.hashers import make_password


# Ejemplos de usuarios tipo cliente con permisos selectivos por subcampaña
# Cada cliente solo ve algunas subcampañas de su campaña, no todas
CLIENTES_EJEMPLO = [
    {
        "email": "cliente.bbva.out@example.com",
        "nombres": "Cliente",
        "apellidos": "BBVA Out",
        "cargo": "Solicitante BBVA",
        "password": "cliente123",
        "campana": "BBVA",
        "subcampanas": ["Tarjetas Out", "Portafolio Out"],  # solo 2 de 8
    },
    {
        "email": "cliente.bbva.hibrido@example.com",
        "nombres": "Cliente",
        "apellidos": "BBVA Hibrido",
        "cargo": "Solicitante BBVA",
        "password": "cliente123",
        "campana": "BBVA",
        "subcampanas": ["Tarjetas Híbrido", "Operaciones Híbrido"],
    },
    {
        "email": "cliente.efe.fonocompras@example.com",
        "nombres": "Cliente",
        "apellidos": "Grupo EFE Fonocompras",
        "cargo": "Solicitante EFE",
        "password": "cliente123",
        "campana": "Grupo EFE",
        "subcampanas": ["Fonocompras", "Recurrente"],
    },
    {
        "email": "cliente.scotiabank@example.com",
        "nombres": "Cliente",
        "apellidos": "Scotiabank",
        "cargo": "Solicitante Scotiabank",
        "password": "cliente123",
        "campana": "Scotiabank",
        "subcampanas": ["Tarjetas Out"],
    },
    {
        "email": "cliente.banbif@example.com",
        "nombres": "Cliente",
        "apellidos": "Banbif",
        "cargo": "Solicitante Banbif",
        "password": "cliente123",
        "campana": "Banbif",
        "subcampanas": ["Préstamos Libre de Disposición"],
    },
    {
        "email": "cliente.unicef@example.com",
        "nombres": "Cliente",
        "apellidos": "Unicef Digital",
        "cargo": "Solicitante Unicef",
        "password": "cliente123",
        "campana": "Unicef",
        "subcampanas": ["Digital"],
    },
    {
        "email": "cliente.bbva.convenios.lima@example.com",
        "nombres": "Cliente",
        "apellidos": "BBVA Convenios Lima",
        "cargo": "Solicitante BBVA Convenios",
        "password": "cliente123",
        "campana": "BBVA Convenios",
        "subcampanas": ["Lima", "Nacional"],
    },
    {
        "email": "cliente.diners@example.com",
        "nombres": "Cliente",
        "apellidos": "Diners",
        "cargo": "Solicitante Diners",
        "password": "cliente123",
        "campana": "Diners",
        "subcampanas": ["TC"],
    },
]


def seed_clientes(apps, schema_editor):
    User = apps.get_model("usuarios", "User")
    Rol = apps.get_model("usuarios", "Rol")
    UserRol = apps.get_model("usuarios", "UserRol")
    Campana = apps.get_model("campanas", "Campana")
    SubCampana = apps.get_model("campanas", "SubCampana")
    PermisoCampana = apps.get_model("campanas", "PermisoCampana")

    try:
        rol_cliente = Rol.objects.get(nombre__iexact="cliente")
    except Rol.DoesNotExist:
        rol_cliente = Rol.objects.create(nombre="cliente", descripcion="Cliente solicitante", activo=True)

    for data in CLIENTES_EJEMPLO:
        user, created = User.objects.get_or_create(
            email=data["email"],
            defaults={
                "nombres": data["nombres"],
                "apellidos": data["apellidos"],
                "cargo": data["cargo"],
                "is_active": True,
                "password": make_password(data["password"]),
            },
        )
        if created:
            # codigo se genera en save, asegurar
            if not user.codigo:
                user.save()
        else:
            # asegurar password y activo
            if not user.is_active:
                user.is_active = True
                user.save(update_fields=["is_active"])
        UserRol.objects.get_or_create(usuario=user, rol=rol_cliente)

        # Permisos: solo subcampañas indicadas
        try:
            campana = Campana.objects.get(nombre=data["campana"])
        except Campana.DoesNotExist:
            continue
        for sub_nombre in data["subcampanas"]:
            try:
                sub = SubCampana.objects.get(campana=campana, nombre=sub_nombre)
                PermisoCampana.objects.get_or_create(usuario=user, subcampana=sub)
            except SubCampana.DoesNotExist:
                continue


def unseed(apps, schema_editor):
    User = apps.get_model("usuarios", "User")
    for data in CLIENTES_EJEMPLO:
        User.objects.filter(email=data["email"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0015_rol_lider"),
        ("campanas", "0003_seed_csc_full"),
    ]

    operations = [
        migrations.RunPython(seed_clientes, unseed),
    ]
