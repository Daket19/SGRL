# -*- coding: utf-8 -*-
from sqlalchemy.orm import Session
from fastapi import HTTPException
from uuid import UUID
from datetime import date
from app.models.licencia import Licencia, TramiteStatus, MotivoLicencia
from app.models.user import User, UserRole, UserStatus
from app.models.notificacion import TipoNotificacion
from app.schemas.licencia import LicenciaCreate, DictamenCoordinador, ResolucionAdmin, AnularTramite
from app.services.notification_service import create_notification
import random
import string
from datetime import datetime, timezone


def _generar_codigo(db: Session) -> str:
    year = datetime.now(timezone.utc).year
    count = db.query(Licencia).count() + 1
    return f"LIC-{year}-{count:04d}"


def crear_licencia(db: Session, data: LicenciaCreate, estudiante: User) -> Licencia:
    if data.fecha_fin <= data.fecha_inicio:
        raise HTTPException(status_code=400, detail="La fecha de fin debe ser posterior a la de inicio")

    licencia = Licencia(
        codigo=_generar_codigo(db),
        estudiante_id=estudiante.id,
        motivo=data.motivo,
        descripcion=data.descripcion,
        fecha_inicio=data.fecha_inicio,
        fecha_fin=data.fecha_fin,
        status=TramiteStatus.BORRADOR,
    )
    db.add(licencia)
    db.commit()
    db.refresh(licencia)

    create_notification(
        db, estudiante, TipoNotificacion.TRAMITE_RECIBIDO,
        f"Licencia {licencia.codigo} creada",
        "Tu solicitud de licencia fue creada. Procede al pago para continuar.",
        tramite_tipo="licencia", tramite_id=licencia.id,
    )

    coordinadores = db.query(User).filter(
        User.role == UserRole.COORDINADOR,
        User.carrera_asignada == estudiante.carrera,
        User.status == UserStatus.ACTIVO,
    ).all()
    for coord in coordinadores:
        create_notification(
            db, coord, TipoNotificacion.TRAMITE_RECIBIDO,
            f"Nueva solicitud {licencia.codigo}",
            f"Nueva solicitud {licencia.codigo} \u2014 Estudiante: {estudiante.nombres} {estudiante.apellidos}",
            tramite_tipo="licencia", tramite_id=licencia.id,
        )

    admins_sis = db.query(User).filter(User.role == UserRole.ADMIN_SISTEMA, User.status == UserStatus.ACTIVO).all()
    for adm in admins_sis:
        create_notification(
            db, adm, TipoNotificacion.TRAMITE_RECIBIDO,
            f"Nueva solicitud {licencia.codigo}",
            f"Nueva solicitud {licencia.codigo} del estudiante {estudiante.nombres} {estudiante.apellidos} \u2014 Carrera: {estudiante.carrera}",
            tramite_tipo="licencia", tramite_id=licencia.id,
        )

    return licencia


def get_licencias_estudiante(db: Session, estudiante_id: UUID):
    return db.query(Licencia).filter(Licencia.estudiante_id == estudiante_id).all()


