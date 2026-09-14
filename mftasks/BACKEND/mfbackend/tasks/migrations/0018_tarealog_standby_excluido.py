from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        (
            "tasks",
            "0017_rename_tasks_subta_codigo_idx_tasks_subta_codigo_e84e2e_idx_and_more",
        ),
    ]

    operations = [
        migrations.AddField(
            model_name="tarealog",
            name="standby_excluido",
            field=models.BooleanField(
                default=True,
                help_text=(
                    "Si es True, el tiempo de este período de standby se excluye "
                    "del contador. Al elegir cómo reanudar se guarda False y el "
                    "efecto pasa a la fecha de entrega."
                ),
            ),
        ),
    ]
