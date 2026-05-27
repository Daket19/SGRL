import uuid
import enum
from sqlalchemy import Column, String, Text, Date, Enum, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


class TramiteStatus(str, enum.Enum):
    BORRADOR = "borrador"
    PENDIENTE_PAGO = "pendiente_pago"
    PENDIENTE_REVISION = "pendiente_revision"
    EN_REVISION = "en_revision"
    RECHAZADO_COORDINADOR = "rechazado_coordinador"
    APROBADO = "aprobado"
    RECHAZADO = "rechazado"
    CADUCADO = "caducado"
    ANULADO = "anulado"


class MotivoLicencia(str, enum.Enum):
    SALUD = "salud"
    PERSONAL = "personal"
    LABORAL = "laboral"
    FAMILIAR = "familiar"
    OTRO = "otro"


class Licencia(Base):
    __tablename__ = "licencias"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo = Column(String(20), unique=True, nullable=False)  # LIC-2026-0001

    # Relaciones con usuarios
    estudiante_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    coordinador_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    admin_academico_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Datos del trámite
    motivo = Column(Enum(MotivoLicencia), nullable=False)
    descripcion = Column(Text, nullable=False)
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    status = Column(Enum(TramiteStatus), default=TramiteStatus.BORRADOR, nullable=False)

    # Resolución
    dictamen_coordinador = Column(Text, nullable=True)
    resolucion_admin = Column(Text, nullable=True)
    numero_resolucion = Column(String(50), nullable=True)
    fecha_resolucion = Column(Date, nullable=True)

    # Anulación
    anulado_por_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    motivo_anulacion = Column(Text, nullable=True)

    # Relaciones
    estudiante = relationship("User", back_populates="tramites_licencia", foreign_keys=[estudiante_id])
    coordinador = relationship("User", foreign_keys=[coordinador_id])
    admin_academico = relationship("User", foreign_keys=[admin_academico_id])
    documentos = relationship("Documento", back_populates="licencia")
    pago = relationship("Pago", back_populates="licencia", uselist=False)

    def __repr__(self):
        return f"<Licencia {self.codigo} [{self.status}]>"
