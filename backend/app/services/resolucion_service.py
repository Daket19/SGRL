from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
import io
from datetime import datetime, timezone


def generar_resolucion_licencia_pdf(licencia, estudiante, admin) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=2*cm, bottomMargin=2*cm,
        leftMargin=2.5*cm, rightMargin=2.5*cm
    )
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle("title", parent=styles["Heading1"], fontSize=14, alignment=TA_CENTER, spaceAfter=6, fontName="Helvetica-Bold")
    subtitle_style = ParagraphStyle("subtitle", parent=styles["Normal"], fontSize=11, alignment=TA_CENTER, spaceAfter=4)
    body_style = ParagraphStyle("body", parent=styles["Normal"], fontSize=10, alignment=TA_JUSTIFY, spaceAfter=8, leading=14)
    bold_style = ParagraphStyle("bold", parent=styles["Normal"], fontSize=10, fontName="Helvetica-Bold", spaceAfter=4)

    # Encabezado
    story.append(Paragraph("ESCUELA DE EDUCACIÓN SUPERIOR PEDAGÓGICA", title_style))
    story.append(Paragraph("SISTEMA DE GESTIÓN DE REINCORPORACIÓN Y LICENCIA DE ESTUDIO", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.darkblue))
    story.append(Spacer(1, 0.5*cm))

    # Número de resolución
    story.append(Paragraph(f"RESOLUCIÓN DIRECTORAL N° {licencia.numero_resolucion}", title_style))
    story.append(Paragraph(f"Fecha: {licencia.fecha_resolucion.strftime('%d de %B de %Y') if licencia.fecha_resolucion else datetime.now().strftime('%d de %B de %Y')}", subtitle_style))
    story.append(Spacer(1, 0.5*cm))

    # Vistos
    story.append(Paragraph("VISTOS:", bold_style))
    story.append(Paragraph(
        f"La solicitud de licencia de estudios presentada por el/la estudiante "
        f"<b>{estudiante.nombres} {estudiante.apellidos}</b>, con código estudiantil "
        f"<b>{estudiante.codigo_estudiante}</b>, perteneciente al programa de "
        f"<b>{estudiante.carrera}</b>; y,",
        body_style
    ))
    story.append(Spacer(1, 0.3*cm))

    # Considerando
    story.append(Paragraph("CONSIDERANDO:", bold_style))
    story.append(Paragraph(
        f"Que el/la estudiante ha solicitado licencia de estudios por motivo de "
        f"<b>{licencia.motivo.value.upper()}</b>, para el período comprendido entre el "
        f"<b>{licencia.fecha_inicio.strftime('%d/%m/%Y')}</b> y el "
        f"<b>{licencia.fecha_fin.strftime('%d/%m/%Y')}</b>;",
        body_style
    ))
    story.append(Paragraph(
        f"Que la solicitud ha sido evaluada y dictaminada favorablemente conforme a las "
        f"disposiciones establecidas en el Reglamento Institucional;",
        body_style
    ))
    story.append(Spacer(1, 0.3*cm))

    # Resolución
    story.append(Paragraph("SE RESUELVE:", bold_style))
    story.append(Paragraph(
        f"<b>ARTÍCULO PRIMERO:</b> APROBAR la licencia de estudios solicitada por el/la estudiante "
        f"{estudiante.nombres} {estudiante.apellidos}, código {estudiante.codigo_estudiante}, "
        f"del programa {estudiante.carrera}.",
        body_style
    ))
    story.append(Paragraph(
        f"<b>ARTÍCULO SEGUNDO:</b> La licencia comprende el período del "
        f"{licencia.fecha_inicio.strftime('%d/%m/%Y')} al {licencia.fecha_fin.strftime('%d/%m/%Y')}.",
        body_style
    ))
    story.append(Paragraph(
        f"<b>ARTÍCULO TERCERO:</b> El/la estudiante deberá presentar esta Resolución Directoral "
        f"al momento de solicitar su reincorporación a las actividades académicas.",
        body_style
    ))

    if licencia.resolucion_admin:
        story.append(Paragraph(f"<b>FUNDAMENTO:</b> {licencia.resolucion_admin}", body_style))

    story.append(Spacer(1, 1*cm))

    # Firma
    firma_data = [
        ["", ""],
        ["_______________________________", ""],
        [f"{admin.nombres} {admin.apellidos}", ""],
        ["Administrador/a Académico/a", ""],
        ["SGRL - Sistema de Gestión", ""],
    ]
    firma_table = Table(firma_data, colWidths=[8*cm, 8*cm])
    firma_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(firma_table)
    story.append(Spacer(1, 0.5*cm))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
    story.append(Paragraph(
        f"Documento generado el {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M')} UTC — "
        f"Código de licencia: {licencia.codigo} — N° Resolución: {licencia.numero_resolucion}",
        ParagraphStyle("footer", parent=styles["Normal"], fontSize=7, alignment=TA_CENTER, textColor=colors.grey)
    ))

    doc.build(story)
    return buffer.getvalue()


