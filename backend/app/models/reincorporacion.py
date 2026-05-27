import uuid
import enum
from sqlalchemy import Column, String, Text, Date, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.licencia import TramiteStatus


class TipoReincorporacion(str, enum.Enum):
    POST_LICENCIA = "post_licencia"
    POST_RESERVA = "post_reserva"


class Reincorporacion(Base):
    __tablename__ = "reincorporaciones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo = Column(String(20), unique=True, nullable=False)  # REI-2026-0001

    # Relaciones
    estudiante_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    coordinador_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    admin_academico_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Datos del trámite
    tipo = Column(Enum(TipoReincorporacion), nullable=False)
    numero_rd = Column(String(100), nullable=False)  # Número de Resolución Directoral
    ciclo_retorno = Column(String(20), nullable=False)
    status = Column(Enum(TramiteStatus), default=TramiteStatus.BORRADOR, nullable=False)

    # Resolución
    dictamen_coordinador = Column(Text, nullable=True)
    resolucion_admin = Column(Text, nullable=True)
    numero_resolucion = Column(String(50), nullable=True)
    fecha_resolucion = Column(Date, nullable=True)

    # Estado interno sincronizado (HU15)
    habilitado_inscripcion = Column(String(20), default="no")  # no / pendiente / si
    habilitado_cobros = Column(String(20), default="no")

    # Anulación
    anulado_por_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    motivo_anulacion = Column(Text, nullable=True)

    # Relaciones
    estudiante = relationship("User", back_populates="tramites_reincorporacion", foreign_keys=[estudiante_id])
    coordinador = relationship("User", foreign_keys=[coordinador_id])
    admin_academico = relationship("User", foreign_keys=[admin_academico_id])
    documentos = relationship("Documento", back_populates="reincorporacion")
    pago = relationship("Pago", back_populates="reincorporacion", uselist=False)

    def __repr__(self):
        return f"<Reincorporacion {self.codigo} [{self.status}]>"
