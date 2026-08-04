"""Auth routes — register, login, current user."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.auth import create_token, hash_password, require_user, verify_password
from backend.database import get_db
from backend.models import User
from backend.schemas import (
    TokenData,
    TokenResponse,
    UserLoginRequest,
    UserMeData,
    UserMeResponse,
    UserRegisterRequest,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register(body: UserRegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    existing = db.query(User).filter(User.username == body.username).first()
    if existing:
        raise HTTPException(status_code=409, detail="用户名已被注册")

    user = User(username=body.username, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_token(user.id, user.username)
    return TokenResponse(data=TokenData(access_token=token, username=user.username))


@router.post("/login", response_model=TokenResponse)
def login(body: UserLoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = create_token(user.id, user.username)
    return TokenResponse(data=TokenData(access_token=token, username=user.username))


@router.get("/me", response_model=UserMeResponse)
def me(current_user: User = Depends(require_user)) -> UserMeResponse:
    return UserMeResponse(
        data=UserMeData(
            id=current_user.id,
            username=current_user.username,
            created_at=current_user.created_at.isoformat(),
        )
    )
