from django.db import migrations


def seed_bbva(apps, schema_editor):
    Cliente = apps.get_model("clientes", "Cliente")
    Campana = apps.get_model("campanas", "Campana")
    SubCampana = apps.get_model("campanas", "SubCampana")

    # Crear cliente BBVA si no existe
    cliente, _ = Cliente.objects.get_or_create(
        nombre="BBVA",
        defaults={"razon_social": "BBVA", "activo": True, "correo": "", "telefono": "", "direccion": ""},
    )
    campana, _ = Campana.objects.get_or_create(
        cliente=cliente,
        nombre="BBVA",
        defaults={"codigo": "BBVA", "activo": True},
    )
    subcampanas = [
        "Tarjetas Out",
        "Tarjetas Híbrido",
        "Portafolio Out",
        "Operaciones Out",
        "Operaciones Híbrido",
        "Prestamos Out",
        "Prestamos Híbrido",
        "Tarjetas Start",
    ]
    for nombre in subcampanas:
        codigo = f"BBVA_{nombre.upper().replace(' ', '_').replace('Í','I')}"[:40]
        SubCampana.objects.get_or_create(
            campana=campana,
            nombre=nombre,
            defaults={"codigo": codigo, "activo": True},
        )


def unseed(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("campanas", "0001_initial"),
        ("clientes", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_bbva, unseed),
    ]
