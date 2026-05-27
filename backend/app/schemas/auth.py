from pydantic import BaseModel, EmailStr
from typing import Optional
from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    requires_2fa: bool = False
    user: UserResponse


class TOTPVerify(BaseModel):
    email: EmailStr
    totp_code: str
    temp_token: str


class TOTPSetupResponse(BaseModel):
    secret: str
    qr_url: str


class TOTPConfirm(BaseModel):
    totp_code: str


class EmailVerify(BaseModel):
    token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordReset(BaseModel):
    token: str
    new_password: str
    confirm_password: str
