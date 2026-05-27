import uuid
import enum
from sqlalchemy import Column, String, Text, Boolean, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


class TipoNotificacion(str, enum.Enum):
    TRAMITE_RECIBIDO = "tramite_recibido"
    DOCUMENTO_RECIBIDO = "documento_recibido"
    CAMBIO_ESTADO = "cambio_estado"
    PAGO_CONFIRMADO = "pago_confirmado"
    PAGO_CADUCADO = "pago_caducado"
    TRAMITE_APROBADO = "tramite_aprobado"
    TRAMITE_RECHAZADO = "tramite_rechazado"
    TRAMITE_ANULADO = "tramite_anulado"
    REINCORPORACION_SINCRONIZADA = "reincorporacion_sincronizada"


class Notificacion(Base):
    __tablename__ = "notificaciones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    tipo = Column(Enum(TipoNotificacion), nullable=False)
    titulo = Column(String(255), nullable=False)
    mensaje = Column(Text, nullable=False)
    leida = Column(Boolean, default=False)

    # Referencia opcional al trámite
    tramite_tipo = Column(String(50), nullable=True)  # licencia / reincorporacion
    tramite_id = Column(UUID(as_uuid=True), nullable=True)

    # Relaciones
    usuario = relationship("User", back_populates="notificaciones")

    def __repr__(self):
        return f"<Notificacion {self.tipo} -> {self.usuario_id}>"
