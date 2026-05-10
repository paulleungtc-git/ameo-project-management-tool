from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.models import Notification, Task, User


def create_notification(
    db: Session,
    *,
    workspace_id: int,
    user_id: int,
    actor: User,
    event_type: str,
    title: str,
    body: str,
    task_id: int | None = None,
) -> Notification | None:
    if user_id == actor.id:
        return None
    notification = Notification(
        workspace_id=workspace_id,
        user_id=user_id,
        task_id=task_id,
        event_type=event_type,
        title=title,
        body=body,
    )
    db.add(notification)
    return notification


def notify_task_users(
    db: Session,
    *,
    task: Task,
    actor: User,
    event_type: str,
    title: str,
    body: str,
    user_ids: Iterable[int | None],
) -> None:
    for user_id in {value for value in user_ids if value is not None}:
        create_notification(
            db,
            workspace_id=task.workspace_id,
            user_id=user_id,
            actor=actor,
            event_type=event_type,
            title=title,
            body=body,
            task_id=task.id,
        )
