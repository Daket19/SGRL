from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from uuid import UUID
import csv, io
from datetime import datetime, timezone

from app.db.session import get_db
from app.core.deps import get_admin_sistema, get_current_active_verified_user
from app.schemas.user import UserResponse, StaffCreate, UserAdminUpdate
from app.schemas.tramites import NotificacionResponse
from app.models.user import User, UserRole, UserStatus
from app.models.notificacion import Notificacion
from app.models.licencia import Licencia, TramiteStatus
from app.models.reincorporacion import Reincorporacion
from app.models.pago import Pago
from app.services import auth_service
from app.services.notification_service import create_notification
from app.models.notificacion import TipoNotificacion
from app.core.config import settings
import anthropic

router_users = APIRouter(prefix="/usuarios", tags=["Usuarios"])
router_notif = APIRouter(prefix="/notificaciones", tags=["Notificaciones"])
router_reports = APIRouter(prefix="/reportes", tags=["Reportes"])
router_chatbot = APIRouter(prefix="/chatbot", tags=["Chatbot"])


# ═══════════════════════ USUARIOS ════════════════════════════════════════════

@router_users.post("/staff", response_model=UserResponse, status_code=201)
def crear_staff(data: StaffCreate, db: Session = Depends(get_db), current_user: User = Depends(get_admin_sistema)):
    return auth_service.create_staff_user(db, data, current_user)


@router_users.get("")
def listar_usuarios(
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    search: Optional[str] = Query(None),
    role: Optional[UserRole] = Query(None),
    status: Optional[UserStatus] = Query(None),
    carrera: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_sistema),
):
    import math
    q = db.query(User)
    if search:
        q = q.filter(or_(
            User.nombres.ilike(f"%{search}%"),
            User.apellidos.ilike(f"%{search}%"),
            User.email.ilike(f"%{search}%"),
            User.codigo_estudiante.ilike(f"%{search}%"),
        ))
    if role:
        q = q.filter(User.role == role)
    if status:
        q = q.filter(User.status == status)
    if carrera:
        q = q.filter(or_(
            User.carrera.ilike(f"%{carrera}%"),
            User.carrera_asignada.ilike(f"%{carrera}%"),
        ))
    total = q.count()
    items = q.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    from app.schemas.user import UserResponse as UR
    return {
        "items": [UR.model_validate(u).model_dump(mode="json") for u in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)),
    }


@router_users.get("/{user_id}", response_model=UserResponse)
def get_usuario(user_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_admin_sistema)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


@router_users.put("/{user_id}", response_model=UserResponse)
def editar_usuario(user_id: UUID, data: UserAdminUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_admin_sistema)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router_users.post("/{user_id}/deshabilitar")
def deshabilitar(user_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_admin_sistema)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.status = UserStatus.INACTIVO
    db.commit()
    return {"message": "Cuenta deshabilitada"}


@router_users.post("/{user_id}/habilitar")
def habilitar(user_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_admin_sistema)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user.status = UserStatus.ACTIVO
    db.commit()
    return {"message": "Cuenta habilitada"}


# ═══════════════════════ NOTIFICACIONES ═══════════════════════════════════════

@router_notif.get("")
def mis_notificaciones(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    tipo: Optional[str] = Query(None),
    leida: Optional[bool] = Query(None),
    fecha_inicio: Optional[str] = Query(None),
    fecha_fin: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_verified_user),
):
    import math
    q = db.query(Notificacion).filter(Notificacion.usuario_id == current_user.id)
    if tipo:
        q = q.filter(Notificacion.tipo == tipo)
    if leida is not None:
        q = q.filter(Notificacion.leida == leida)
    if fecha_inicio:
        q = q.filter(Notificacion.created_at >= fecha_inicio)
    if fecha_fin:
        q = q.filter(Notificacion.created_at <= fecha_fin)
    total = q.count()
    no_leidas = db.query(Notificacion).filter(
        Notificacion.usuario_id == current_user.id,
        Notificacion.leida == False,
    ).count()
    items = q.order_by(Notificacion.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [NotificacionResponse.model_validate(i).model_dump(mode="json") for i in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)),
        "no_leidas": no_leidas,
    }


@router_notif.post("/{notif_id}/leer")
def marcar_leida(notif_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_verified_user)):
    notif = db.query(Notificacion).filter(Notificacion.id == notif_id, Notificacion.usuario_id == current_user.id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    notif.leida = True
    db.commit()
    return {"message": "Marcada como leída"}


@router_notif.post("/leer-todas")
def marcar_todas_leidas(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_verified_user)):
    db.query(Notificacion).filter(Notificacion.usuario_id == current_user.id, Notificacion.leida == False).update({"leida": True})
    db.commit()
    return {"message": "Todas marcadas como leídas"}


# ═══════════════════════ REPORTES Y MÉTRICAS ══════════════════════════════════

