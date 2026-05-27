# -*- coding: utf-8 -*-
from sqlalchemy.orm import Session
from fastapi import HTTPException
from uuid import UUID
from datetime import date, datetime, timezone
from app.models.reincorporacion import Reincorporacion, TipoReincorporacion
from app.models.licencia import TramiteStatus
from app.models.user import User, UserRole, UserStatus
from app.models.notificacion import TipoNotificacion
from app.schemas.tramites import ReincorporacionCreate, DictamenReincorporacion, ResolucionReincorporacion
from app.schemas.licencia import AnularTramite
from app.services.notification_service import create_notification


def _generar_codigo(db: Session) -> str:
    year = datetime.now(timezone.utc).year
    count = db.query(Reincorporacion).count() + 1
    return f"REI-{year}-{count:04d}"


def crear_reincorporacion(db: Session, data: ReincorporacionCreate, estudiante: User) -> Reincorporacion:
    rei = Reincorporacion(
        codigo=_generar_codigo(db),
        estudiante_id=estudiante.id,
        tipo=data.tipo,
        numero_rd=data.numero_rd,
        ciclo_retorno=data.ciclo_retorno,
        status=TramiteStatus.BORRADOR,
    )
    db.add(rei)
    db.commit()
    db.refresh(rei)

    create_notification(
        db, estudiante, TipoNotificacion.TRAMITE_RECIBIDO,
        f"Reincorporaci\u00f3n {rei.codigo} creada",
        "Tu solicitud de reincorporaci\u00f3n fue creada. Procede al pago para continuar.",
        tramite_tipo="reincorporacion", tramite_id=rei.id,
    )

    coordinadores = db.query(User).filter(
        User.role == UserRole.COORDINADOR,
        User.carrera_asignada == estudiante.carrera,
        User.status == UserStatus.ACTIVO,
    ).all()
    for coord in coordinadores:
        create_notification(
            db, coord, TipoNotificacion.TRAMITE_RECIBIDO,
            f"Nueva solicitud {rei.codigo}",
            f"Nueva solicitud {rei.codigo} \u2014 Estudiante: {estudiante.nombres} {estudiante.apellidos}",
            tramite_tipo="reincorporacion", tramite_id=rei.id,
        )

    admins_sis = db.query(User).filter(User.role == UserRole.ADMIN_SISTEMA, User.status == UserStatus.ACTIVO).all()
    for adm in admins_sis:
        create_notification(
            db, adm, TipoNotificacion.TRAMITE_RECIBIDO,
            f"Nueva solicitud {rei.codigo}",
            f"Nueva solicitud {rei.codigo} del estudiante {estudiante.nombres} {estudiante.apellidos} \u2014 Carrera: {estudiante.carrera}",
            tramite_tipo="reincorporacion", tramite_id=rei.id,
        )

    return rei


def get_reincorporaciones_estudiante(db: Session, estudiante_id: UUID):
    return db.query(Reincorporacion).filter(Reincorporacion.estudiante_id == estudiante_id).all()


def get_reincorporacion(db: Session, rei_id: UUID, user: User) -> Reincorporacion:
    rei = db.query(Reincorporacion).filter(Reincorporacion.id == rei_id).first()
    if not rei:
        raise HTTPException(status_code=404, detail="Reincorporación no encontrada")
    if user.role == UserRole.ESTUDIANTE and rei.estudiante_id != user.id:
        raise HTTPException(status_code=403, detail="Sin acceso")
    return rei


def get_reincorporaciones_coordinador(db: Session, coordinador: User):
    return (
        db.query(Reincorporacion)
        .join(User, User.id == Reincorporacion.estudiante_id)
        .filter(
            Reincorporacion.status.in_([
                TramiteStatus.PENDIENTE_REVISION, TramiteStatus.EN_REVISION,
                TramiteStatus.RECHAZADO_COORDINADOR, TramiteStatus.APROBADO, TramiteStatus.RECHAZADO,
            ]),
            User.carrera == coordinador.carrera_asignada,
        )
        .all()
    )


def get_reincorporaciones_admin(db: Session):
    return db.query(Reincorporacion).filter(
        Reincorporacion.status.in_([
            TramiteStatus.EN_REVISION, TramiteStatus.APROBADO, TramiteStatus.RECHAZADO,
        ])
    ).all()


