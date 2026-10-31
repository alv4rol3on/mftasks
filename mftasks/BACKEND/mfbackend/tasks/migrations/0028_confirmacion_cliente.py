from django.db import migrations, models


def marcar_soluciones_historicas_confirmadas(apps, schema_editor):
    Tarea = apps.get_model("tasks", "Tarea")
    Tarea.objects.filter(
        estado="SOLUCIONADO",
        confirmacion_cliente__isnull=True,
    ).update(confirmacion_cliente="CONFIRMADA")


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0027_secuenciaticket_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="tarea",
            name="confirmacion_cliente",
            field=models.CharField(
                blank=True,
                choices=[
                    ("PENDIENTE", "Pendiente"),
                    ("CONFIRMADA", "Confirmada"),
                    ("REABIERTA", "Reabierta"),
                ],
                db_index=True,
                help_text="Estado de conformidad del cliente con la solución.",
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="tarea",
            name="fecha_limite_confirmacion",
            field=models.DateTimeField(
                blank=True,
                db_index=True,
                help_text="Fecha límite para que el cliente confirme o reabra la solicitud.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="tarea",
            name="fecha_confirmacion_cliente",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="tarea",
            name="reaperturas_cliente",
            field=models.PositiveSmallIntegerField(
                default=0,
                help_text="Cantidad de veces que el cliente reabrió la solicitud.",
            ),
        ),
        migrations.AddField(
            model_name="tarea",
            name="fecha_ultima_reapertura",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="tarea",
            name="motivo_reapertura",
            field=models.TextField(blank=True),
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
                ],
                max_length=30,
            ),
        ),
        migrations.RunPython(
            marcar_soluciones_historicas_confirmadas,
            migrations.RunPython.noop,
        ),
    ]
