from django.contrib import admin
from django.core.cache import cache
from .models import (
    AprobacionTarea,
    Tarea,
    ArchivoTarea,
    Subtarea,
    TareaLog,
    HorarioLaboral,
    ConfiguracionAprobacion,
    Prioridad,
    TipoSolicitud,
)


@admin.register(TipoSolicitud)
class TipoSolicitudAdmin(admin.ModelAdmin):

    list_display = (
        "codigo",
        "nombre",
        "orden",
        "requiere_detalle",
        "activo",
    )

    list_editable = (
        "orden",
        "requiere_detalle",
        "activo",
    )

    list_filter = (
        "activo",
        "requiere_detalle",
    )

    search_fields = (
        "codigo",
        "nombre",
    )

    ordering = ("orden", "nombre")


@admin.register(Prioridad)
class PrioridadAdmin(admin.ModelAdmin):

    list_display = (
        "codigo",
        "nombre",
        "orden",
        "color",
        "activo",
    )

    list_editable = (
        "orden",
        "color",
        "activo",
    )

    list_filter = (
        "activo",
    )

    search_fields = (
        "codigo",
        "nombre",
    )

    ordering = ("orden",)


@admin.register(Tarea)
class TareaAdmin(admin.ModelAdmin):

    list_display = (
        "ticket",
        "asunto",
        "tipo_solicitud",
        "prioridad",
        "estado",
        "paso_aprobacion",
        "equipo",
        "solicitante",
        "aprobador",
        "fecha_creacion",
    )

    list_filter = (
        "tipo_solicitud",
        "prioridad",
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
        "tipo_solicitud",
        "prioridad",
        "equipo",
        "solicitante",
        "aprobador",
    )

    list_select_related = (
        "tipo_solicitud",
        "prioridad",
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


@admin.register(HorarioLaboral)
class HorarioLaboralAdmin(admin.ModelAdmin):

    list_display = (
        "dia",
        "activo",
        "hora_inicio",
        "hora_fin",
    )

    list_editable = (
        "activo",
        "hora_inicio",
        "hora_fin",
    )

    ordering = ("dia",)

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        cache.delete("horarios_laborales")

    def delete_model(self, request, obj):
        super().delete_model(request, obj)
        cache.delete("horarios_laborales")

@admin.register(ConfiguracionAprobacion)
class ConfiguracionAprobacionAdmin(admin.ModelAdmin):
    list_display = ("horas_limite",)
    fields = ("horas_limite",)

    def has_add_permission(self, request):
        return not ConfiguracionAprobacion.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

admin.site.register(ArchivoTarea)
admin.site.register(Subtarea)
admin.site.register(TareaLog)

