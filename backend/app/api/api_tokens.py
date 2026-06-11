from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.auth import AuthContext, generate_api_token, get_auth_context, hash_api_token
from app.db.session import get_db
from app.models import ApiToken, utcnow
from app.schemas import ApiTokenCreate, ApiTokenCreated, ApiTokenRead
from sqlalchemy.orm import Session

router = APIRouter(prefix="/users/me/tokens", tags=["api-tokens"])


def require_session_auth(context: AuthContext = Depends(get_auth_context)) -> AuthContext:
    # A leaked API token must not be able to mint or revoke tokens.
    if context.via_api_token:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Token management requires password session authentication",
        )
    return context


@router.post("", response_model=ApiTokenCreated, status_code=status.HTTP_201_CREATED)
def create_api_token(
    payload: ApiTokenCreate,
    context: AuthContext = Depends(require_session_auth),
    db: Session = Depends(get_db),
) -> ApiTokenCreated:
    token = generate_api_token()
    expires_at = None
    if payload.expires_in_days is not None:
        expires_at = utcnow() + timedelta(days=payload.expires_in_days)
    api_token = ApiToken(
        user_id=context.user.id,
        name=payload.name.strip(),
        token_hash=hash_api_token(token),
        token_prefix=token[:14],
        expires_at=expires_at,
    )
    db.add(api_token)
    db.commit()
    db.refresh(api_token)
    return ApiTokenCreated(
        id=api_token.id,
        name=api_token.name,
        token_prefix=api_token.token_prefix,
        expires_at=api_token.expires_at,
        last_used_at=api_token.last_used_at,
        created_at=api_token.created_at,
        token=token,
    )


@router.get("", response_model=list[ApiTokenRead])
def list_api_tokens(
    context: AuthContext = Depends(require_session_auth),
    db: Session = Depends(get_db),
) -> list[ApiToken]:
    query = (
        select(ApiToken)
        .where(ApiToken.user_id == context.user.id)
        .order_by(ApiToken.created_at.desc())
    )
    return list(db.scalars(query))


@router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_api_token(
    token_id: int,
    context: AuthContext = Depends(require_session_auth),
    db: Session = Depends(get_db),
) -> None:
    api_token = db.scalar(
        select(ApiToken).where(ApiToken.id == token_id, ApiToken.user_id == context.user.id),
    )
    if api_token is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Token not found")
    db.delete(api_token)
    db.commit()
