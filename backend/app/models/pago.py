import uuid
import enum
from sqlalchemy import Column, String, Numeric, DateTime, Enum, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


class PagoStatus(str, enum.Enum):
    PENDIENTE = "pendiente"
    COMPLETADO = "completado"
    FALLIDO = "fallido"
    CADUCADO = "caducado"


class TipoPago(str, enum.Enum):
    LICENCIA = "licencia"
    REINCORPORACION = "reincorporacion"


class Pago(Base):
    __tablename__ = "pagos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo_transaccion = Column(String(50), unique=True, nullable=False)

    # Referencia al trámite
    tipo_tramite = Column(Enum(TipoPago), nullable=False)
    licencia_id = Column(UUID(as_uuid=True), ForeignKey("licencias.id"), nullable=True)
    reincorporacion_id = Column(UUID(as_uuid=True), ForeignKey("reincorporaciones.id"), nullable=True)
    estudiante_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Datos del pago (simulado - no guardamos datos reales de tarjeta)
    monto = Column(Numeric(10, 2), nullable=False)
    moneda = Column(String(3), default="CLP")
    status = Column(Enum(PagoStatus), default=PagoStatus.PENDIENTE, nullable=False)

    # Últimos 4 dígitos de la tarjeta (simulado)
    ultimos_digitos = Column(String(4), nullable=True)
    tipo_tarjeta = Column(String(20), nullable=True)  # visa, mastercard, etc.

    # Comprobante
    numero_comprobante = Column(String(50), nullable=True)
    fecha_pago = Column(DateTime(timezone=True), nullable=True)
    fecha_caducidad = Column(DateTime(timezone=True), nullable=True)  # 72h desde creación

    # Respuesta simulada
    respuesta_gateway = Column(Text, nullable=True)

    # Relaciones
    licencia = relationship("Licencia", back_populates="pago")
    reincorporacion = relationship("Reincorporacion", back_populates="pago")
    estudiante = relationship("User")

    def __repr__(self):
        return f"<Pago {self.codigo_transaccion} [{self.status}]>"
