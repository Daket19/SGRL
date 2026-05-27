from datetime import datetime, timedelta, timezone
from typing import Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def create_verification_token(email: str) -> str:
    data = {"sub": email, "type": "email_verification"}
    expire = datetime.now(timezone.utc) + timedelta(hours=24)
    data.update({"exp": expire})
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_reset_token(email: str) -> str:
    data = {"sub": email, "type": "password_reset"}
    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    data.update({"exp": expire})
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