def get_licencia(db: Session, licencia_id: UUID, user: User) -> Licencia:
    lic = db.query(Licencia).filter(Licencia.id == licencia_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Licencia no encontrada")

    if user.role == UserRole.ESTUDIANTE and lic.estudiante_id != user.id:
        raise HTTPException(status_code=403, detail="Sin acceso a esta licencia")
    return lic


def get_licencias_coordinador(db: Session, coordinador: User):
    return (
        db.query(Licencia)
        .join(User, User.id == Licencia.estudiante_id)
        .filter(
            Licencia.status.in_([
                TramiteStatus.PENDIENTE_REVISION, TramiteStatus.EN_REVISION,
                TramiteStatus.RECHAZADO_COORDINADOR, TramiteStatus.APROBADO, TramiteStatus.RECHAZADO,
            ]),
            User.carrera == coordinador.carrera_asignada,
        )
        .all()
    )


def get_licencias_admin(db: Session):
    return db.query(Licencia).filter(
        Licencia.status.in_([
            TramiteStatus.EN_REVISION, TramiteStatus.APROBADO, TramiteStatus.RECHAZADO,
        ])
    ).all()


def emitir_dictamen_coordinador(db: Session, licencia_id: UUID, data: DictamenCoordinador, coordinador: User) -> Licencia:
    lic = get_licencia(db, licencia_id, coordinador)
    if lic.status not in [TramiteStatus.PENDIENTE_REVISION, TramiteStatus.EN_REVISION]:
        raise HTTPException(status_code=400, detail="Esta licencia no está en revisión")

    lic.coordinador_id = coordinador.id
    lic.dictamen_coordinador = data.dictamen
    lic.status = TramiteStatus.EN_REVISION if data.aprobado else TramiteStatus.RECHAZADO_COORDINADOR
    db.commit()
    db.refresh(lic)

    estudiante = db.query(User).filter(User.id == lic.estudiante_id).first()
    if data.aprobado:
        create_notification(
            db, estudiante, TipoNotificacion.CAMBIO_ESTADO,
            f"Dictamen emitido - {lic.codigo}",
            "El coordinador ha emitido su dictamen: Favorable. Tu solicitud avanza a resoluci\u00f3n final.",
            tramite_tipo="licencia", tramite_id=lic.id,
        )
    else:
        create_notification(
            db, estudiante, TipoNotificacion.CAMBIO_ESTADO,
            f"Solicitud rechazada por coordinador - {lic.codigo}",
            f"Tu solicitud {lic.codigo} fue rechazada por el coordinador. Motivo: {data.dictamen}. Por favor sube el documento correcto para continuar.",
            tramite_tipo="licencia", tramite_id=lic.id,
        )

    create_notification(
        db, coordinador, TipoNotificacion.CAMBIO_ESTADO,
        f"Dictamen emitido \u2014 {lic.codigo}",
        f"Has emitido dictamen {'Favorable' if data.aprobado else 'Desfavorable'} para la solicitud {lic.codigo}",
        tramite_tipo="licencia", tramite_id=lic.id,
    )

    admins = db.query(User).filter(
        User.role == UserRole.ADMIN_ACADEMICO,
        User.status == UserStatus.ACTIVO,
    ).all()
    for adm in admins:
        create_notification(
            db, adm, TipoNotificacion.CAMBIO_ESTADO,
            f"Dictamen recibido \u2014 {lic.codigo}",
            f"Solicitud {lic.codigo} de {estudiante.nombres} {estudiante.apellidos} revisada por coordinador \u2014 lista para resoluci\u00f3n final",
            tramite_tipo="licencia", tramite_id=lic.id,
        )

    return lic


def emitir_resolucion_admin(db: Session, licencia_id: UUID, data: ResolucionAdmin, admin: User) -> Licencia:
    lic = db.query(Licencia).filter(Licencia.id == licencia_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Licencia no encontrada")
    if lic.status not in [TramiteStatus.PENDIENTE_REVISION, TramiteStatus.EN_REVISION]:
        raise HTTPException(status_code=400, detail="Esta licencia no puede ser resuelta en su estado actual")

    lic.admin_academico_id = admin.id
    lic.resolucion_admin = data.resolucion
    lic.numero_resolucion = data.numero_resolucion
    lic.fecha_resolucion = date.today()
    lic.status = TramiteStatus.APROBADO if data.aprobado else TramiteStatus.RECHAZADO
    db.commit()
    db.refresh(lic)

    estudiante = db.query(User).filter(User.id == lic.estudiante_id).first()
    tipo = TipoNotificacion.TRAMITE_APROBADO if data.aprobado else TipoNotificacion.TRAMITE_RECHAZADO
    create_notification(
        db, estudiante, tipo,
        f"Resoluci\u00f3n de licencia - {lic.codigo}",
        f"Tu licencia ha sido {'aprobada' if data.aprobado else 'rechazada'}. N\u00b0 Resoluci\u00f3n: {data.numero_resolucion}",
        tramite_tipo="licencia", tramite_id=lic.id,
    )

    create_notification(
        db, admin, TipoNotificacion.CAMBIO_ESTADO,
        f"Resoluci\u00f3n emitida \u2014 {lic.codigo}",
        f"Has emitido resoluci\u00f3n {'Aprobada' if data.aprobado else 'Rechazada'} para la solicitud {lic.codigo}",
        tramite_tipo="licencia", tramite_id=lic.id,
    )

    accion = "APROBADO" if data.aprobado else "RECHAZADO"
    admins = db.query(User).filter(User.role == UserRole.ADMIN_SISTEMA, User.status == UserStatus.ACTIVO).all()
    for adm in admins:
        create_notification(
            db, adm, TipoNotificacion.CAMBIO_ESTADO,
            f"Tr\u00e1mite {lic.codigo} {accion}",
            f"Tr\u00e1mite {lic.codigo} {accion} \u2014 Estudiante: {estudiante.nombres} {estudiante.apellidos}",
            tramite_tipo="licencia", tramite_id=lic.id,
        )

    return lic


def anular_licencia(db: Session, licencia_id: UUID, data: AnularTramite, admin: User) -> Licencia:
    lic = db.query(Licencia).filter(Licencia.id == licencia_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Licencia no encontrada")
    if lic.status == TramiteStatus.ANULADO:
        raise HTTPException(status_code=400, detail="Ya está anulada")

    lic.status = TramiteStatus.ANULADO
    lic.anulado_por_id = admin.id
    lic.motivo_anulacion = data.motivo
    db.commit()
    db.refresh(lic)

    estudiante = db.query(User).filter(User.id == lic.estudiante_id).first()
    create_notification(
        db, estudiante, TipoNotificacion.TRAMITE_ANULADO,
        f"Licencia anulada - {lic.codigo}",
        f"Tu licencia fue anulada. Motivo: {data.motivo}",
        tramite_tipo="licencia", tramite_id=lic.id,
    )

    admins = db.query(User).filter(User.role == UserRole.ADMIN_SISTEMA, User.status == UserStatus.ACTIVO).all()
    for adm in admins:
        create_notification(
            db, adm, TipoNotificacion.TRAMITE_ANULADO,
            f"Tr\u00e1mite ANULADO \u2014 {lic.codigo}",
            f"Tr\u00e1mite {lic.codigo} ANULADO \u2014 Estudiante: {estudiante.nombres} {estudiante.apellidos}",
            tramite_tipo="licencia", tramite_id=lic.id,
        )

    return lic


def rehabilitar_licencia(db: Session, licencia_id: UUID, admin: User) -> Licencia:
    lic = db.query(Licencia).filter(Licencia.id == licencia_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Licencia no encontrada")
    if lic.status != TramiteStatus.ANULADO:
        raise HTTPException(status_code=400, detail="Solo se pueden rehabilitar trámites anulados")

    lic.status = TramiteStatus.PENDIENTE_REVISION
    lic.anulado_por_id = None
    lic.motivo_anulacion = None
    db.commit()
    db.refresh(lic)

    estudiante = db.query(User).filter(User.id == lic.estudiante_id).first()
    nombre = estudiante.nombres if estudiante else "N/D"
    apellido = estudiante.apellidos if estudiante else ""
    admins = db.query(User).filter(User.role == UserRole.ADMIN_SISTEMA, User.status == UserStatus.ACTIVO).all()
    for adm in admins:
        create_notification(
            db, adm, TipoNotificacion.CAMBIO_ESTADO,
            f"Tr\u00e1mite REHABILITADO \u2014 {lic.codigo}",
            f"Tr\u00e1mite {lic.codigo} REHABILITADO \u2014 Estudiante: {nombre} {apellido}",
            tramite_tipo="licencia", tramite_id=lic.id,
        )

    return lic
