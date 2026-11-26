import django.db.models.deletion
from django.db import migrations, models
from django.db.models import UniqueConstraint
from django.db.models.functions import Lower


def migrar_niveles(apps, schema_editor):
    User = apps.get_model("usuarios", "User")
    Nivel = apps.get_model("usuarios", "Nivel")
    UserNivel = apps.get_model("usuarios", "UserNivel")
    Equipo = apps.get_model("usuarios", "Equipo")

    # Los antiguos clientes pasan a colaboradores con permiso de solicitar.
    User.objects.filter(tipo_usuario="CLIENTE").update(
        tipo_usuario="COLABORADOR",
        puede_crear_solicitudes=True,
    )

    # Los superusuarios de Django son administradores de la aplicación.
    User.objects.filter(is_superuser=True).update(tipo_usuario="ADMINISTRADOR")

    admin_nivel = Nivel.objects.filter(nombre__iexact="Administrador").first()
    if admin_nivel is not None:
        admin_nivel.es_sistema = True
        admin_nivel.save(update_fields=["es_sistema"])
        ids_admin = set(
            UserNivel.objects.filter(nivel_id=admin_nivel.id).values_list(
                "usuario_id", flat=True
            )
        )
        if ids_admin:
            User.objects.filter(id__in=ids_admin).update(
                tipo_usuario="ADMINISTRADOR"
            )

    # El nivel "Cliente" deja de existir.
    cliente_nivel = Nivel.objects.filter(nombre__iexact="CLIENTE").first()
    if cliente_nivel is not None:
        UserNivel.objects.filter(nivel_id=cliente_nivel.id).delete()
        Nivel.objects.filter(superior_id=cliente_nivel.id).update(superior_id=None)
        Equipo.objects.filter(nivel_id=cliente_nivel.id).update(nivel_id=None)
        cliente_nivel.delete()

    # Renumerar niveles no sistema: mayor número = mayor jerarquía.
    niveles = list(Nivel.objects.filter(es_sistema=False))
    if not niveles:
        return

    mapa = {nivel.id: nivel for nivel in niveles}

    def profundidad(nivel):
        distancia = 0
        vistos = set()
        actual = nivel
        while actual.superior_id and actual.superior_id in mapa:
            if actual.superior_id in vistos:
                break
            vistos.add(actual.superior_id)
            actual = mapa[actual.superior_id]
            distancia += 1
        return distancia

    ordenados = sorted(niveles, key=lambda nivel: (profundidad(nivel), nivel.id))
    total = len(ordenados)

    for nivel in ordenados:
        Nivel.objects.filter(pk=nivel.pk).update(
            nombre=f"__nivel_tmp_{nivel.pk}"
        )

    for indice, nivel in enumerate(ordenados):
        Nivel.objects.filter(pk=nivel.pk).update(
            nombre=f"NIVEL {total - indice}"
        )


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0038_remove_equipo_tipo_equipo"),
    ]

    operations = [
        migrations.RenameModel(old_name="Rol", new_name="Nivel"),
        migrations.RenameModel(old_name="UserRol", new_name="UserNivel"),
        migrations.RemoveIndex(
            model_name="usernivel",
            name="usuarios_us_rol_id_3cd341_idx",
        ),
        migrations.RenameField(
            model_name="usernivel",
            old_name="rol",
            new_name="nivel",
        ),
        migrations.RenameField(
            model_name="equipo",
            old_name="rol_equipo",
            new_name="nivel",
        ),
        migrations.AddField(
            model_name="user",
            name="puede_crear_solicitudes",
            field=models.BooleanField(
                db_index=True,
                default=False,
                help_text=(
                    "Permite al colaborador crear solicitudes y acceder a la "
                    "pestaña 'Mis solicitudes'."
                ),
            ),
        ),
        migrations.AddField(
            model_name="nivel",
            name="es_sistema",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "Nivel interno (p. ej. Administrador) que no se gestiona "
                    "desde la pestaña Niveles."
                ),
            ),
        ),
        migrations.AlterField(
            model_name="user",
            name="tipo_usuario",
            field=models.CharField(
                choices=[
                    ("COLABORADOR", "Colaborador"),
                    ("ADMINISTRADOR", "Administrador"),
                ],
                db_index=True,
                default="COLABORADOR",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="usernivel",
            name="usuario",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="niveles",
                to="usuarios.user",
            ),
        ),
        migrations.AlterField(
            model_name="usernivel",
            name="nivel",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="usuarios",
                to="usuarios.nivel",
            ),
        ),
        migrations.AlterField(
            model_name="equipo",
            name="nivel",
            field=models.ForeignKey(
                blank=True,
                help_text=(
                    "Nivel del líder que determina la cadena de aprobación "
                    "del equipo."
                ),
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="equipos",
                to="usuarios.nivel",
            ),
        ),
        migrations.RemoveConstraint(
            model_name="nivel",
            name="rol_nombre_unique_lower",
        ),
        migrations.AddConstraint(
            model_name="nivel",
            constraint=UniqueConstraint(
                Lower("nombre"),
                name="nivel_nombre_unique_lower",
            ),
        ),
        migrations.AddIndex(
            model_name="usernivel",
            index=models.Index(
                fields=["nivel"],
                name="usuarios_us_nivel_i_3c5ba2_idx",
            ),
        ),
        migrations.RunPython(migrar_niveles, migrations.RunPython.noop),
    ]
