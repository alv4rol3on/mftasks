from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import (
    User,
    Rol,
    UserRol,
    Equipo,
    EquipoMiembro,
)

class UserRolInline(admin.TabularInline):
    model = UserRol
    extra = 1

class EquipoMiembroInline(admin.TabularInline):
    model = EquipoMiembro
    extra = 1
    autocomplete_fields = ("usuario",)

@admin.register(User)
class UserAdmin(BaseUserAdmin):

    ordering = ("email",)

    list_display = (
        "email",
        "nombres",
        "apellidos",
        "cargo",
        "activo",
        "is_staff",
    )

    list_filter = (
        "activo",
        "is_staff",
        "is_superuser",
    )

    search_fields = (
        "email",
        "nombres",
        "apellidos",
    )

    readonly_fields = (
        "fecha_creacion",
        "last_login",
    )

    fieldsets = (
        (
            "Información personal",
            {
                "fields": (
                    "email",
                    "nombres",
                    "apellidos",
                    "cargo",
                    "azure_id",
                )
            },
        ),
        (
            "Permisos",
            {
                "fields": (
                    "activo",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        (
            "Fechas",
            {
                "fields": (
                    "last_login",
                    "fecha_creacion",
                )
            },
        ),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "nombres",
                    "apellidos",
                    "cargo",
                    "password1",
                    "password2",
                    "is_staff",
                    "is_superuser",
                ),
            },
        ),
    )

    inlines = [
        UserRolInline,
    ]


@admin.register(Rol)
class RolAdmin(admin.ModelAdmin):

    list_display = (
        "nombre",
        "activo",
    )

    list_filter = (
        "activo",
    )

    search_fields = (
        "nombre",
    )


@admin.register(UserRol)
class UserRolAdmin(admin.ModelAdmin):

    list_display = (
        "usuario",
        "rol",
    )

    list_filter = (
        "rol",
    )

    autocomplete_fields = (
        "usuario",
        "rol",
    )


@admin.register(Equipo)
class EquipoAdmin(admin.ModelAdmin):

    list_display = (
        "nombre",
        "lider",
        "activo",
        "fecha_creacion",
    )

    list_filter = (
        "activo",
    )

    search_fields = (
        "nombre",
        "lider__nombres",
        "lider__apellidos",
        "lider__email",
    )

    autocomplete_fields = (
        "lider",
    )

    inlines = [
        EquipoMiembroInline,
    ]

@admin.register(EquipoMiembro)
class EquipoMiembroAdmin(admin.ModelAdmin):

    list_display = (
        "equipo",
        "usuario",
        "rol_en_equipo",
        "estado",
        "fecha_ingreso",
    )

    list_filter = (
        "equipo",
        "rol_en_equipo",
        "estado",
    )

    search_fields = (
        "equipo__nombre",
        "usuario__nombres",
        "usuario__apellidos",
        "usuario__email",
    )

    autocomplete_fields = (
        "equipo",
        "usuario",
    )