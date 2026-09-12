# Migración: ticket Tarea YYYYMMDD00001 + Subtarea.codigo YYYYMMDD00001-001
from django.db import migrations, models

def backfill_ids(apps, schema_editor):
    Tarea = apps.get_model('tasks', 'Tarea')
    Subtarea = apps.get_model('tasks', 'Subtarea')
    from collections import defaultdict
    # Tarea: agrupar por fecha_creacion date y reasignar ticket secuencial
    tareas = list(Tarea.objects.all().order_by('fecha_creacion', 'id'))
    # map fecha_str -> seq
    seq_por_fecha = defaultdict(int)
    ticket_map = {}  # old_id -> new_ticket
    for t in tareas:
        try:
            fc = t.fecha_creacion
            if fc is None:
                import datetime
                fecha_str = datetime.date.today().strftime('%Y%m%d')
            else:
                # fecha_creacion puede ser string en apps historical
                if hasattr(fc, 'strftime'):
                    # localtime simplificado: usar date directo
                    try:
                        fecha_str = fc.strftime('%Y%m%d')
                    except Exception:
                        fecha_str = str(fc)[:10].replace('-','')
                else:
                    fecha_str = str(fc)[:10].replace('-','')
        except Exception:
            fecha_str = '20260311'
        seq_por_fecha[fecha_str] += 1
        new_ticket = f"{fecha_str}{seq_por_fecha[fecha_str]:05d}"
        # evitar colisión si ya existe (por si ticket ya era nuevo formato)
        # loop simple si colisión
        while Tarea.objects.filter(ticket=new_ticket).exclude(id=t.id).exists():
            seq_por_fecha[fecha_str] += 1
            new_ticket = f"{fecha_str}{seq_por_fecha[fecha_str]:05d}"
        ticket_map[t.id] = new_ticket
    # actualizar en batch sin trigger save
    for tid, new_ticket in ticket_map.items():
        Tarea.objects.filter(id=tid).update(ticket=new_ticket)

    # Subtarea: código por tarea, orden fecha_creacion
    subtareas = list(Subtarea.objects.all().order_by('tarea_id', 'fecha_creacion', 'id'))
    # agrupar por tarea
    from collections import defaultdict as dd
    seq_por_tarea = dd(int)
    for st in subtareas:
        tid = st.tarea_id
        new_ticket = ticket_map.get(tid)
        if not new_ticket:
            # fallback: buscar ticket actual
            try:
                new_ticket = Tarea.objects.filter(id=tid).values_list('ticket', flat=True).first() or '2026031100001'
            except Exception:
                new_ticket = '2026031100001'
        seq_por_tarea[tid] += 1
        new_codigo = f"{new_ticket}-{seq_por_tarea[tid]:03d}"
        # evitar duplicado
        while Subtarea.objects.filter(codigo=new_codigo).exclude(id=st.id).exists():
            seq_por_tarea[tid] += 1
            new_codigo = f"{new_ticket}-{seq_por_tarea[tid]:03d}"
        Subtarea.objects.filter(id=st.id).update(codigo=new_codigo)

def reverse_noop(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0015_tarea_activo'),
    ]

    operations = [
        migrations.AddField(
            model_name='subtarea',
            name='codigo',
            field=models.CharField(blank=True, db_index=True, help_text='Formato YYYYMMDD00001-001 basado en ticket de la tarea', max_length=30, null=True, unique=True),
        ),
        migrations.AddIndex(
            model_name='subtarea',
            index=models.Index(fields=['codigo'], name='tasks_subta_codigo_idx'),
        ),
        migrations.RunPython(backfill_ids, reverse_noop),
    ]