def generar_resolucion_reincorporacion_pdf(reincorporacion, estudiante, admin) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=2*cm, bottomMargin=2*cm,
        leftMargin=2.5*cm, rightMargin=2.5*cm
    )
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle("title", parent=styles["Heading1"], fontSize=14, alignment=TA_CENTER, spaceAfter=6, fontName="Helvetica-Bold")
    subtitle_style = ParagraphStyle("subtitle", parent=styles["Normal"], fontSize=11, alignment=TA_CENTER, spaceAfter=4)
    body_style = ParagraphStyle("body", parent=styles["Normal"], fontSize=10, alignment=TA_JUSTIFY, spaceAfter=8, leading=14)
    bold_style = ParagraphStyle("bold", parent=styles["Normal"], fontSize=10, fontName="Helvetica-Bold", spaceAfter=4)

    story.append(Paragraph("ESCUELA DE EDUCACIÓN SUPERIOR PEDAGÓGICA", title_style))
    story.append(Paragraph("SISTEMA DE GESTIÓN DE REINCORPORACIÓN Y LICENCIA DE ESTUDIO", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.darkblue))
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph(f"RESOLUCIÓN DE REINCORPORACIÓN N° {reincorporacion.numero_resolucion}", title_style))
    story.append(Paragraph(f"Fecha: {reincorporacion.fecha_resolucion.strftime('%d de %B de %Y') if reincorporacion.fecha_resolucion else datetime.now().strftime('%d de %B de %Y')}", subtitle_style))
    story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph("VISTOS:", bold_style))
    story.append(Paragraph(
        f"La solicitud de reincorporación presentada por el/la estudiante "
        f"<b>{estudiante.nombres} {estudiante.apellidos}</b>, código <b>{estudiante.codigo_estudiante}</b>, "
        f"programa <b>{estudiante.carrera}</b>;",
        body_style
    ))

    story.append(Paragraph("CONSIDERANDO:", bold_style))
    story.append(Paragraph(
        f"Que el/la estudiante ha cumplido con los requisitos para su reincorporación, "
        f"presentando la Resolución Directoral N° <b>{reincorporacion.numero_rd}</b> "
        f"y los documentos correspondientes;",
        body_style
    ))

    story.append(Paragraph("SE RESUELVE:", bold_style))
    story.append(Paragraph(
        f"<b>ARTÍCULO PRIMERO:</b> APROBAR la reincorporación del/la estudiante "
        f"{estudiante.nombres} {estudiante.apellidos}, código {estudiante.codigo_estudiante}.",
        body_style
    ))
    story.append(Paragraph(
        f"<b>ARTÍCULO SEGUNDO:</b> El/la estudiante queda habilitado/a para retomar sus "
        f"actividades académicas a partir del ciclo <b>{reincorporacion.ciclo_retorno}</b>.",
        body_style
    ))
    story.append(Paragraph(
        f"<b>ARTÍCULO TERCERO:</b> Se habilita al/la estudiante para inscripción de asignaturas y cobros.",
        body_style
    ))

    story.append(Spacer(1, 1*cm))
    firma_data = [
        ["", ""],
        ["_______________________________", ""],
        [f"{admin.nombres} {admin.apellidos}", ""],
        ["Administrador/a Académico/a", ""],
        ["SGRL - Sistema de Gestión", ""],
    ]
    firma_table = Table(firma_data, colWidths=[8*cm, 8*cm])
    firma_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(firma_table)
    story.append(Spacer(1, 0.5*cm))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.grey))
    story.append(Paragraph(
        f"Documento generado el {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M')} UTC — "
        f"Código: {reincorporacion.codigo} — N° Resolución: {reincorporacion.numero_resolucion}",
        ParagraphStyle("footer", parent=styles["Normal"], fontSize=7, alignment=TA_CENTER, textColor=colors.grey)
    ))

    doc.build(story)
    return buffer.getvalue()
