from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db.session import get_db
from app.models import User, Workspace, WorkspaceMember, WorkspaceRole
from app.permissions import require_workspace_admin, require_workspace_member
from app.schemas import WorkspaceMemberAdd, WorkspaceMemberRead, WorkspaceMemberUpdate, WorkspaceRead

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def validate_workspace_role(value: str) -> str:
    normalized = value.lower()
    allowed = {role.value for role in WorkspaceRole}
    if normalized not in allowed:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Invalid workspace role")
    return normalized


def member_read(member: WorkspaceMember, user: User) -> WorkspaceMemberRead:
    return WorkspaceMemberRead(
        id=member.id,
        workspace_id=member.workspace_id,
        user_id=member.user_id,
        email=user.email,
        name=user.name,
        role=member.role,
        created_at=member.created_at,
    )


@router.get("", response_model=list[WorkspaceRead])
def list_workspaces(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkspaceRead]:
    rows = db.execute(
        select(Workspace, WorkspaceMember.role)
        .join(WorkspaceMember, WorkspaceMember.workspace_id == Workspace.id)
        .where(WorkspaceMember.user_id == current_user.id)
        .order_by(Workspace.name),
    ).all()
    return [
        WorkspaceRead(id=workspace.id, name=workspace.name, role=role)
        for workspace, role in rows
    ]


@router.get("/{workspace_id}/members", response_model=list[WorkspaceMemberRead])
def list_workspace_members(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkspaceMemberRead]:
    require_workspace_member(db, current_user, workspace_id)
    rows = db.execute(
        select(WorkspaceMember, User)
        .join(User, User.id == WorkspaceMember.user_id)
        .where(WorkspaceMember.workspace_id == workspace_id)
        .order_by(WorkspaceMember.role.desc(), User.name),
    ).all()
    return [member_read(member, user) for member, user in rows]


@router.post("/{workspace_id}/members", response_model=WorkspaceMemberRead, status_code=status.HTTP_201_CREATED)
def add_workspace_member(
    workspace_id: int,
    payload: WorkspaceMemberAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkspaceMemberRead:
    require_workspace_admin(db, current_user, workspace_id)
    role = validate_workspace_role(payload.role)
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    existing = db.scalar(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user.id,
        ),
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "User is already a workspace member")
    member = WorkspaceMember(workspace_id=workspace_id, user_id=user.id, role=role)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member_read(member, user)


@router.patch("/{workspace_id}/members/{member_id}", response_model=WorkspaceMemberRead)
def update_workspace_member(
    workspace_id: int,
    member_id: int,
    payload: WorkspaceMemberUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkspaceMemberRead:
    require_workspace_admin(db, current_user, workspace_id)
    role = validate_workspace_role(payload.role)
    member = db.get(WorkspaceMember, member_id)
    if member is None or member.workspace_id != workspace_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workspace member not found")
    member.role = role
    db.commit()
    db.refresh(member)
    user = db.get(User, member.user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return member_read(member, user)


@router.delete("/{workspace_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_workspace_member(
    workspace_id: int,
    member_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    require_workspace_admin(db, current_user, workspace_id)
    member = db.get(WorkspaceMember, member_id)
    if member is None or member.workspace_id != workspace_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Workspace member not found")
    db.delete(member)
    db.commit()
