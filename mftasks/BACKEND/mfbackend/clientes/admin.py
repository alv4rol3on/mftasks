from django.contrib import admin
from .models import Cliente


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ("nombre", "ruc", "correo", "activo")
    search_fields = ("nombre", "ruc", "correo", "razon_social")