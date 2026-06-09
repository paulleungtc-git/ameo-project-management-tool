from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db.session import get_db
from app.models import User
from app.permissions import require_site_admin
from app.schemas import SiteAdminUserUpdate, UserRead

router = APIRouter(prefix="/site-admin", tags=["site-admin"])


@router.post("/bootstrap", response_model=UserRead)
def bootstrap_site_admin(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if current_user.is_site_admin:
        return current_user

    existing_site_admin = db.scalar(select(User).where(User.is_site_admin.is_(True)))
    if existing_site_admin is not None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Site admin already exists")

    current_user.is_site_admin = True
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/users", response_model=list[UserRead])
def list_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[User]:
    require_site_admin(current_user)
    return list(db.scalars(select(User).order_by(User.created_at.desc())))


@router.patch("/users/{user_id}", response_model=UserRead)
def update_user_site_access(
    user_id: int,
    payload: SiteAdminUserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    require_site_admin(current_user)
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    data = payload.model_dump(exclude_unset=True)
    if "is_active" in data and data["is_active"] is not None:
        user.is_active = data["is_active"]
    if "is_site_admin" in data and data["is_site_admin"] is not None:
        user.is_site_admin = data["is_site_admin"]

    db.commit()
    db.refresh(user)
    return user
