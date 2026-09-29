from django.contrib import admin
from .models import AprobacionTarea, Tarea, ArchivoTarea, Subtarea, TareaLog


@admin.register(Tarea)
class TareaAdmin(admin.ModelAdmin):

    list_display = (
        "ticket",
        "asunto",
        "estado",
        "paso_aprobacion",
        "equipo",
        "solicitante",
        "aprobador",
        "fecha_creacion",
    )

    list_filter = (
        "estado",
        "paso_aprobacion",
        "equipo",
    )

    search_fields = (
        "ticket",
        "asunto",
        "descripcion",
    )

    autocomplete_fields = (
        "equipo",
        "solicitante",
        "aprobador",
    )

    list_select_related = (
        "equipo",
        "solicitante",
        "aprobador",
    )


@admin.register(AprobacionTarea)
class AprobacionTareaAdmin(admin.ModelAdmin):

    list_display = (
        "tarea",
        "nivel",
        "accion",
        "usuario",
        "fecha",
    )

    list_filter = (
        "nivel",
        "accion",
    )

    search_fields = (
        "tarea__ticket",
        "tarea__asunto",
        "usuario__nombres",
        "usuario__apellidos",
        "usuario__email",
    )

    autocomplete_fields = (
        "tarea",
        "usuario",
    )

    list_select_related = (
        "tarea",
        "usuario",
    )


admin.site.register(ArchivoTarea)
admin.site.register(Subtarea)
admin.site.register(TareaLog)
