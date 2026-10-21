import django.db.models.deletion
from django.db import migrations, models


def vincular_entidades(apps, schema_editor):
    Entidad = apps.get_model("clientes", "Entidad")
    Campana = apps.get_model("campanas", "Campana")

    for campana in Campana.objects.all():
        entidad = None

        if campana.nombre:
            entidad = Entidad.objects.filter(nombre__iexact=campana.nombre).first()

        if entidad is None and campana.ruc:
            entidad = Entidad.objects.filter(ruc=campana.ruc).first()

        if entidad is None:
            nombre = campana.nombre or f"Entidad {campana.pk}"
            base = nombre
            indice = 1
            while Entidad.objects.filter(nombre__iexact=nombre).exists():
                indice += 1
                nombre = f"{base} ({indice})"

            entidad = Entidad.objects.create(
                nombre=nombre,
                razon_social=campana.razon_social or nombre,
                ruc=campana.ruc or None,
                correo=campana.correo or "",
                telefono=campana.telefono or "",
                direccion=campana.direccion or "",
                activo=True,
            )
        else:
            cambios = []
            for campo in ("razon_social", "correo", "telefono", "direccion"):
                if not getattr(entidad, campo) and getattr(campana, campo, None):
                    setattr(entidad, campo, getattr(campana, campo))
                    cambios.append(campo)
            if entidad.ruc is None and campana.ruc:
                entidad.ruc = campana.ruc
                cambios.append("ruc")
            if cambios:
                entidad.save(update_fields=cambios)

        campana.entidad_id = entidad.pk
        campana.save(update_fields=["entidad"])


class Migration(migrations.Migration):

    dependencies = [
        ("clientes", "0002_rename_cliente_entidad"),
        (
            "campanas",
            "0004_remove_campana_campanas_ca_cliente_010b89_idx_and_more",
        ),
    ]

    operations = [
        migrations.AddField(
            model_name="campana",
            name="entidad",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="campanas",
                to="clientes.entidad",
            ),
        ),
        migrations.RunPython(vincular_entidades, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="campana",
            name="entidad",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="campanas",
                to="clientes.entidad",
            ),
        ),
        migrations.RemoveField(model_name="campana", name="ruc"),
        migrations.RemoveField(model_name="campana", name="razon_social"),
        migrations.RemoveField(model_name="campana", name="correo"),
        migrations.RemoveField(model_name="campana", name="telefono"),
        migrations.RemoveField(model_name="campana", name="direccion"),
        migrations.AlterField(
            model_name="campana",
            name="nombre",
            field=models.CharField(max_length=100),
        ),
        migrations.AddConstraint(
            model_name="campana",
            constraint=models.UniqueConstraint(
                fields=("entidad", "nombre"),
                name="uniq_campana_entidad_nombre",
            ),
        ),
        migrations.AddIndex(
            model_name="campana",
            index=models.Index(
                fields=["entidad", "activo"],
                name="campanas_entidad_activo_idx",
            ),
        ),
    ]
