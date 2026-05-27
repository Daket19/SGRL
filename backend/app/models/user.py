import uuid
import enum
from sqlalchemy import Column, String, Boolean, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


class UserRole(str, enum.Enum):
    ESTUDIANTE = "estudiante"
    COORDINADOR = "coordinador"
    ADMIN_ACADEMICO = "admin_academico"
    ADMIN_SISTEMA = "admin_sistema"


class UserStatus(str, enum.Enum):
    ACTIVO = "activo"
    INACTIVO = "inactivo"
    PENDIENTE_VERIFICACION = "pendiente_verificacion"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    status = Column(Enum(UserStatus), default=UserStatus.PENDIENTE_VERIFICACION, nullable=False)

    # Datos personales
    nombres = Column(String(150), nullable=False)
    apellidos = Column(String(150), nullable=False)
    rut = Column(String(20), unique=True, nullable=True)
    telefono = Column(String(20), nullable=True)

    # Solo para estudiantes
    codigo_estudiante = Column(String(50), unique=True, nullable=True)
    carrera = Column(String(200), nullable=True)
    ciclo_actual = Column(String(20), nullable=True)
    anno_matricula = Column(String(4), nullable=True)

    # Solo para coordinadores (filtra los trámites que pueden ver)
    carrera_asignada = Column(String(200), nullable=True)

    # Seguridad
    email_verificado = Column(Boolean, default=False)
    email_verification_token = Column(String(255), nullable=True)
    totp_secret = Column(String(255), nullable=True)
    totp_habilitado = Column(Boolean, default=False)
    debe_cambiar_password = Column(Boolean, default=False)
    reset_password_token = Column(String(255), nullable=True)

    # Relaciones
    tramites_licencia = relationship("Licencia", back_populates="estudiante", foreign_keys="Licencia.estudiante_id")
    tramites_reincorporacion = relationship("Reincorporacion", back_populates="estudiante", foreign_keys="Reincorporacion.estudiante_id")
    notificaciones = relationship("Notificacion", back_populates="usuario")

    def __repr__(self):
        return f"<User {self.email} [{self.role}]>"
