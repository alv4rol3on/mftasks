from django.contrib import admin

from .models import Entidad


@admin.register(Entidad)
class EntidadAdmin(admin.ModelAdmin):
    list_display = ("nombre", "ruc", "correo", "activo", "eliminado")
    list_filter = ("activo", "eliminado")
    search_fields = ("nombre", "ruc", "correo", "razon_social")