def emitir_dictamen_coordinador(db: Session, rei_id: UUID, data: DictamenReincorporacion, coordinador: User) -> Reincorporacion:
    rei = get_reincorporacion(db, rei_id, coordinador)
    if rei.status not in [TramiteStatus.PENDIENTE_REVISION, TramiteStatus.EN_REVISION]:
        raise HTTPException(status_code=400, detail="No está en revisión")

    rei.coordinador_id = coordinador.id
    rei.dictamen_coordinador = data.dictamen
    rei.status = TramiteStatus.EN_REVISION if data.aprobado else TramiteStatus.RECHAZADO_COORDINADOR
    db.commit()
    db.refresh(rei)

    estudiante = db.query(User).filter(User.id == rei.estudiante_id).first()
    if data.aprobado:
        create_notification(
            db, estudiante, TipoNotificacion.CAMBIO_ESTADO,
            f"Dictamen emitido - {rei.codigo}",
            "El coordinador emiti\u00f3 su dictamen: Favorable. Tu solicitud avanza a resoluci\u00f3n final.",
            tramite_tipo="reincorporacion", tramite_id=rei.id,
        )
    else:
        create_notification(
            db, estudiante, TipoNotificacion.CAMBIO_ESTADO,
            f"Solicitud rechazada por coordinador - {rei.codigo}",
            f"Tu solicitud {rei.codigo} fue rechazada por el coordinador. Motivo: {data.dictamen}. Por favor sube el documento correcto para continuar.",
            tramite_tipo="reincorporacion", tramite_id=rei.id,
        )

    create_notification(
        db, coordinador, TipoNotificacion.CAMBIO_ESTADO,
        f"Dictamen emitido \u2014 {rei.codigo}",
        f"Has emitido dictamen {'Favorable' if data.aprobado else 'Desfavorable'} para la solicitud {rei.codigo}",
        tramite_tipo="reincorporacion", tramite_id=rei.id,
    )

    admins = db.query(User).filter(
        User.role == UserRole.ADMIN_ACADEMICO,
        User.status == UserStatus.ACTIVO,
    ).all()
    for adm in admins:
        create_notification(
            db, adm, TipoNotificacion.CAMBIO_ESTADO,
            f"Dictamen recibido \u2014 {rei.codigo}",
            f"Solicitud {rei.codigo} de {estudiante.nombres} {estudiante.apellidos} revisada por coordinador \u2014 lista para resoluci\u00f3n final",
            tramite_tipo="reincorporacion", tramite_id=rei.id,
        )

    return rei


def aprobar_reincorporacion(db: Session, rei_id: UUID, data: ResolucionReincorporacion, admin: User) -> Reincorporacion:
    rei = db.query(Reincorporacion).filter(Reincorporacion.id == rei_id).first()
    if not rei:
        raise HTTPException(status_code=404, detail="Reincorporación no encontrada")
    if rei.status not in [TramiteStatus.PENDIENTE_REVISION, TramiteStatus.EN_REVISION]:
        raise HTTPException(status_code=400, detail="No puede ser resuelta en su estado actual")

    rei.admin_academico_id = admin.id
    rei.resolucion_admin = data.resolucion
    rei.numero_resolucion = data.numero_resolucion
    rei.fecha_resolucion = date.today()
    rei.status = TramiteStatus.APROBADO if data.aprobado else TramiteStatus.RECHAZADO

    if data.aprobado:
        # HU15 - Sincronizar estado interno
        rei.habilitado_inscripcion = "si"
        rei.habilitado_cobros = "si"

    db.commit()
    db.refresh(rei)

    estudiante = db.query(User).filter(User.id == rei.estudiante_id).first()
    tipo = TipoNotificacion.TRAMITE_APROBADO if data.aprobado else TipoNotificacion.TRAMITE_RECHAZADO
    create_notification(
        db, estudiante, tipo,
        f"Resoluci\u00f3n de reincorporaci\u00f3n - {rei.codigo}",
        f"Tu reincorporaci\u00f3n ha sido {'aprobada. Est\u00e1s habilitado para inscribir asignaturas.' if data.aprobado else 'rechazada.'}",
        tramite_tipo="reincorporacion", tramite_id=rei.id,
    )

    if data.aprobado:
        create_notification(
            db, estudiante, TipoNotificacion.REINCORPORACION_SINCRONIZADA,
            f"Estado sincronizado - {rei.codigo}",
            "Tu estado ha sido actualizado. Ya puedes inscribir asignaturas y realizar pagos.",
            tramite_tipo="reincorporacion", tramite_id=rei.id,
        )

    create_notification(
        db, admin, TipoNotificacion.CAMBIO_ESTADO,
        f"Resoluci\u00f3n emitida \u2014 {rei.codigo}",
        f"Has emitido resoluci\u00f3n {'Aprobada' if data.aprobado else 'Rechazada'} para la solicitud {rei.codigo}",
        tramite_tipo="reincorporacion", tramite_id=rei.id,
    )

    accion = "APROBADO" if data.aprobado else "RECHAZADO"
    admins = db.query(User).filter(User.role == UserRole.ADMIN_SISTEMA, User.status == UserStatus.ACTIVO).all()
    for adm in admins:
        create_notification(
            db, adm, TipoNotificacion.CAMBIO_ESTADO,
            f"Tr\u00e1mite {rei.codigo} {accion}",
            f"Tr\u00e1mite {rei.codigo} {accion} \u2014 Estudiante: {estudiante.nombres} {estudiante.apellidos}",
            tramite_tipo="reincorporacion", tramite_id=rei.id,
        )

    return rei


