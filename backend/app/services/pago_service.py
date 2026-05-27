# -*- coding: utf-8 -*-
import uuid
import random
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.units import cm
import io

from app.models.pago import Pago, PagoStatus, TipoPago
from app.models.licencia import Licencia, TramiteStatus
from app.models.reincorporacion import Reincorporacion
from app.models.notificacion import TipoNotificacion
from app.models.user import User, UserRole, UserStatus
from app.schemas.tramites import PagoCreate
from app.services.notification_service import create_notification
from app.core.config import settings


def iniciar_pago_licencia(db: Session, licencia_id: uuid.UUID, estudiante: User) -> Pago:
    lic = db.query(Licencia).filter(Licencia.id == licencia_id, Licencia.estudiante_id == estudiante.id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Licencia no encontrada")
    if lic.status != TramiteStatus.BORRADOR:
        raise HTTPException(status_code=400, detail="Esta licencia ya fue pagada o no puede pagarse")
    if lic.pago:
        raise HTTPException(status_code=400, detail="Ya existe un pago para esta licencia")

    fecha_caducidad = datetime.now(timezone.utc) + timedelta(hours=settings.HORAS_CADUCIDAD_PAGO)
    pago = Pago(
        codigo_transaccion=_generar_codigo_transaccion(),
        tipo_tramite=TipoPago.LICENCIA,
        licencia_id=licencia_id,
        estudiante_id=estudiante.id,
        monto=settings.MONTO_LICENCIA,
        status=PagoStatus.PENDIENTE,
        fecha_caducidad=fecha_caducidad,
    )
    db.add(pago)
    db.commit()
    db.refresh(pago)
    return pago


def iniciar_pago_reincorporacion(db: Session, rei_id: uuid.UUID, estudiante: User) -> Pago:
    rei = db.query(Reincorporacion).filter(Reincorporacion.id == rei_id, Reincorporacion.estudiante_id == estudiante.id).first()
    if not rei:
        raise HTTPException(status_code=404, detail="Reincorporación no encontrada")
    if rei.status != TramiteStatus.BORRADOR:
        raise HTTPException(status_code=400, detail="Esta reincorporación ya fue pagada o no puede pagarse")
    if rei.pago:
        raise HTTPException(status_code=400, detail="Ya existe un pago para esta reincorporación")

    fecha_caducidad = datetime.now(timezone.utc) + timedelta(hours=settings.HORAS_CADUCIDAD_PAGO)
    pago = Pago(
        codigo_transaccion=_generar_codigo_transaccion(),
        tipo_tramite=TipoPago.REINCORPORACION,
        reincorporacion_id=rei_id,
        estudiante_id=estudiante.id,
        monto=settings.MONTO_REINCORPORACION,
        status=PagoStatus.PENDIENTE,
        fecha_caducidad=fecha_caducidad,
    )
    db.add(pago)
    db.commit()
    db.refresh(pago)
    return pago


def procesar_pago(db: Session, pago_id: uuid.UUID, data: PagoCreate, estudiante: User) -> Pago:
    pago = db.query(Pago).filter(Pago.id == pago_id, Pago.estudiante_id == estudiante.id).first()
    if not pago:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    if pago.status == PagoStatus.FALLIDO:
        pago.status = PagoStatus.PENDIENTE  # permite reintentar
    elif pago.status != PagoStatus.PENDIENTE:
        raise HTTPException(status_code=400, detail="El pago no puede ser procesado en su estado actual")

    ahora = datetime.now(timezone.utc)
    if pago.fecha_caducidad and ahora > pago.fecha_caducidad:
        pago.status = PagoStatus.CADUCADO
        _marcar_tramite_caducado(db, pago)
        db.commit()
        raise HTTPException(status_code=400, detail="El plazo de pago ha caducado (72 horas)")

    # Simulación: 95% de éxito
    exito = random.random() < 0.95

    if exito:
        pago.status = PagoStatus.COMPLETADO
        pago.ultimos_digitos = data.numero_tarjeta[-4:]
        pago.tipo_tarjeta = data.tipo_tarjeta
        pago.fecha_pago = ahora
        pago.numero_comprobante = f"COMP-{ahora.strftime('%Y%m%d')}-{random.randint(10000,99999)}"
        pago.respuesta_gateway = "APROBADO"

        _avanzar_tramite_post_pago(db, pago)

        create_notification(
            db, estudiante, TipoNotificacion.PAGO_CONFIRMADO,
            f"Pago confirmado - {pago.codigo_transaccion}",
            f"Tu pago de ${pago.monto:,.0f} CLP fue confirmado. Comprobante: {pago.numero_comprobante}",
        )

        codigo = _get_codigo_tramite(db, pago)
        admins = db.query(User).filter(User.role == UserRole.ADMIN_SISTEMA, User.status == UserStatus.ACTIVO).all()
        for adm in admins:
            create_notification(
                db, adm, TipoNotificacion.PAGO_CONFIRMADO,
                f"Pago completado \u2014 {codigo}",
                f"Pago completado \u2014 Tr\u00e1mite {codigo} por ${float(pago.monto):,.0f} CLP del estudiante {estudiante.nombres} {estudiante.apellidos}",
            )
    else:
        pago.status = PagoStatus.FALLIDO
        pago.respuesta_gateway = "RECHAZADO POR FONDOS INSUFICIENTES"

    db.commit()
    db.refresh(pago)
    return pago


def _avanzar_tramite_post_pago(db: Session, pago: Pago):
    if pago.tipo_tramite == TipoPago.LICENCIA and pago.licencia_id:
        lic = db.query(Licencia).filter(Licencia.id == pago.licencia_id).first()
        if lic:
            lic.status = TramiteStatus.PENDIENTE_REVISION
    elif pago.tipo_tramite == TipoPago.REINCORPORACION and pago.reincorporacion_id:
        rei = db.query(Reincorporacion).filter(Reincorporacion.id == pago.reincorporacion_id).first()
        if rei:
            rei.status = TramiteStatus.PENDIENTE_REVISION


def _get_codigo_tramite(db: Session, pago: Pago) -> str:
    if pago.tipo_tramite == TipoPago.LICENCIA and pago.licencia_id:
        lic = db.query(Licencia).filter(Licencia.id == pago.licencia_id).first()
        return lic.codigo if lic else "—"
    elif pago.tipo_tramite == TipoPago.REINCORPORACION and pago.reincorporacion_id:
        rei = db.query(Reincorporacion).filter(Reincorporacion.id == pago.reincorporacion_id).first()
        return rei.codigo if rei else "—"
    return "—"


def _marcar_tramite_caducado(db: Session, pago: Pago):
    estudiante = db.query(User).filter(User.id == pago.estudiante_id).first()
    codigo = _get_codigo_tramite(db, pago)

    if pago.tipo_tramite == TipoPago.LICENCIA and pago.licencia_id:
        lic = db.query(Licencia).filter(Licencia.id == pago.licencia_id).first()
        if lic:
            lic.status = TramiteStatus.CADUCADO
    elif pago.tipo_tramite == TipoPago.REINCORPORACION and pago.reincorporacion_id:
        rei = db.query(Reincorporacion).filter(Reincorporacion.id == pago.reincorporacion_id).first()
        if rei:
            rei.status = TramiteStatus.CADUCADO

    if estudiante:
        admins = db.query(User).filter(User.role == UserRole.ADMIN_SISTEMA, User.status == UserStatus.ACTIVO).all()
        for adm in admins:
            create_notification(
                db, adm, TipoNotificacion.CAMBIO_ESTADO,
                f"Pago caducado \u2014 {codigo}",
                f"Pago caducado \u2014 Tr\u00e1mite {codigo} del estudiante {estudiante.nombres} {estudiante.apellidos} no fue pagado en 72 horas",
            )


def generar_comprobante_pdf(pago: Pago, estudiante: User) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle("title", parent=styles["Heading1"], fontSize=16, alignment=1, spaceAfter=12)
    story.append(Paragraph("SISTEMA DE GESTIÓN DE REINCORPORACIÓN Y LICENCIA DE ESTUDIO", title_style))
    story.append(Paragraph("COMPROBANTE DE PAGO", title_style))
    story.append(Spacer(1, 0.5*cm))

    data_table = [
        ["N° Comprobante:", pago.numero_comprobante or "—"],
        ["N° Transacción:", pago.codigo_transaccion],
        ["Fecha de pago:", pago.fecha_pago.strftime("%d/%m/%Y %H:%M") if pago.fecha_pago else "—"],
        ["Estudiante:", f"{estudiante.nombres} {estudiante.apellidos}"],
        ["Correo:", estudiante.email],
        ["Código estudiante:", estudiante.codigo_estudiante or "—"],
        ["Tipo de trámite:", pago.tipo_tramite.value.upper()],
        ["Monto pagado:", f"${float(pago.monto):,.0f} {pago.moneda}"],
        ["Tarjeta:", f"{pago.tipo_tarjeta or '—'} ****{pago.ultimos_digitos or '—'}"],
        ["Estado:", "PAGADO"],
    ]

    table = Table(data_table, colWidths=[5*cm, 10*cm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.lightgrey),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.whitesmoke, colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(table)
    story.append(Spacer(1, cm))
    story.append(Paragraph("Este comprobante es válido como soporte legal del pago realizado.", styles["Normal"]))

    doc.build(story)
    return buffer.getvalue()


def _generar_codigo_transaccion() -> str:
    return f"TXN-{uuid.uuid4().hex[:12].upper()}"
