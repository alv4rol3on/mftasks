from django.db import migrations


def consolidar_roles(apps, schema_editor):
    Rol = apps.get_model("usuarios", "Rol")
    UserRol = apps.get_model("usuarios", "UserRol")
    EquipoMiembro = apps.get_model("usuarios", "EquipoMiembro")

    # Mapeo: ASIGNADOR -> lider (via EquipoMiembro), ASISTENTE -> miembro
    # Normalizar nombres a lower para detectar duplicados case-insensitive
    roles = list(Rol.objects.all())
    # crear roles canónicos si no existen (case-insensitive)
    for canon in ["Administrador", "miembro", "cliente"]:
        if not Rol.objects.filter(nombre__iexact=canon).exists():
            Rol.objects.create(nombre=canon, descripcion=f"Rol {canon}", activo=True)
    # obtener ids canónicos
    try:
        rol_admin = Rol.objects.get(nombre__iexact="Administrador")
        rol_miembro = Rol.objects.get(nombre__iexact="miembro")
        rol_cliente = Rol.objects.get(nombre__iexact="CLIENTE")
    except Rol.DoesNotExist:
        return

    # Reasignar UserRol
    for ur in UserRol.objects.select_related("rol").all():
        nombre_lower = ur.rol.nombre.lower()
        if nombre_lower == "asignador":
            # ASIGNADOR -> miembro + promover a LIDER si es miembro de equipo? solo cambia rol global a miembro
            # Asignar miembro global
            if not UserRol.objects.filter(usuario_id=ur.usuario_id, rol_id=rol_miembro.id).exists():
                UserRol.objects.create(usuario_id=ur.usuario_id, rol_id=rol_miembro.id)
            ur.delete()
        elif nombre_lower == "asistente":
            if not UserRol.objects.filter(usuario_id=ur.usuario_id, rol_id=rol_miembro.id).exists():
                UserRol.objects.create(usuario_id=ur.usuario_id, rol_id=rol_miembro.id)
            ur.delete()
        elif nombre_lower in ("administrador", "miembro", "cliente"):
            # normalizar nombre case
            # asegurar rol canónico
            canon_id = {"administrador": rol_admin.id, "miembro": rol_miembro.id, "cliente": rol_cliente.id}[nombre_lower]
            if ur.rol_id != canon_id:
                if not UserRol.objects.filter(usuario_id=ur.usuario_id, rol_id=canon_id).exists():
                    ur.rol_id = canon_id
                    ur.save(update_fields=["rol"])
                else:
                    ur.delete()
        else:
            # rol desconocido -> mapear a miembro
            if not UserRol.objects.filter(usuario_id=ur.usuario_id, rol_id=rol_miembro.id).exists():
                UserRol.objects.create(usuario_id=ur.usuario_id, rol_id=rol_miembro.id)
            ur.delete()

    # Eliminar roles sobrantes (case-insensitive duplicados y viejos)
    for r in Rol.objects.all():
        if r.nombre.lower() not in ("administrador", "miembro", "cliente"):
            # borrar solo si no tiene usuarios (ya migrados)
            if not UserRol.objects.filter(rol_id=r.id).exists():
                r.delete()
            else:
                # fallback: reasignar a miembro y borrar
                for ur in UserRol.objects.filter(rol_id=r.id):
                    if not UserRol.objects.filter(usuario_id=ur.usuario_id, rol_id=rol_miembro.id).exists():
                        ur.rol_id = rol_miembro.id
                        ur.save(update_fields=["rol"])
                    else:
                        ur.delete()
                r.delete()

    # Deprecar SUB_LIDER -> MIEMBRO (lider por-equipo es LIDER único)
    EquipoMiembro.objects.filter(rol_en_equipo="SUB_LIDER").update(rol_en_equipo="MIEMBRO")


def revertir(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("usuarios", "0011_equipomiembro_fecha_baja_and_more"),
    ]

    operations = [
        migrations.RunPython(consolidar_roles, revertir),
    ]
