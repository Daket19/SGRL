# -*- coding: utf-8 -*-
import pyotp
import qrcode
import io
import base64
from datetime import timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.user import User, UserRole, UserStatus
from app.schemas.user import StudentRegister, StaffCreate
from app.schemas.auth import LoginRequest
from app.core.security import (
    verify_password, get_password_hash,
    create_access_token, create_verification_token,
    create_reset_token, decode_access_token,
)
from app.core.config import settings
from app.services.notification_service import send_verification_email, send_reset_email, create_notification
from app.models.notificacion import TipoNotificacion
import secrets
import string


def register_student(db: Session, data: StudentRegister) -> User:
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="El correo ya está registrado")
    if db.query(User).filter(User.codigo_estudiante == data.codigo_estudiante).first():
        raise HTTPException(status_code=400, detail="El código de estudiante ya existe")

    user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        role=UserRole.ESTUDIANTE,
        status=UserStatus.ACTIVO,
        nombres=data.nombres,
        apellidos=data.apellidos,
        telefono=data.telefono,
        rut=data.rut,
        codigo_estudiante=data.codigo_estudiante,
        carrera=data.carrera,
        ciclo_actual=data.ciclo_actual,
        anno_matricula=data.anno_matricula,
        email_verificado=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    admins = db.query(User).filter(User.role == UserRole.ADMIN_SISTEMA, User.status == UserStatus.ACTIVO).all()
    for adm in admins:
        create_notification(
            db, adm, TipoNotificacion.TRAMITE_RECIBIDO,
            "Nuevo estudiante registrado",
            f"Nuevo estudiante registrado: {user.nombres} {user.apellidos} \u2014 Carrera: {user.carrera}",
        )

    return user


def create_staff_user(db: Session, data: StaffCreate, created_by: User) -> User:
    if created_by.role != UserRole.ADMIN_SISTEMA:
        raise HTTPException(status_code=403, detail="Sin permisos")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="El correo ya está registrado")

    user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        role=data.role,
        status=UserStatus.ACTIVO,
        nombres=data.nombres,
        apellidos=data.apellidos,
        telefono=data.telefono,
        rut=data.rut,
        carrera_asignada=data.carrera_asignada,
        email_verificado=True,
        debe_cambiar_password=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    create_notification(
        db, created_by, TipoNotificacion.CAMBIO_ESTADO,
        "Usuario creado",
        f"Has creado el usuario {user.nombres} {user.apellidos} con rol {user.role.value}",
    )

    return user


def login(db: Session, data: LoginRequest):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    if user.status == UserStatus.INACTIVO:
        raise HTTPException(status_code=403, detail="Cuenta deshabilitada")
    if user.status == UserStatus.PENDIENTE_VERIFICACION:
        smtp_configured = bool(settings.SMTP_USER and settings.SMTP_PASSWORD)
        if smtp_configured:
            raise HTTPException(status_code=403, detail="Debes verificar tu correo primero")
        user.email_verificado = True
        user.status = UserStatus.ACTIVO
        db.commit()

    if user.totp_habilitado:
        temp_token = create_access_token(
            {"sub": str(user.id), "type": "2fa_pending"},
            expires_delta=timedelta(minutes=5),
        )
        return {"requires_2fa": True, "temp_token": temp_token}

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer", "requires_2fa": False, "user": user}


def verify_totp_and_login(db: Session, email: str, totp_code: str, temp_token: str):
    payload = decode_access_token(temp_token)
    if not payload or payload.get("type") != "2fa_pending":
        raise HTTPException(status_code=401, detail="Token temporal inválido")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(totp_code):
        raise HTTPException(status_code=401, detail="Código 2FA incorrecto")

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {"access_token": token, "token_type": "bearer", "requires_2fa": False, "user": user}


def setup_totp(user: User, db: Session):
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=user.email, issuer_name="SGRL")

    qr = qrcode.make(uri)
    buf = io.BytesIO()
    qr.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode()

    user.totp_secret = secret
    db.commit()
    return {"secret": secret, "qr_url": f"data:image/png;base64,{qr_b64}"}


def confirm_totp(user: User, db: Session, code: str):
    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="Primero configura el TOTP")
    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(code):
        raise HTTPException(status_code=400, detail="Código incorrecto")
    user.totp_habilitado = True
    db.commit()


def verify_email(db: Session, token: str):
    payload = decode_access_token(token)
    if not payload or payload.get("type") != "email_verification":
        raise HTTPException(status_code=400, detail="Token inválido o expirado")

    email = payload.get("sub")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user.email_verificado = True
    user.status = UserStatus.ACTIVO
    user.email_verification_token = None
    db.commit()


def request_password_reset(db: Session, email: str):
    user = db.query(User).filter(User.email == email).first()
    if user:
        token = create_reset_token(email)
        user.reset_password_token = token
        db.commit()
        send_reset_email(email, user.nombres, token)


def reset_password(db: Session, token: str, new_password: str):
    payload = decode_access_token(token)
    if not payload or payload.get("type") != "password_reset":
        raise HTTPException(status_code=400, detail="Token inválido o expirado")

    email = payload.get("sub")
    user = db.query(User).filter(User.email == email).first()
    if not user or user.reset_password_token != token:
        raise HTTPException(status_code=400, detail="Token inválido")

    user.hashed_password = get_password_hash(new_password)
    user.reset_password_token = None
    user.debe_cambiar_password = False
    db.commit()


def _generate_temp_password(length: int = 12) -> str:
    chars = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(chars) for _ in range(length))
