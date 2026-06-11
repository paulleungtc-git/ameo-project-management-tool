from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import os
import secrets

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models import ApiToken, User, utcnow

security = HTTPBearer(auto_error=False)

API_TOKEN_PREFIX = "ameo_pat_"


@dataclass(frozen=True)
class AuthContext:
    user: User
    via_api_token: bool


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 210_000)
    return f"pbkdf2_sha256$210000${salt.hex()}${digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, rounds, salt_hex, digest_hex = password_hash.split("$", 3)
    except ValueError:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        bytes.fromhex(salt_hex),
        int(rounds),
    )
    return hmac.compare_digest(digest.hex(), digest_hex)


def create_access_token(user: User) -> str:
    settings = get_settings()
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.auth_access_token_minutes,
    )
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "exp": expires_at,
    }
    return jwt.encode(payload, settings.auth_jwt_secret, algorithm="HS256")


def generate_api_token() -> str:
    return API_TOKEN_PREFIX + secrets.token_urlsafe(32)


def hash_api_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _as_utc(value: datetime) -> datetime:
    # SQLite returns naive datetimes even for timezone-aware columns.
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _authenticate_api_token(token: str, db: Session) -> User:
    api_token = db.scalar(select(ApiToken).where(ApiToken.token_hash == hash_api_token(token)))
    if api_token is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid API token")
    if api_token.expires_at is not None and _as_utc(api_token.expires_at) <= utcnow():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "API token expired")

    user = db.scalar(
        select(User).where(User.id == api_token.user_id, User.is_active.is_(True)),
    )
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")

    api_token.last_used_at = utcnow()
    db.commit()
    return user


def _authenticate_jwt(token: str, db: Session) -> User:
    try:
        payload = jwt.decode(
            token,
            get_settings().auth_jwt_secret,
            algorithms=["HS256"],
        )
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid bearer token") from exc

    user = db.scalar(select(User).where(User.id == user_id, User.is_active.is_(True)))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


def get_auth_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> AuthContext:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = credentials.credentials
    if token.startswith(API_TOKEN_PREFIX):
        return AuthContext(user=_authenticate_api_token(token, db), via_api_token=True)
    return AuthContext(user=_authenticate_jwt(token, db), via_api_token=False)


def get_current_user(context: AuthContext = Depends(get_auth_context)) -> User:
    return context.user
