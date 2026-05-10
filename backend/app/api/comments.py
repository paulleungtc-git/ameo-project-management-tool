from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.activity import record_task_activity
from app.auth import get_current_user
from app.db.session import get_db
from app.models import TaskActivityEvent, TaskComment, User
from app.notifications import notify_task_users
from app.permissions import require_task_access
from app.schemas import ActivityRead, CommentCreate, CommentRead

router = APIRouter(prefix="/tasks/{task_id}", tags=["comments"])


@router.get("/comments", response_model=list[CommentRead])
def list_comments(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TaskComment]:
    task = require_task_access(db, current_user, task_id)
    return list(
        db.scalars(
            select(TaskComment)
            .where(TaskComment.task_id == task_id)
            .order_by(TaskComment.created_at.asc()),
        ),
    )


@router.post("/comments", response_model=CommentRead, status_code=status.HTTP_201_CREATED)
def create_comment(
    task_id: int,
    payload: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskComment:
    task = require_task_access(db, current_user, task_id)
    comment = TaskComment(task_id=task_id, author_id=current_user.id, body=payload.body)
    db.add(comment)
    db.flush()
    record_task_activity(
        db,
        task_id=task_id,
        actor=current_user,
        event_type="comment.created",
        payload={"comment_id": comment.id},
    )
    notify_task_users(
        db,
        task=task,
        actor=current_user,
        event_type="comment.created",
        title=f"New comment on {task.title}",
        body=payload.body,
        user_ids=[task.created_by_id, task.assignee_id],
    )
    db.commit()
    db.refresh(comment)
    return comment


@router.get("/activity", response_model=list[ActivityRead])
def list_activity(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TaskActivityEvent]:
    require_task_access(db, current_user, task_id)
    return list(
        db.scalars(
            select(TaskActivityEvent)
            .where(TaskActivityEvent.task_id == task_id)
            .order_by(TaskActivityEvent.created_at.asc()),
        ),
    )
