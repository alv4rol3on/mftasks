from django.db import migrations, models


def eliminar_rol_jefe(apps, schema_editor):
    """El rol global JEFE se reemplaza por el líder del equipo de la solicitud."""
    Rol = apps.get_model("usuarios", "Rol")
    UserRol = apps.get_model("usuarios", "UserRol")
    for rol in Rol.objects.filter(nombre__iexact="JEFE"):
        UserRol.objects.filter(rol=rol).delete()
        rol.delete()


def revertir_rol_jefe(apps, schema_editor):
    Rol = apps.get_model("usuarios", "Rol")
    Rol.objects.get_or_create(
        nombre="JEFE",
        defaults={
            "descripcion": "Aprueba o rechaza definitivamente las solicitudes",
            "activo": True,
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0019_roles_jerarquia"),
    ]

    operations = [
        migrations.AddField(
            model_name="preferencianotificacion",
            name="cliente_resumen_diario",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="preferencianotificacion",
            name="aprobador_nueva_solicitud",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="preferencianotificacion",
            name="aprobador_pendiente_revision",
            field=models.BooleanField(default=True),
        ),
        migrations.RunPython(eliminar_rol_jefe, revertir_rol_jefe),
    ]
