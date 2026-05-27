from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Base
    PROJECT_NAME: str = "Sistema de Gestión de Reincorporación y Licencia de Estudio"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = True

    # Base de datos
    DATABASE_URL: str = "postgresql://postgres.cbbqrvphpxjpvmddghfa:SGRLJPSB0219_@aws-1-us-east-1.pooler.supabase.com:5432/postgres"

    # JWT
    SECRET_KEY: str = "supersecretkey_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Anthropic
    ANTHROPIC_API_KEY: str = ""

    # Archivos
    UPLOAD_DIR: str = "/app/uploads"
    MAX_FILE_SIZE_MB: int = 10
    ALLOWED_MIME_TYPES: list[str] = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
    ]

    # Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_NAME: str = "SGRL Sistema"

    # Negocio
    MONTO_LICENCIA: float = 15000.0   # CLP
    MONTO_REINCORPORACION: float = 20000.0
    HORAS_CADUCIDAD_PAGO: int = 72
    MAX_CICLOS_LICENCIA: int = 4

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
