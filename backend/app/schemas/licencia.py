from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime
from app.models.licencia import TramiteStatus, MotivoLicencia
from app.schemas.user import UserResponse


class LicenciaCreate(BaseModel):
    motivo: MotivoLicencia
    descripcion: str
    fecha_inicio: date
    fecha_fin: date


class LicenciaUpdate(BaseModel):
    motivo: Optional[MotivoLicencia] = None
    descripcion: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None


class DictamenCoordinador(BaseModel):
    dictamen: str
    aprobado: bool


class ResolucionAdmin(BaseModel):
    resolucion: str
    aprobado: bool
    numero_resolucion: str


class AnularTramite(BaseModel):
    motivo: str


class DocumentoResponse(BaseModel):
    id: UUID
    nombre_original: str
    tipo_documento: str
    tamano_bytes: int
    created_at: datetime

    model_config = {"from_attributes": True}


class PagoResumen(BaseModel):
    id: UUID
    status: str
    monto: float
    codigo_transaccion: str
    numero_comprobante: Optional[str]
    fecha_pago: Optional[datetime]

    model_config = {"from_attributes": True}


class LicenciaResponse(BaseModel):
    id: UUID
    codigo: str
    motivo: MotivoLicencia
    descripcion: str
    fecha_inicio: date
    fecha_fin: date
    status: TramiteStatus
    dictamen_coordinador: Optional[str]
    resolucion_admin: Optional[str]
    numero_resolucion: Optional[str]
    fecha_resolucion: Optional[date]
    motivo_anulacion: Optional[str]
    estudiante: UserResponse
    documentos: List[DocumentoResponse] = []
    pago: Optional[PagoResumen] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LicenciaListResponse(BaseModel):
    id: UUID
    codigo: str
    motivo: MotivoLicencia
    status: TramiteStatus
    fecha_inicio: date
    fecha_fin: date
    created_at: datetime

    model_config = {"from_attributes": True}
