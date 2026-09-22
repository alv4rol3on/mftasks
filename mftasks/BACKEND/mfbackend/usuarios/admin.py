from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import (
    User,
    Rol,
    UserRol,
    Equipo,
    EquipoMiembro,
    PreferenciaNotificacion,
)

class UserRolInline(admin.TabularInline):
    model = UserRol
    extra = 1

class EquipoMiembroInline(admin.TabularInline):
    model = EquipoMiembro
    extra = 1
    autocomplete_fields = ("usuario",)

class PreferenciaNotificacionInline(admin.StackedInline):
        model = PreferenciaNotificacion
        extra = 0
        max_num = 1
        can_delete = False

        readonly_fields = (
            "fecha_actualizacion",
        )

        fieldsets = (
            (
                "Configuración general",
                {
                    "fields": (
                        "recibir_correos",
                        "fecha_actualizacion",
                    )
                },
            ),
            (
                "Notificaciones para clientes",
                {
                    "fields": (
                        "cliente_solicitud_creada",
                        "cliente_solicitud_resuelta",
                        "cliente_solicitud_standby",
                        "cliente_solicitud_solucionada",
                    )
                },
            ),
            (
                "Notificaciones para el equipo",
                {
                    "fields": (
                        "equipo_nueva_solicitud",
                        "equipo_pendiente_revision",
                        "equipo_alerta_diaria",
                        "equipo_hora_alerta_diaria",
                    )
                },
            ),
        )

@admin.register(User)
class UserAdmin(BaseUserAdmin):

    ordering = ("email",)

    list_display = (
        "codigo",
        "email",
        "nombres",
        "apellidos",
        "cargo",
        "is_active",
        "is_staff",
    )

    inlines = (
        PreferenciaNotificacionInline,
    )

    list_filter = (
        "is_active",
        "is_staff",
        "is_superuser",
    )

    search_fields = (
        "codigo",
        "email",
        "nombres",
        "apellidos",
    )

    readonly_fields = (
        "codigo",
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
        )

        
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

@admin.register(PreferenciaNotificacion)
class PreferenciaNotificacionAdmin(admin.ModelAdmin):
    list_display = (
        "usuario",
        "recibir_correos",
        "equipo_nueva_solicitud",
        "equipo_pendiente_revision",
        "equipo_alerta_diaria",
        "equipo_hora_alerta_diaria",
        "fecha_actualizacion",
    )

    list_filter = (
        "recibir_correos",
        "cliente_solicitud_creada",
        "cliente_solicitud_resuelta",
        "cliente_solicitud_standby",
        "cliente_solicitud_solucionada",
        "equipo_nueva_solicitud",
        "equipo_pendiente_revision",
        "equipo_alerta_diaria",
    )

    search_fields = (
        "usuario__email",
        "usuario__nombres",
        "usuario__apellidos",
    )

    readonly_fields = (
        "fecha_actualizacion",
    )

    list_select_related = (
        "usuario",
    )

    fieldsets = (
        (
            "Usuario",
            {
                "fields": (
                    "usuario",
                    "recibir_correos",
                    "fecha_actualizacion",
                )
            },
        ),
        (
            "Notificaciones para clientes",
            {
                "fields": (
                    "cliente_solicitud_creada",
                    "cliente_solicitud_resuelta",
                    "cliente_solicitud_standby",
                    "cliente_solicitud_solucionada",
                )
            },
        ),
        (
            "Notificaciones para el equipo",
            {
                "fields": (
                    "equipo_nueva_solicitud",
                    "equipo_pendiente_revision",
                    "equipo_alerta_diaria",
                    "equipo_hora_alerta_diaria",
                )
            },
        ),
    )

    ordering = (
        "usuario__email",
    )

    