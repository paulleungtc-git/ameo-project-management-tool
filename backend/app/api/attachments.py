from hashlib import sha256
from io import BytesIO
from uuid import uuid4

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db.session import get_db
from app.models import Attachment, User
from app.permissions import require_task_access
from app.schemas import AttachmentRead
from app.storage import ObjectStorage, get_object_storage

router = APIRouter(prefix="/attachments", tags=["attachments"])


@router.get("/tasks/{task_id}", response_model=list[AttachmentRead])
def list_task_attachments(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Attachment]:
    task = require_task_access(db, current_user, task_id)
    return list(
        db.scalars(
            select(Attachment)
            .where(
                Attachment.workspace_id == task.workspace_id,
                Attachment.owner_type == "task",
                Attachment.owner_id == task.id,
            )
            .order_by(Attachment.created_at.desc()),
        ),
    )


@router.post("/tasks/{task_id}", response_model=AttachmentRead, status_code=status.HTTP_201_CREATED)
async def upload_task_attachment(
    task_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    storage: ObjectStorage = Depends(get_object_storage),
) -> Attachment:
    task = require_task_access(db, current_user, task_id)
    content = await file.read()
    checksum = sha256(content).hexdigest()
    content_type = file.content_type or "application/octet-stream"
    filename = file.filename or "attachment"
    storage_key = f"workspaces/{task.workspace_id}/tasks/{task.id}/{uuid4().hex}-{filename}"
    storage.put_file(storage_key, BytesIO(content), content_type)

    attachment = Attachment(
        workspace_id=task.workspace_id,
        owner_type="task",
        owner_id=task.id,
        uploaded_by_id=current_user.id,
        filename=filename,
        content_type=content_type,
        byte_size=len(content),
        storage_key=storage_key,
        checksum=checksum,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment
