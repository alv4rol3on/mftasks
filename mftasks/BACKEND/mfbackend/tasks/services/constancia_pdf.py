import io
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from ..models import Tarea
from .estado_cliente import explicar_estado_cliente
from .rich_text import html_a_texto


def _fecha(valor):
    if not valor:
        return "-"
    try:
        return timezone.localtime(valor).strftime("%d/%m/%Y %H:%M")
    except Exception:
        return str(valor)


def _texto(valor):
    return escape(str(valor or "-"))


def _parrafo(texto, estilo):
    return Paragraph(_texto(texto), estilo)


def generar_constancia_pdf(tarea: Tarea) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"Constancia {tarea.ticket or tarea.id}",
        author="MF Tasks",
    )

    styles = getSampleStyleSheet()
    titulo = ParagraphStyle(
        "TituloConstancia",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#C8210A"),
        spaceAfter=4,
    )
    subtitulo = ParagraphStyle(
        "SubtituloConstancia",
        parent=styles["Normal"],
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#64748B"),
        spaceAfter=12,
    )
    seccion = ParagraphStyle(
        "SeccionConstancia",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#101828"),
        spaceBefore=10,
        spaceAfter=6,
    )
    normal = ParagraphStyle(
        "NormalConstancia",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#101828"),
    )
    small = ParagraphStyle(
        "SmallConstancia",
        parent=normal,
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#64748B"),
    )

    explicacion = explicar_estado_cliente(tarea)
    equipo = getattr(tarea, "equipo", None)
    lider = getattr(equipo, "lider", None) if equipo else None
    subcampana = getattr(tarea, "subcampana", None)
    campana = getattr(subcampana, "campana", None) if subcampana else None
    entidad = getattr(campana, "entidad", None) if campana else None
    solicitante = getattr(tarea, "solicitante", None)

    story = [
        Paragraph("MF Tasks", titulo),
        Paragraph("Constancia de solicitud", subtitulo),
        Table(
            [
                [_parrafo("Ticket", small), _parrafo(tarea.ticket or f"#{tarea.id}", normal)],
                [_parrafo("Asunto", small), _parrafo(tarea.asunto, normal)],
                [_parrafo("Tipo", small), _parrafo(tarea.get_tipo_solicitud_display(), normal)],
                [_parrafo("Estado", small), _parrafo(tarea.get_estado_display(), normal)],
                [_parrafo("Entidad", small), _parrafo(getattr(entidad, "nombre", "-"), normal)],
                [_parrafo("Campaña", small), _parrafo(getattr(campana, "nombre", "-"), normal)],
                [_parrafo("Subcampaña", small), _parrafo(getattr(subcampana, "nombre", "-"), normal)],
                [_parrafo("Equipo", small), _parrafo(getattr(equipo, "nombre", "-"), normal)],
                [_parrafo("Líder", small), _parrafo(
                    f"{getattr(lider, 'nombres', '')} {getattr(lider, 'apellidos', '')}".strip()
                    or "-",
                    normal,
                )],
                [_parrafo("Solicitante", small), _parrafo(
                    f"{getattr(solicitante, 'nombres', '')} {getattr(solicitante, 'apellidos', '')}".strip()
                    or "-",
                    normal,
                )],
            ],
            colWidths=[32 * mm, 130 * mm],
            hAlign="LEFT",
        ),
    ]

    story.append(Spacer(1, 8))
    story.append(Paragraph("Estado actual", seccion))
    if explicacion.get("estado_explicado"):
        story.append(_parrafo(explicacion["estado_explicado"], normal))
    if explicacion.get("siguiente_paso"):
        story.append(Spacer(1, 3))
        story.append(Paragraph("<b>Siguiente paso:</b>", normal))
        story.append(_parrafo(explicacion["siguiente_paso"], normal))
    if explicacion.get("motivo_demora"):
        story.append(Spacer(1, 3))
        story.append(Paragraph("<b>Motivo:</b>", normal))
        story.append(_parrafo(explicacion["motivo_demora"], normal))

    story.append(Paragraph("Fechas", seccion))
    story.append(
        Table(
            [
                [_parrafo("Solicitud", small), _parrafo(_fecha(tarea.fecha_creacion), normal)],
                [_parrafo("Respuesta", small), _parrafo(_fecha(tarea.fecha_respuesta), normal)],
                [_parrafo("Inicio", small), _parrafo(_fecha(tarea.fecha_inicio), normal)],
                [_parrafo("Entrega estimada", small), _parrafo(
                    _fecha(tarea.fecha_entrega_aproximada), normal
                )],
                [_parrafo("Solución", small), _parrafo(_fecha(tarea.fecha_solucion), normal)],
                [_parrafo("Confirmación cliente", small), _parrafo(
                    _fecha(tarea.fecha_confirmacion_cliente), normal
                )],
            ],
            colWidths=[38 * mm, 124 * mm],
            hAlign="LEFT",
        )
    )

    story.append(Paragraph("Descripción", seccion))
    descripcion = html_a_texto(tarea.descripcion or "")
    for bloque in (descripcion or "-").split("\n"):
        if bloque.strip():
            story.append(_parrafo(bloque.strip(), normal))

    aprobaciones = list(tarea.aprobaciones.all())
    if aprobaciones:
        story.append(Paragraph("Aprobaciones", seccion))
        filas = [[
            _parrafo("Fase", small),
            _parrafo("Acción", small),
            _parrafo("Usuario", small),
            _parrafo("Fecha", small),
            _parrafo("Motivo", small),
        ]]
        for aprobacion in aprobaciones:
            usuario = getattr(aprobacion, "usuario", None)
            nombre = (
                f"{getattr(usuario, 'nombres', '')} {getattr(usuario, 'apellidos', '')}".strip()
                or "Sistema"
            )
            filas.append([
                _parrafo(aprobacion.get_nivel_display(), small),
                _parrafo(aprobacion.get_accion_display(), small),
                _parrafo(nombre, small),
                _parrafo(_fecha(aprobacion.fecha), small),
                _parrafo(aprobacion.motivo or "-", small),
            ])
        tabla = Table(filas, colWidths=[30 * mm, 24 * mm, 40 * mm, 32 * mm, 36 * mm])
        tabla.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F2F3F5")),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E0E3E8")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(tabla)

    archivos = list(tarea.archivos.all())
    if archivos:
        story.append(Paragraph("Adjuntos", seccion))
        for archivo in archivos:
            autor = getattr(archivo, "subido_por", None)
            autor_nombre = (
                f"{getattr(autor, 'nombres', '')} {getattr(autor, 'apellidos', '')}".strip()
                or "Sistema"
            )
            story.append(_parrafo(
                f"{archivo.nombre} · {_fecha(archivo.fecha_subida)} · {autor_nombre}",
                normal,
            ))

    logs = list(tarea.logs.select_related("usuario", "subtarea").order_by("fecha"))
    if logs:
        story.append(PageBreak())
        story.append(Paragraph("Historial de la solicitud", seccion))
        for log in logs:
            usuario = getattr(log, "usuario", None)
            nombre = (
                f"{getattr(usuario, 'nombres', '')} {getattr(usuario, 'apellidos', '')}".strip()
                or "Sistema"
            )
            entidad_log = (
                f"Subtarea {log.subtarea.codigo or log.subtarea_id}"
                if log.subtarea_id
                else "Solicitud"
            )
            detalle = log.detalle or (
                f"{log.estado_anterior or ''} -> {log.estado_nuevo or ''}"
            ).strip()
            story.append(_parrafo(
                f"{_fecha(log.fecha)} · {log.get_tipo_evento_display()} · "
                f"{nombre} · {entidad_log} · {detalle}",
                normal,
            ))
            story.append(Spacer(1, 2))

    story.append(Spacer(1, 12))
    story.append(_parrafo(
        "Documento generado automáticamente por MF Tasks.",
        small,
    ))

    def _footer(canvas, documento):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#64748B"))
        canvas.drawString(
            18 * mm,
            10 * mm,
            f"MF Tasks · {tarea.ticket or tarea.id} · "
            f"{timezone.localtime(timezone.now()).strftime('%d/%m/%Y %H:%M')}",
        )
        canvas.drawRightString(
            A4[0] - 18 * mm,
            10 * mm,
            f"Página {documento.page}",
        )
        canvas.restoreState()

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()
