from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.user import UserRole, UserStatus
import re


class UserBase(BaseModel):
    email: EmailStr
    nombres: str
    apellidos: str
    telefono: Optional[str] = None


class StudentRegister(UserBase):
    password: str
    confirm_password: str
    codigo_estudiante: str
    carrera: str
    ciclo_actual: str
    anno_matricula: str
    rut: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        if not re.search(r"[A-Z]", v):
            raise ValueError("La contraseña debe contener al menos una mayúscula")
        if not re.search(r"\d", v):
            raise ValueError("La contraseña debe contener al menos un número")
        return v

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v, info):
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Las contraseñas no coinciden")
        return v


class StaffCreate(UserBase):
    role: UserRole
    password: str
    rut: Optional[str] = None
    carrera_asignada: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v


class UserResponse(BaseModel):
    id: UUID
    email: str
    nombres: str
    apellidos: str
    role: UserRole
    status: UserStatus
    telefono: Optional[str]
    codigo_estudiante: Optional[str]
    carrera: Optional[str]
    ciclo_actual: Optional[str]
    anno_matricula: Optional[str]
    carrera_asignada: Optional[str]
    email_verificado: bool
    totp_habilitado: bool
    debe_cambiar_password: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    telefono: Optional[str] = None
    carrera: Optional[str] = None
    ciclo_actual: Optional[str] = None


class UserAdminUpdate(BaseModel):
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    telefono: Optional[str] = None
    status: Optional[UserStatus] = None
    carrera_asignada: Optional[str] = None


class ChangePassword(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        return v

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v, info):
        if "new_password" in info.data and v != info.data["new_password"]:
            raise ValueError("Las contraseñas no coinciden")
        return v
