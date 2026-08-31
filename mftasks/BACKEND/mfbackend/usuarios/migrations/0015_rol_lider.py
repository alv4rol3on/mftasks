from django.db import migrations


def crear_rol_lider(apps, schema_editor):
    Rol = apps.get_model("usuarios", "Rol")
    Rol.objects.get_or_create(nombre="lider", defaults={"descripcion": "Lider de equipo (puede gestionar miembros y tareas)", "activo": True})
    # también asegurar capitalizado si existe con otra capitalización
    if not Rol.objects.filter(nombre__iexact="lider").exists():
        Rol.objects.create(nombre="lider", descripcion="Lider de equipo", activo=True)


def borrar_rol_lider(apps, schema_editor):
    Rol = apps.get_model("usuarios", "Rol")
    Rol.objects.filter(nombre__iexact="lider").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0014_user_codigo"),
    ]

    operations = [
        migrations.RunPython(crear_rol_lider, borrar_rol_lider),
    ]
