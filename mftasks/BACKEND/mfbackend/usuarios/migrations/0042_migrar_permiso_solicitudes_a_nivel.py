
from django.db import migrations


def migrar_permisos(apps, schema_editor):
    Nivel = apps.get_model("usuarios", "Nivel")

    for nivel in Nivel.objects.all():
        # Los niveles de sistema no tendrán este permiso.
        if nivel.es_sistema:
            nivel.puede_crear_solicitudes = False
            nivel.save(update_fields=["puede_crear_solicitudes"])
            continue

        # Obtener los usuarios vinculados al nivel.
        asignaciones = nivel.usuarios.select_related("usuario").all()

        # Sin usuarios: el permiso permanece deshabilitado.
        if not asignaciones.exists():
            nivel.puede_crear_solicitudes = False
        else:
            # Solo se habilita si TODOS los usuarios lo tenían habilitado.
            nivel.puede_crear_solicitudes = all(
                asignacion.usuario.puede_crear_solicitudes
                for asignacion in asignaciones
            )

        nivel.save(update_fields=["puede_crear_solicitudes"])


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0041_nivel_puede_crear_solicitudes"),
    ]

    operations = [
        migrations.RunPython(
            migrar_permisos,
            migrations.RunPython.noop,
        ),
    ]
