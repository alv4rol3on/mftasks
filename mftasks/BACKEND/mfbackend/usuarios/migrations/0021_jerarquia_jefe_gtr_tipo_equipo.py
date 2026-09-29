from django.db import migrations, models
from django.db.models import Q


ROLES_ORDEN = ["GERENTE", "SUBGERENTE", "JEFE", "GTR"]


def _merge_or_rename_rol(Rol, UserRol, viejo, nuevo, descripcion):
    """Renombra el rol `viejo` a `nuevo`, fusionando si `nuevo` ya existe."""
    origen = Rol.objects.filter(nombre__iexact=viejo).first()
    destino = Rol.objects.filter(nombre__iexact=nuevo).first()

    if origen is None:
        if destino is None:
            Rol.objects.create(nombre=nuevo, descripcion=descripcion, activo=True)
        return

    if destino is not None and destino.pk != origen.pk:
        UserRol.objects.filter(rol=origen).update(rol=destino)
        origen.delete()
    else:
        origen.nombre = nuevo
        origen.descripcion = descripcion
        origen.save(update_fields=["nombre", "descripcion"])


def migrar_jerarquia(apps, schema_editor):
    Rol = apps.get_model("usuarios", "Rol")
    UserRol = apps.get_model("usuarios", "UserRol")
    Equipo = apps.get_model("usuarios", "Equipo")
    EquipoMiembro = apps.get_model("usuarios", "EquipoMiembro")

    _merge_or_rename_rol(
        Rol, UserRol, "SUPERVISOR", "JEFE",
        "Aprueba solicitudes en un nivel global (alternativo)",
    )
    _merge_or_rename_rol(
        Rol, UserRol, "LIDER", "GTR",
        "GTR: líder de equipo",
    )

    Rol.objects.get_or_create(
        nombre="GTR",
        defaults={"descripcion": "GTR: líder de equipo", "activo": True},
    )
    Rol.objects.get_or_create(
        nombre="JEFE",
        defaults={"descripcion": "Aprueba solicitudes en un nivel global (alternativo)", "activo": True},
    )

    # Rol por-equipo: LIDER -> GTR (ya había como máximo uno por equipo)
    EquipoMiembro.objects.filter(rol_en_equipo="LIDER").update(rol_en_equipo="GTR")

    # Backfill de tipo_equipo según el rol de mayor rango del líder
    for equipo in Equipo.objects.all():
        if not equipo.lider_id:
            continue
        nombres = {
            (ur.rol.nombre or "").upper()
            for ur in UserRol.objects.filter(usuario_id=equipo.lider_id).select_related("rol")
        }
        nivel = next((r for r in ROLES_ORDEN if r in nombres), "GTR")
        Equipo.objects.filter(pk=equipo.pk).update(tipo_equipo=nivel)


def revertir_jerarquia(apps, schema_editor):
    Rol = apps.get_model("usuarios", "Rol")
    UserRol = apps.get_model("usuarios", "UserRol")
    EquipoMiembro = apps.get_model("usuarios", "EquipoMiembro")

    _merge_or_rename_rol(
        Rol, UserRol, "JEFE", "SUPERVISOR",
        "Aprobador de la cadena de aprobación",
    )
    _merge_or_rename_rol(
        Rol, UserRol, "GTR", "LIDER",
        "Líder de equipo",
    )
    EquipoMiembro.objects.filter(rol_en_equipo="GTR").update(rol_en_equipo="LIDER")


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0020_preferencias_notificacion_rol"),
    ]

    operations = [
        migrations.AddField(
            model_name="equipo",
            name="tipo_equipo",
            field=models.CharField(
                choices=[
                    ("GERENTE", "Equipo de Gerente"),
                    ("SUBGERENTE", "Equipo de Subgerente"),
                    ("JEFE", "Equipo de Jefe"),
                    ("GTR", "Equipo GTR"),
                ],
                db_index=True,
                default="GTR",
                help_text="Derivado del rol del líder del equipo.",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="equipomiembro",
            name="rol_en_equipo",
            field=models.CharField(
                choices=[
                    ("GTR", "GTR"),
                    ("MIEMBRO", "Miembro"),
                    ("SUB_LIDER", "Sub-líder"),
                ],
                default="MIEMBRO",
                max_length=20,
            ),
        ),
        migrations.RemoveConstraint(
            model_name="equipomiembro",
            name="unico_lider_por_equipo",
        ),
        migrations.AddConstraint(
            model_name="equipomiembro",
            constraint=models.UniqueConstraint(
                condition=Q(("rol_en_equipo", "GTR")),
                fields=("equipo",),
                name="unico_lider_por_equipo",
            ),
        ),
        migrations.RunPython(migrar_jerarquia, revertir_jerarquia),
    ]
