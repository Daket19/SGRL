from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime
from app.models.licencia import TramiteStatus
from app.models.reincorporacion import TipoReincorporacion
from app.models.pago import PagoStatus
from app.schemas.user import UserResponse
from app.schemas.licencia import DocumentoResponse, PagoResumen


# ── Reincorporación ──────────────────────────────────────────────────────────

class ReincorporacionCreate(BaseModel):
    tipo: TipoReincorporacion
    numero_rd: str
    ciclo_retorno: str


class ReincorporacionUpdate(BaseModel):
    numero_rd: Optional[str] = None
    ciclo_retorno: Optional[str] = None


class DictamenReincorporacion(BaseModel):
    dictamen: str
    aprobado: bool


class ResolucionReincorporacion(BaseModel):
    resolucion: str
    aprobado: bool
    numero_resolucion: str


class ReincorporacionResponse(BaseModel):
    id: UUID
    codigo: str
    tipo: TipoReincorporacion
    numero_rd: str
    ciclo_retorno: str
    status: TramiteStatus
    dictamen_coordinador: Optional[str]
    resolucion_admin: Optional[str]
    numero_resolucion: Optional[str]
    fecha_resolucion: Optional[date]
    habilitado_inscripcion: str
    habilitado_cobros: str
    motivo_anulacion: Optional[str]
    estudiante: UserResponse
    documentos: List[DocumentoResponse] = []
    pago: Optional[PagoResumen] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReincorporacionListResponse(BaseModel):
    id: UUID
    codigo: str
    tipo: TipoReincorporacion
    status: TramiteStatus
    ciclo_retorno: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Pago ─────────────────────────────────────────────────────────────────────

class PagoCreate(BaseModel):
    numero_tarjeta: str        # Solo para simulación, no se guarda
    nombre_titular: str
    mes_vencimiento: str
    anno_vencimiento: str
    cvv: str                   # Solo para simulación, no se guarda
    tipo_tarjeta: str          # visa / mastercard / amex


class PagoResponse(BaseModel):
    id: UUID
    codigo_transaccion: str
    tipo_tramite: str
    monto: float
    moneda: str
    status: PagoStatus
    ultimos_digitos: Optional[str]
    tipo_tarjeta: Optional[str]
    numero_comprobante: Optional[str]
    fecha_pago: Optional[datetime]
    fecha_caducidad: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Notificaciones ────────────────────────────────────────────────────────────

class NotificacionResponse(BaseModel):
    id: UUID
    tipo: str
    titulo: str
    mensaje: str
    leida: bool
    tramite_tipo: Optional[str]
    tramite_id: Optional[UUID]
    created_at: datetime

    model_config = {"from_attributes": True}
