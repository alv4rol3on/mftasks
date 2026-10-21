from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("clientes", "0001_initial"),
        (
            "campanas",
            "0004_remove_campana_campanas_ca_cliente_010b89_idx_and_more",
        ),
        (
            "tasks",
            "0004_archivotarea_subtarea_tarea_delete_task_and_more",
        ),
    ]

    operations = [
        migrations.RenameModel(
            old_name="Cliente",
            new_name="Entidad",
        ),
    ]
