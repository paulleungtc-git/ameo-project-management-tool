from fastapi import APIRouter

from app.api import attachments, auth, projects, tasks, workspaces
from app.core.config import get_settings

router = APIRouter()
router.include_router(auth.router)
router.include_router(workspaces.router)
router.include_router(projects.router)
router.include_router(tasks.router)
router.include_router(attachments.router)


@router.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    settings = get_settings()
    return {
        "status": "ok",
        "environment": settings.environment,
    }