def anular_reincorporacion(db: Session, rei_id: UUID, data: AnularTramite, admin: User) -> Reincorporacion:
    rei = db.query(Reincorporacion).filter(Reincorporacion.id == rei_id).first()
    if not rei:
        raise HTTPException(status_code=404, detail="Reincorporación no encontrada")
    if rei.status == TramiteStatus.ANULADO:
        raise HTTPException(status_code=400, detail="Ya está anulada")

    rei.status = TramiteStatus.ANULADO
    rei.anulado_por_id = admin.id
    rei.motivo_anulacion = data.motivo
    db.commit()
    db.refresh(rei)

    estudiante = db.query(User).filter(User.id == rei.estudiante_id).first()
    create_notification(
        db, estudiante, TipoNotificacion.TRAMITE_ANULADO,
        f"Reincorporaci\u00f3n anulada - {rei.codigo}",
        f"Tu reincorporaci\u00f3n fue anulada. Motivo: {data.motivo}",
        tramite_tipo="reincorporacion", tramite_id=rei.id,
    )

    admins = db.query(User).filter(User.role == UserRole.ADMIN_SISTEMA, User.status == UserStatus.ACTIVO).all()
    for adm in admins:
        create_notification(
            db, adm, TipoNotificacion.TRAMITE_ANULADO,
            f"Tr\u00e1mite ANULADO \u2014 {rei.codigo}",
            f"Tr\u00e1mite {rei.codigo} ANULADO \u2014 Estudiante: {estudiante.nombres} {estudiante.apellidos}",
            tramite_tipo="reincorporacion", tramite_id=rei.id,
        )

    return rei


def rehabilitar_reincorporacion(db: Session, rei_id: UUID, admin: User) -> Reincorporacion:
    rei = db.query(Reincorporacion).filter(Reincorporacion.id == rei_id).first()
    if not rei:
        raise HTTPException(status_code=404, detail="Reincorporación no encontrada")
    if rei.status != TramiteStatus.ANULADO:
        raise HTTPException(status_code=400, detail="Solo se pueden rehabilitar trámites anulados")

    rei.status = TramiteStatus.PENDIENTE_REVISION
    rei.anulado_por_id = None
    rei.motivo_anulacion = None
    db.commit()
    db.refresh(rei)

    estudiante = db.query(User).filter(User.id == rei.estudiante_id).first()
    admins = db.query(User).filter(User.role == UserRole.ADMIN_SISTEMA, User.status == UserStatus.ACTIVO).all()
    for adm in admins:
        create_notification(
            db, adm, TipoNotificacion.CAMBIO_ESTADO,
            f"Tr\u00e1mite REHABILITADO \u2014 {rei.codigo}",
            f"Tr\u00e1mite {rei.codigo} REHABILITADO \u2014 Estudiante: {estudiante.nombres if estudiante else '\u2014'} {estudiante.apellidos if estudiante else ''}",
            tramite_tipo="reincorporacion", tramite_id=rei.id,
        )

    return rei
