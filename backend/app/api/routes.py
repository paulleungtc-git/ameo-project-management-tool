from fastapi import APIRouter

from app.api import auth
from app.core.config import get_settings

router = APIRouter()
router.include_router(auth.router)


@router.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    settings = get_settings()
    return {
        "status": "ok",
        "environment": settings.environment,
    }
