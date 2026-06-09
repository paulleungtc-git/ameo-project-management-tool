from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user, hash_password, verify_password
from app.db.session import get_db
from app.models import User
from app.schemas import UserPasswordUpdate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.patch("/me", response_model=UserRead)
def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        name = data["name"].strip()
        if not name:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Name is required")
        current_user.name = name

    if "email" in data and data["email"] is not None:
        email = data["email"].strip().lower()
        if not email:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Email is required")
        if email != current_user.email:
            existing = db.scalar(select(User).where(User.email == email))
            if existing is not None:
                raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
            current_user.email = email

    db.commit()
    db.refresh(current_user)
    return current_user


@router.patch("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def update_my_password(
    payload: UserPasswordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Current password is incorrect")
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
