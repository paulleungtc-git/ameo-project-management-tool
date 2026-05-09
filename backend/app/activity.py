from typing import Any

from sqlalchemy.orm import Session

from app.models import TaskActivityEvent, User


def record_task_activity(
    db: Session,
    task_id: int,
    actor: User,
    event_type: str,
    payload: dict[str, Any],
) -> TaskActivityEvent:
    event = TaskActivityEvent(
        task_id=task_id,
        actor_id=actor.id,
        event_type=event_type,
        payload=payload,
    )
    db.add(event)
    return event
