from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.activity import record_task_activity
from app.auth import get_current_user
from app.db.session import get_db
from app.models import Task, TaskPriority, TaskStatus, User
from app.notifications import notify_task_users
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
    q: str | None = None,
    status_value: str | None = Query(default=None, alias="status"),
    priority: str | None = None,
    assignee_id: int | None = None,
    due_from: date | None = None,
    due_to: date | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Task]:
    require_workspace_member(db, current_user, workspace_id)
    query = select(Task).where(Task.workspace_id == workspace_id)
    if project_id is not None:
        query = query.where(Task.project_id == project_id)
    if q:
        term = f"%{q.strip()}%"
        query = query.where(or_(Task.title.ilike(term), Task.description.ilike(term)))
    if status_value is not None:
        query = query.where(Task.status == validate_status(status_value))
    if priority is not None:
        query = query.where(Task.priority == validate_priority(priority))
    if assignee_id is not None:
        query = query.where(Task.assignee_id == assignee_id)
    if due_from is not None:
        query = query.where(Task.due_date >= due_from)
    if due_to is not None:
        query = query.where(Task.due_date <= due_to)
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
    db.flush()
    record_task_activity(
        db,
        task_id=task.id,
        actor=current_user,
        event_type="task.created",
        payload={"title": task.title, "status": task.status},
    )
    notify_task_users(
        db,
        task=task,
        actor=current_user,
        event_type="task.assigned",
        title=f"Assigned: {task.title}",
        body=f"{current_user.name} assigned you a task.",
        user_ids=[task.assignee_id],
    )
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
    before = {key: getattr(task, key) for key in data}
    if "status" in data and data["status"] is not None:
        data["status"] = validate_status(data["status"])
    if "priority" in data and data["priority"] is not None:
        data["priority"] = validate_priority(data["priority"])
    for key, value in data.items():
        setattr(task, key, value)
    changes = {
        key: {"from": before[key], "to": value}
        for key, value in data.items()
        if before[key] != value
    }
    if changes:
        record_task_activity(
            db,
            task_id=task.id,
            actor=current_user,
            event_type="task.updated",
            payload={"changes": changes},
        )
        if "assignee_id" in changes:
            notify_task_users(
                db,
                task=task,
                actor=current_user,
                event_type="task.assigned",
                title=f"Assigned: {task.title}",
                body=f"{current_user.name} assigned you a task.",
                user_ids=[task.assignee_id],
            )
        elif "status" in changes:
            notify_task_users(
                db,
                task=task,
                actor=current_user,
                event_type="task.updated",
                title=f"Task updated: {task.title}",
                body=f"{current_user.name} moved the task to {task.status}.",
                user_ids=[task.created_by_id, task.assignee_id],
            )
    db.commit()
    db.refresh(task)
    return task
