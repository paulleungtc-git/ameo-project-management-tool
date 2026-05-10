from datetime import date, datetime

from pydantic import BaseModel, Field


class UserRead(BaseModel):
    id: int
    email: str
    name: str
    external_ref: str | None = None

    model_config = {"from_attributes": True}


class AuthRegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=200)
    workspace_name: str = Field(min_length=1, max_length=160)
    external_ref: str | None = Field(default=None, max_length=255)


class AuthLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class WorkspaceRead(BaseModel):
    id: int
    name: str
    role: str


class WorkspaceMemberRead(BaseModel):
    id: int
    workspace_id: int
    user_id: int
    email: str
    name: str
    role: str
    created_at: datetime


class WorkspaceMemberAdd(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    role: str = "member"


class WorkspaceMemberUpdate(BaseModel):
    role: str = Field(min_length=1, max_length=20)


class ProjectCreate(BaseModel):
    workspace_id: int
    name: str = Field(min_length=1, max_length=180)
    description: str = ""


class ProjectRead(BaseModel):
    id: int
    workspace_id: int
    name: str
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    project_id: int
    title: str = Field(min_length=1, max_length=240)
    description: str = ""
    status: str = "Backlog"
    priority: str = "Medium"
    assignee_id: int | None = None
    due_date: date | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    assignee_id: int | None = None
    due_date: date | None = None


class TaskRead(BaseModel):
    id: int
    workspace_id: int
    project_id: int
    title: str
    description: str
    status: str
    priority: str
    assignee_id: int | None
    created_by_id: int
    due_date: date | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    body: str = Field(min_length=1)


class CommentRead(BaseModel):
    id: int
    task_id: int
    author_id: int
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ActivityRead(BaseModel):
    id: int
    task_id: int
    actor_id: int
    event_type: str
    payload: dict
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationRead(BaseModel):
    id: int
    workspace_id: int
    user_id: int
    task_id: int | None
    event_type: str
    title: str
    body: str
    read_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AttachmentRead(BaseModel):
    id: int
    workspace_id: int
    owner_type: str
    owner_id: int
    filename: str
    content_type: str
    byte_size: int
    checksum: str
    created_at: datetime

    model_config = {"from_attributes": True}
