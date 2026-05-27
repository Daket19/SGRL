from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import get_current_active_verified_user
from app.schemas.auth import LoginRequest, LoginResponse, TOTPVerify, TOTPConfirm, EmailVerify, PasswordResetRequest, PasswordReset
from app.schemas.user import StudentRegister, StaffCreate, UserResponse, ChangePassword, UserUpdate
from app.services import auth_service
from app.models.user import User
from app.core.security import get_password_hash, verify_password

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: StudentRegister, db: Session = Depends(get_db)):
    return auth_service.register_student(db, data)


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    return auth_service.login(db, data)


@router.post("/verify-2fa")
def verify_2fa(data: TOTPVerify, db: Session = Depends(get_db)):
    return auth_service.verify_totp_and_login(db, data.email, data.totp_code, data.temp_token)


@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    auth_service.verify_email(db, token)
    return {"message": "Correo verificado exitosamente"}


@router.post("/forgot-password")
def forgot_password(data: PasswordResetRequest, db: Session = Depends(get_db)):
    auth_service.request_password_reset(db, data.email)
    return {"message": "Si el correo existe, recibirás un enlace de recuperación"}


@router.post("/reset-password")
def reset_password(data: PasswordReset, db: Session = Depends(get_db)):
    auth_service.reset_password(db, data.token, data.new_password)
    return {"message": "Contraseña restablecida exitosamente"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_active_verified_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_me(data: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_verified_user)):
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/change-password")
def change_password(data: ChangePassword, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_verified_user)):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
    current_user.hashed_password = get_password_hash(data.new_password)
    current_user.debe_cambiar_password = False
    db.commit()
    return {"message": "Contraseña actualizada"}


@router.post("/totp/setup")
def setup_totp(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_verified_user)):
    return auth_service.setup_totp(current_user, db)


@router.post("/totp/confirm")
def confirm_totp(data: TOTPConfirm, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_verified_user)):
    auth_service.confirm_totp(current_user, db, data.totp_code)
    return {"message": "Autenticación de dos factores habilitada"}
