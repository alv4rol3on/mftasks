from django.db import migrations


def eliminar_rol_asistente(apps, schema_editor):
    """Elimina el rol ASISTENTE si existe y no está en uso.

    El rol quedó obsoleto (los miembros y sub-líderes cubren sus casos) y hoy no
    tiene usuarios ni referencias. Se conservan salvaguardas por si en algún
    entorno sí estuviera en uso.
    """
    Rol = apps.get_model("usuarios", "Rol")
    UserRol = apps.get_model("usuarios", "UserRol")
    Equipo = apps.get_model("usuarios", "Equipo")
    EquipoAprobador = apps.get_model("usuarios", "EquipoAprobador")

    rol = Rol.objects.filter(nombre__iexact="ASISTENTE").first()
    if rol is None:
        return

    if UserRol.objects.filter(rol=rol).exists():
        return
    if Rol.objects.filter(superior=rol).exists():
        return
    if Equipo.objects.filter(rol_equipo=rol).exists():
        return
    if EquipoAprobador.objects.filter(rol_aprobador=rol).exists():
        return

    rol.delete()


def revertir(apps, schema_editor):
    Rol = apps.get_model("usuarios", "Rol")
    Rol.objects.get_or_create(
        nombre="ASISTENTE",
        defaults={
            "descripcion": "Puede ver y completar sus subtareas asignadas",
            "activo": True,
            "puede_liderar": False,
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0028_remove_equipoaprobador_unico_aprobador_por_rol"),
    ]

    operations = [
        migrations.RunPython(eliminar_rol_asistente, revertir),
    ]
