from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0029_archivotarea_informacion_log"),
    ]

    operations = [
        migrations.AddField(
            model_name="tarea",
            name="prioridad",
            field=models.CharField(
                choices=[
                    ("BAJA", "Baja"),
                    ("MEDIA", "Media"),
                    ("ALTA", "Alta"),
                    ("URGENTE", "Urgente"),
                ],
                db_index=True,
                default="MEDIA",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="tarea",
            name="severidad",
            field=models.CharField(
                choices=[
                    ("BAJA", "Baja"),
                    ("MEDIA", "Media"),
                    ("ALTA", "Alta"),
                    ("CRITICA", "Crítica"),
                ],
                default="MEDIA",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="tarea",
            name="impacto",
            field=models.CharField(
                choices=[
                    ("BAJO", "Bajo"),
                    ("MEDIO", "Medio"),
                    ("ALTO", "Alto"),
                    ("CRITICO", "Crítico"),
                ],
                default="MEDIO",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="tarealog",
            name="tipo_evento",
            field=models.CharField(
                choices=[
                    ("CREACION", "Creación"),
                    ("INICIO", "Inicio"),
                    ("CAMBIO_ESTADO", "Cambio de estado"),
                    ("STANDBY_INICIO", "Inicio de standby"),
                    ("STANDBY_FIN", "Fin de standby"),
                    ("FIN", "Fin"),
                    ("CAMBIO_ASIGNADO", "Cambio de asignado"),
                    ("CAMBIO_PROGRESO", "Cambio de progreso"),
                    ("CANCELACION", "Cancelación"),
                    ("INFORMACION_ADICIONAL", "Información adicional"),
                    ("CONFIRMACION_CLIENTE", "Confirmación del cliente"),
                    ("CONFIRMACION_AUTOMATICA", "Confirmación automática"),
                    ("REAPERTURA", "Reapertura"),
                    ("CAMBIO_PRIORIDAD", "Cambio de prioridad"),
                ],
                max_length=30,
            ),
        ),
    ]
