import django.db.models.deletion
from django.db import migrations, models


TIPOS_SOLICITUD = [
    ("NUEVA_FUNCIONALIDAD", "Nueva funcionalidad", 1, False),
    ("REPORTE", "Creación de reporte", 2, False),
    ("CORRECCION_ERROR", "Corrección de error", 3, False),
    ("CREACION_BI", "Creación de BI", 4, False),
    ("OTROS", "Otros", 5, True),
]

PRIORIDADES = [
    ("BAJA", "Baja", 1),
    ("MEDIA", "Media", 2),
    ("ALTA", "Alta", 3),
    ("URGENTE", "Urgente", 4),
]


def sembrar_catalogos(apps, schema_editor):
    TipoSolicitud = apps.get_model("tasks", "TipoSolicitud")
    Prioridad = apps.get_model("tasks", "Prioridad")

    for codigo, nombre, orden, requiere_detalle in TIPOS_SOLICITUD:
        TipoSolicitud.objects.update_or_create(
            codigo=codigo,
            defaults={
                "nombre": nombre,
                "orden": orden,
                "requiere_detalle": requiere_detalle,
                "activo": True,
            },
        )

    for codigo, nombre, orden in PRIORIDADES:
        Prioridad.objects.update_or_create(
            codigo=codigo,
            defaults={
                "nombre": nombre,
                "orden": orden,
                "activo": True,
            },
        )


def eliminar_catalogos(apps, schema_editor):
    TipoSolicitud = apps.get_model("tasks", "TipoSolicitud")
    Prioridad = apps.get_model("tasks", "Prioridad")

    TipoSolicitud.objects.filter(
        codigo__in=[codigo for codigo, *_ in TIPOS_SOLICITUD]
    ).delete()
    Prioridad.objects.filter(
        codigo__in=[codigo for codigo, *_ in PRIORIDADES]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0039_remove_configuracionaprobacion_dias_habiles_confirmacion_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="TipoSolicitud",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("codigo", models.CharField(max_length=30, unique=True)),
                ("nombre", models.CharField(max_length=100)),
                ("descripcion", models.TextField(blank=True)),
                ("orden", models.PositiveSmallIntegerField(default=0)),
                (
                    "requiere_detalle",
                    models.BooleanField(
                        default=False,
                        help_text="Si está activo, al elegir este tipo se debe indicar un detalle.",
                    ),
                ),
                ("activo", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "Tipo de solicitud",
                "verbose_name_plural": "Tipos de solicitud",
                "ordering": ["orden", "nombre"],
            },
        ),
        migrations.CreateModel(
            name="Prioridad",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("codigo", models.CharField(max_length=20, unique=True)),
                ("nombre", models.CharField(max_length=50)),
                (
                    "orden",
                    models.PositiveSmallIntegerField(
                        default=0,
                        help_text="Determina la severidad para ordenar las solicitudes.",
                    ),
                ),
                (
                    "color",
                    models.CharField(
                        blank=True,
                        default="",
                        help_text="Color hexadecimal (#RRGGBB) usado para representar la prioridad. Vacío = neutro.",
                        max_length=7,
                    ),
                ),
                ("activo", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "Prioridad",
                "verbose_name_plural": "Prioridades",
                "ordering": ["orden"],
            },
        ),
        migrations.RunPython(sembrar_catalogos, eliminar_catalogos),
        migrations.AddField(
            model_name="tarea",
            name="tipo_solicitud_ref",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="+",
                to="tasks.tiposolicitud",
            ),
        ),
        migrations.AddField(
            model_name="tarea",
            name="prioridad_ref",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="+",
                to="tasks.prioridad",
            ),
        ),
    ]
