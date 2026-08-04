"""JWT creation/verification + password hashing."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from backend.config import settings
from backend.database import get_db
from backend.models import User

# ── Password hashing ──────────────────────────────────────────


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ── JWT ───────────────────────────────────────────────────────
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24

_security = HTTPBearer(auto_error=False)


def create_token(user_id: int, username: str) -> str:
    payload = {
        "sub": str(user_id),
        "username": username,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


# ── FastAPI dependency: inject current user ───────────────────

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_security),
) -> User | None:
    """Returns User if valid JWT present, else None. Does NOT raise 401.

    Use `require_user()` below for endpoints that must have auth.
    """
    if credentials is None:
        return None

    payload = decode_token(credentials.credentials)
    if payload is None:
        return None

    db: Session = next(get_db())
    try:
        user = db.query(User).filter(User.id == int(payload["sub"])).first()
        return user
    finally:
        db.close()


async def require_user(
    current_user: User | None = Depends(get_current_user),
) -> User:
    """Raise 401 if no valid token. Use this on protected endpoints."""
    if current_user is None:
        raise HTTPException(status_code=401, detail="请先登录")
    return current_user
