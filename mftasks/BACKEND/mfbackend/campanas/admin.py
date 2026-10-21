from django.contrib import admin

from .models import Campana, PermisoCampana, SubCampana


@admin.register(Campana)
class CampanaAdmin(admin.ModelAdmin):
    list_display = ("codigo", "nombre", "entidad", "activo")
    list_filter = ("activo", "entidad")
    search_fields = ("nombre", "codigo", "entidad__nombre", "entidad__ruc")
    autocomplete_fields = ("entidad",)


@admin.register(SubCampana)
class SubCampanaAdmin(admin.ModelAdmin):
    list_display = ("codigo", "nombre", "campana", "activo")
    list_filter = ("activo", "campana")
    search_fields = ("nombre", "codigo")
    autocomplete_fields = ("campana",)


@admin.register(PermisoCampana)
class PermisoCampanaAdmin(admin.ModelAdmin):
    list_display = ("usuario", "campana", "subcampana", "fecha_otorgado")
    autocomplete_fields = ("usuario", "campana", "subcampana")
