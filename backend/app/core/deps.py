from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserRole, UserStatus

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido o expirado")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario no encontrado")
    if user.status == UserStatus.INACTIVO:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cuenta deshabilitada")

    return user


def get_current_active_verified_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.email_verificado:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Correo no verificado")
    return current_user


def require_role(*roles: UserRole):
    def _checker(current_user: User = Depends(get_current_active_verified_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso denegado. Se requiere uno de los roles: {[r.value for r in roles]}",
            )
        return current_user
    return _checker


def get_estudiante(current_user: User = Depends(get_current_active_verified_user)) -> User:
    if current_user.role != UserRole.ESTUDIANTE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo estudiantes")
    return current_user


def get_coordinador(current_user: User = Depends(get_current_active_verified_user)) -> User:
    if current_user.role != UserRole.COORDINADOR:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo coordinadores")
    return current_user


def get_admin_academico(current_user: User = Depends(get_current_active_verified_user)) -> User:
    if current_user.role != UserRole.ADMIN_ACADEMICO:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores académicos")
    return current_user


def get_admin_sistema(current_user: User = Depends(get_current_active_verified_user)) -> User:
    if current_user.role != UserRole.ADMIN_SISTEMA:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo administradores del sistema")
    return current_user


def get_staff(current_user: User = Depends(get_current_active_verified_user)) -> User:
    if current_user.role not in [UserRole.COORDINADOR, UserRole.ADMIN_ACADEMICO, UserRole.ADMIN_SISTEMA]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso no autorizado")
    return current_user
