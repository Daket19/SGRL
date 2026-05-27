import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.notificacion import Notificacion, TipoNotificacion
from app.models.user import User
import uuid


def _send_email(to: str, subject: str, html_body: str):
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print(f"[EMAIL SIMULADO] Para: {to} | Asunto: {subject}")
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.SMTP_USER}>"
        msg["To"] = to
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_USER, to, msg.as_string())
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")


def send_verification_email(email: str, nombre: str, token: Optional[str], temp_password: Optional[str] = None):
    if temp_password:
        subject = "Bienvenido al SGRL - Tus credenciales de acceso"
        body = f"""
        <h2>Hola {nombre},</h2>
        <p>Tu cuenta en el Sistema de Gestión de Reincorporación y Licencia de Estudio ha sido creada.</p>
        <p><strong>Contraseña temporal:</strong> {temp_password}</p>
        <p>Deberás cambiarla en tu primer inicio de sesión.</p>
        """
    else:
        subject = "Verifica tu correo - SGRL"
        body = f"""
        <h2>Hola {nombre},</h2>
        <p>Para activar tu cuenta, haz clic en el siguiente enlace:</p>
        <a href="http://localhost:5173/verificar-email?token={token}">Verificar correo</a>
        <p>Este enlace expira en 24 horas.</p>
        """
    _send_email(email, subject, body)


def send_reset_email(email: str, nombre: str, token: str):
    subject = "Recuperar contraseña - SGRL"
    body = f"""
    <h2>Hola {nombre},</h2>
    <p>Recibimos una solicitud para restablecer tu contraseña.</p>
    <a href="http://localhost:5173/reset-password?token={token}">Restablecer contraseña</a>
    <p>Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.</p>
    """
    _send_email(email, subject, body)


def send_status_notification(email: str, nombre: str, tramite_codigo: str, nuevo_estado: str, mensaje: str = ""):
    subject = f"Actualización de tu trámite {tramite_codigo} - SGRL"
    body = f"""
    <h2>Hola {nombre},</h2>
    <p>Tu trámite <strong>{tramite_codigo}</strong> ha cambiado de estado a: <strong>{nuevo_estado}</strong>.</p>
    {f'<p>{mensaje}</p>' if mensaje else ''}
    <p>Ingresa al sistema para más detalles.</p>
    """
    _send_email(email, subject, body)


def create_notification(
    db: Session,
    usuario: User,
    tipo: TipoNotificacion,
    titulo: str,
    mensaje: str,
    tramite_tipo: Optional[str] = None,
    tramite_id=None,
):
    notif = Notificacion(
        usuario_id=usuario.id,
        tipo=tipo,
        titulo=titulo,
        mensaje=mensaje,
        tramite_tipo=tramite_tipo,
        tramite_id=tramite_id,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    send_status_notification(usuario.email, usuario.nombres, titulo, tipo.value, mensaje)
    return notif
