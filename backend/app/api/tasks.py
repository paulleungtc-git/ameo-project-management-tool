from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db.session import get_db
from app.models import Task, TaskPriority, TaskStatus, User
from app.permissions import require_project_access, require_task_access, require_workspace_member
from app.schemas import TaskCreate, TaskRead, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["tasks"])


def validate_status(value: str) -> str:
    allowed = {status.value for status in TaskStatus}
    if value not in allowed:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Invalid task status")
    return value


def validate_priority(value: str) -> str:
    allowed = {priority.value for priority in TaskPriority}
    if value not in allowed:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Invalid task priority")
    return value


@router.get("", response_model=list[TaskRead])
def list_tasks(
    workspace_id: int,
    project_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Task]:
    require_workspace_member(db, current_user, workspace_id)
    query = select(Task).where(Task.workspace_id == workspace_id)
    if project_id is not None:
        query = query.where(Task.project_id == project_id)
    return list(db.scalars(query.order_by(Task.created_at.desc())))


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Task:
    project = require_project_access(db, current_user, payload.project_id)
    task = Task(
        workspace_id=project.workspace_id,
        project_id=project.id,
        title=payload.title,
        description=payload.description,
        status=validate_status(payload.status),
        priority=validate_priority(payload.priority),
        assignee_id=payload.assignee_id,
        created_by_id=current_user.id,
        due_date=payload.due_date,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Task:
    task = require_task_access(db, current_user, task_id)
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and data["status"] is not None:
        data["status"] = validate_status(data["status"])
    if "priority" in data and data["priority"] is not None:
        data["priority"] = validate_priority(data["priority"])
    for key, value in data.items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)
    return task
