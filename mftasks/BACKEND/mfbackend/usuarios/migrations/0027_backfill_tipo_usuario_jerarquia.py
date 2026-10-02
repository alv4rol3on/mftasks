# Migración de datos: tipo_usuario, jerarquía de roles y rol_equipo.
# Mantiene la jerarquía existente pero almacenada mediante el sistema dinámico:
#   Gerente -> Subgerente -> Jefe -> GTR -> Miembro

from django.db import migrations


def _get_rol(Rol, nombre):
    return Rol.objects.filter(nombre__iexact=nombre).first()


def _upsert_rol(Rol, nombre, descripcion, puede_liderar=False, superior=None):
    rol = _get_rol(Rol, nombre)
    if rol is None:
        rol = Rol.objects.create(
            nombre=nombre,
            descripcion=descripcion,
            activo=True,
        )
    update = []
    if puede_liderar and not rol.puede_liderar:
        rol.puede_liderar = True
        update.append("puede_liderar")
    if superior is not None and rol.superior_id != superior.pk:
        rol.superior = superior
        update.append("superior")
    if update:
        rol.save(update_fields=update)
    return rol


def aplicar(apps, schema_editor):
    User = apps.get_model("usuarios", "User")
    Rol = apps.get_model("usuarios", "Rol")
    UserRol = apps.get_model("usuarios", "UserRol")
    Equipo = apps.get_model("usuarios", "Equipo")

    # --- 1. Jerarquía de roles (relación directa, sin niveles numéricos) ---
    gerente = _upsert_rol(
        Rol, "Gerente", "Máximo nivel de la cadena de aprobación",
        puede_liderar=True, superior=None,
    )
    subgerente = _upsert_rol(
        Rol, "Subgerente", "Aprueba las solicitudes de los Jefes",
        puede_liderar=True, superior=gerente,
    )
    jefe = _upsert_rol(
        Rol, "Jefe", "Aprueba las solicitudes de GTR y roles dependientes",
        puede_liderar=True, superior=subgerente,
    )
    gtr = _upsert_rol(
        Rol, "GTR", "Líder de equipo", puede_liderar=True, superior=jefe,
    )
    # Ramas al mismo nivel que GTR (dependen del mismo superior).
    _upsert_rol(
        Rol, "Coordinador", "Rol dependiente de Jefe",
        puede_liderar=True, superior=jefe,
    )
    _upsert_rol(
        Rol, "Supervisor", "Rol dependiente de Jefe",
        puede_liderar=True, superior=jefe,
    )
    _upsert_rol(
        Rol, "Miembro", "Integrante de equipo",
        puede_liderar=False, superior=gtr,
    )

    # Roles de sistema (no participan de la jerarquía de aprobación).
    _upsert_rol(Rol, "Administrador", "Acceso total al sistema", False, None)
    _upsert_rol(Rol, "Cliente", "Usuario externo que crea solicitudes", False, None)

    # --- 2. tipo_usuario a partir de los roles actuales ---
    admin_ids = set(
        UserRol.objects.filter(rol__nombre__iexact="Administrador")
        .values_list("usuario_id", flat=True)
    )
    cliente_ids = set(
        UserRol.objects.filter(rol__nombre__iexact="Cliente")
        .values_list("usuario_id", flat=True)
    )
    if admin_ids:
        User.objects.filter(id__in=admin_ids).update(tipo_usuario="ADMINISTRADOR")
    if cliente_ids:
        User.objects.filter(id__in=cliente_ids).exclude(id__in=admin_ids).update(
            tipo_usuario="CLIENTE"
        )

    # --- 3. Equipo.rol_equipo desde el rol de mayor rango del líder ---
    profundidad_cache = {}

    def profundidad(rol):
        if rol.pk in profundidad_cache:
            return profundidad_cache[rol.pk]
        d = 0
        actual = rol.superior
        vistos = {rol.pk}
        while actual is not None and actual.pk not in vistos:
            vistos.add(actual.pk)
            d += 1
            actual = actual.superior
        profundidad_cache[rol.pk] = d
        return d

    for equipo in Equipo.objects.all().iterator():
        if not equipo.lider_id:
            continue
        roles = [
            ur.rol
            for ur in UserRol.objects.filter(usuario_id=equipo.lider_id).select_related("rol")
            if ur.rol and ur.rol.activo
        ]
        if not roles:
            continue
        elegido = sorted(roles, key=lambda r: (profundidad(r), r.nombre.upper()))[0]
        Equipo.objects.filter(pk=equipo.pk).update(
            rol_equipo=elegido, tipo_equipo=elegido.nombre
        )


def revertir(apps, schema_editor):
    User = apps.get_model("usuarios", "User")
    User.objects.update(tipo_usuario="COLABORADOR")


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0026_equipo_rol_equipo_rol_puede_liderar_rol_superior_and_more"),
    ]

    operations = [
        migrations.RunPython(aplicar, revertir),
    ]
