from fastapi import APIRouter, Depends, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db.session import get_db
from app.models import Project, User
from app.permissions import require_workspace_member
from app.schemas import ProjectCreate, ProjectRead

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectRead])
def list_projects(
    workspace_id: int,
    q: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Project]:
    require_workspace_member(db, current_user, workspace_id)
    query = select(Project).where(Project.workspace_id == workspace_id)
    if q:
        term = f"%{q.strip()}%"
        query = query.where(or_(Project.name.ilike(term), Project.description.ilike(term)))
    return list(
        db.scalars(
            query.order_by(Project.created_at.desc()),
        ),
    )


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Project:
    require_workspace_member(db, current_user, payload.workspace_id)
    project = Project(
        workspace_id=payload.workspace_id,
        name=payload.name,
        description=payload.description,
        created_by_id=current_user.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project
