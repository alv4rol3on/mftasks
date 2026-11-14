from django.db import migrations


def backfill_rol_equipo(apps, schema_editor):
    """Asegura rol_equipo para equipos creados antes de eliminar tipo_equipo."""
    Equipo = apps.get_model("usuarios", "Equipo")
    UserRol = apps.get_model("usuarios", "UserRol")

    cache = {}

    def profundidad(rol):
        if rol.pk in cache:
            return cache[rol.pk]
        cantidad = 0
        visitados = {rol.pk}
        actual = rol.superior
        while actual is not None and actual.pk not in visitados:
            visitados.add(actual.pk)
            cantidad += 1
            actual = actual.superior
        cache[rol.pk] = cantidad
        return cantidad

    for equipo in Equipo.objects.filter(rol_equipo__isnull=True).iterator():
        if not equipo.lider_id:
            continue
        roles = [
            asignacion.rol
            for asignacion in UserRol.objects.filter(
                usuario_id=equipo.lider_id
            ).select_related("rol")
            if asignacion.rol and asignacion.rol.activo
        ]
        if not roles:
            continue
        elegido = sorted(
            roles,
            key=lambda rol: (profundidad(rol), rol.nombre.upper()),
        )[0]
        Equipo.objects.filter(pk=equipo.pk).update(rol_equipo=elegido)


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0037_remove_preferencianotificacion_cliente_resumen_diario"),
    ]

    operations = [
        migrations.RunPython(backfill_rol_equipo, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="equipo",
            name="tipo_equipo",
        ),
    ]
