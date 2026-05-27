import uuid
import enum
from sqlalchemy import Column, String, Enum, ForeignKey, BigInteger
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


class TipoDocumento(str, enum.Enum):
    CERTIFICADO_MEDICO = "certificado_medico"
    RESOLUCION_DIRECTORAL = "resolucion_directoral"
    DOCUMENTO_IDENTIDAD = "documento_identidad"
    CONSTANCIA = "constancia"
    OTRO = "otro"


class Documento(Base):
    __tablename__ = "documentos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Referencia al trámite
    licencia_id = Column(UUID(as_uuid=True), ForeignKey("licencias.id"), nullable=True)
    reincorporacion_id = Column(UUID(as_uuid=True), ForeignKey("reincorporaciones.id"), nullable=True)
    subido_por_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Datos del archivo
    nombre_original = Column(String(255), nullable=False)
    nombre_guardado = Column(String(255), nullable=False)  # UUID en disco
    ruta = Column(String(500), nullable=False)
    tipo_documento = Column(Enum(TipoDocumento), nullable=False)
    mime_type = Column(String(100), nullable=False)
    tamano_bytes = Column(BigInteger, nullable=False)

    # Relaciones
    licencia = relationship("Licencia", back_populates="documentos")
    reincorporacion = relationship("Reincorporacion", back_populates="documentos")
    subido_por = relationship("User")

    def __repr__(self):
        return f"<Documento {self.nombre_original}>"
