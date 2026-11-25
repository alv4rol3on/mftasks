from django.contrib import admin

from .models import Campana, PermisoCampana, SubCampana


@admin.register(Campana)
class CampanaAdmin(admin.ModelAdmin):
    list_display = ("codigo", "nombre", "entidad", "activo", "eliminado")
    list_filter = ("activo", "eliminado", "entidad")
    search_fields = ("nombre", "codigo", "entidad__nombre", "entidad__ruc")
    autocomplete_fields = ("entidad",)


@admin.register(SubCampana)
class SubCampanaAdmin(admin.ModelAdmin):
    list_display = ("codigo", "nombre", "campana", "activo", "eliminado")
    list_filter = ("activo", "eliminado", "campana")
    search_fields = ("nombre", "codigo")
    autocomplete_fields = ("campana",)


@admin.register(PermisoCampana)
class PermisoCampanaAdmin(admin.ModelAdmin):
    list_display = ("usuario", "campana", "subcampana", "fecha_otorgado")
    autocomplete_fields = ("usuario", "campana", "subcampana")
