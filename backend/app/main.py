from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import api_router
from app.db.base import Base
from app.db.session import engine
import app.models  # noqa: F401 - importa todos los modelos para que Alembic los detecte

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    _seed_admin()


def _seed_admin():
    from app.db.session import SessionLocal
    from app.models.user import User, UserRole, UserStatus
    from app.core.security import get_password_hash

    db = SessionLocal()
    try:
        if not db.query(User).filter(User.role == UserRole.ADMIN_SISTEMA).first():
            admin = User(
                email="admin@sgrl.cl",
                hashed_password=get_password_hash("Admin1234"),
                role=UserRole.ADMIN_SISTEMA,
                status=UserStatus.ACTIVO,
                nombres="Administrador",
                apellidos="Sistema",
                email_verificado=True,
                debe_cambiar_password=True,
            )
            db.add(admin)
            db.commit()
            print("✅ Admin creado: admin@sgrl.cl / Admin1234")
    except Exception as e:
        print(f"❌ Error al crear admin: {e}")
        db.rollback()
    finally:
        db.close()


app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.PROJECT_NAME}