@router_reports.get("/metricas")
def metricas(db: Session = Depends(get_db), current_user: User = Depends(get_admin_sistema)):
    total_lic = db.query(Licencia).count()
    total_rei = db.query(Reincorporacion).count()
    total_users = db.query(User).count()

    lic_por_estado = db.query(Licencia.status, func.count(Licencia.id)).group_by(Licencia.status).all()
    rei_por_estado = db.query(Reincorporacion.status, func.count(Reincorporacion.id)).group_by(Reincorporacion.status).all()

    ingresos = db.query(func.sum(Pago.monto)).filter(Pago.status == "completado").scalar() or 0

    return {
        "total_licencias": total_lic,
        "total_reincorporaciones": total_rei,
        "total_usuarios": total_users,
        "ingresos_totales": float(ingresos),
        "licencias_por_estado": {str(e.value): c for e, c in lic_por_estado},
        "reincorporaciones_por_estado": {str(e.value): c for e, c in rei_por_estado},
    }


@router_reports.get("/exportar-licencias")
def exportar_licencias(db: Session = Depends(get_db), current_user: User = Depends(get_admin_sistema)):
    licencias = db.query(Licencia).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Código", "Estudiante", "Carrera", "Motivo", "Fecha inicio", "Fecha fin", "Estado", "Resolución", "Fecha creación"])
    for lic in licencias:
        est = db.query(User).filter(User.id == lic.estudiante_id).first()
        writer.writerow([
            lic.codigo,
            f"{est.nombres} {est.apellidos}" if est else "—",
            est.carrera if est else "—",
            lic.motivo.value,
            lic.fecha_inicio, lic.fecha_fin,
            lic.status.value,
            lic.numero_resolucion or "—",
            lic.created_at.strftime("%d/%m/%Y"),
        ])
    output.seek(0)
    create_notification(
        db, current_user, TipoNotificacion.CAMBIO_ESTADO,
        "Reporte exportado",
        f"Reporte de licencias exportado exitosamente — {len(licencias)} registros",
    )
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=licencias.csv"},
    )


@router_reports.get("/exportar-reincorporaciones")
def exportar_reincorporaciones(db: Session = Depends(get_db), current_user: User = Depends(get_admin_sistema)):
    reis = db.query(Reincorporacion).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Código", "Estudiante", "Tipo", "N° RD", "Ciclo retorno", "Estado", "Resolución", "Fecha creación"])
    for rei in reis:
        est = db.query(User).filter(User.id == rei.estudiante_id).first()
        writer.writerow([
            rei.codigo,
            f"{est.nombres} {est.apellidos}" if est else "—",
            rei.tipo.value,
            rei.numero_rd,
            rei.ciclo_retorno,
            rei.status.value,
            rei.numero_resolucion or "—",
            rei.created_at.strftime("%d/%m/%Y"),
        ])
    output.seek(0)
    create_notification(
        db, current_user, TipoNotificacion.CAMBIO_ESTADO,
        "Reporte exportado",
        f"Reporte de reincorporaciones exportado exitosamente — {len(reis)} registros",
    )
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=reincorporaciones.csv"},
    )


# ═══════════════════════ CHATBOT ══════════════════════════════════════════════

SYSTEM_PROMPT = """Eres un asistente virtual del Sistema de Gestión de Reincorporación y Licencia de Estudio (SGRL) de una Escuela de Educación Superior Pedagógica (EESP).

Tu rol es informar a los usuarios sobre:
- El proceso de solicitud de licencia de estudios (motivos válidos, documentos requeridos, plazos)
- El proceso de reincorporación (requisitos, Resolución Directoral, plazos)
- Los estados de los trámites: Borrador, Pendiente de pago, Pendiente revisión, En revisión, Aprobado, Rechazado, Caducado, Anulado
- Los costos: Licencia $15.000 CLP, Reincorporación $20.000 CLP
- El plazo de pago: 72 horas desde la creación del trámite
- Los roles del sistema: Estudiante, Coordinador, Admin Académico, Admin Sistema
- Preguntas frecuentes sobre el sistema

Sé claro, conciso y amable. Si no sabes algo, indica al usuario que contacte a la institución."""


@router_chatbot.post("/mensaje")
async def chatbot_mensaje(body: dict, current_user: User = Depends(get_current_active_verified_user)):
    mensaje = body.get("mensaje", "").strip()
    historial = body.get("historial", [])

    if not mensaje:
        raise HTTPException(status_code=400, detail="Mensaje vacío")
    if not settings.ANTHROPIC_API_KEY:
        return {"respuesta": "El chatbot no está configurado. Contacta al administrador."}

    messages = []
    for h in historial[-10:]:
        if h.get("role") in ["user", "assistant"]:
            messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": mensaje})

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=500,
        system=SYSTEM_PROMPT,
        messages=messages,
    )
    return {"respuesta": response.content[0].text}
