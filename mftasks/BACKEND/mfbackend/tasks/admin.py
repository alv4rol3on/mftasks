from django.contrib import admin
from django.core.cache import cache
from .models import AprobacionTarea, Tarea, ArchivoTarea, Subtarea, TareaLog, HorarioLaboral, ConfiguracionAprobacion


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

