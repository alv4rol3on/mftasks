from django.db import migrations


ROLES_JERARQUIA = [
    ("GERENTE", "Aprueba solicitudes como primer nivel de la cadena"),
    ("SUBGERENTE", "Aprueba solicitudes como segundo nivel de la cadena"),
    ("COORDINADOR", "Aprueba solicitudes como tercer nivel de la cadena"),
    ("JEFE", "Aprueba o rechaza definitivamente las solicitudes"),
    ("ASISTENTE", "Puede ver y completar sus subtareas asignadas"),
]


def crear_roles_jerarquia(apps, schema_editor):
    Rol = apps.get_model("usuarios", "Rol")
    for nombre, descripcion in ROLES_JERARQUIA:
        rol = Rol.objects.filter(nombre__iexact=nombre).first()
        if rol is None:
            Rol.objects.create(
                nombre=nombre,
                descripcion=descripcion,
                activo=True,
            )
        elif not rol.descripcion:
            rol.descripcion = descripcion
            rol.save(update_fields=["descripcion"])


def borrar_roles_jerarquia(apps, schema_editor):
    Rol = apps.get_model("usuarios", "Rol")
    Rol.objects.filter(
        nombre__iexact__in=[nombre for nombre, _ in ROLES_JERARQUIA]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0018_preferencianotificacion_equipo_hora_alerta_diaria"),
    ]

    operations = [
        migrations.RunPython(crear_roles_jerarquia, borrar_roles_jerarquia),
    ]
