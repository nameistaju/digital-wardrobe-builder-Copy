from fastapi import APIRouter, status
from app.core.config import settings
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get(
    "",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Health check",
    description="Returns the operational status, active storage provider, and database type.",
)
async def check_health() -> HealthResponse:
    """Return health status of the API service."""
    db_type = "postgresql" if "postgresql" in settings.DATABASE_URL.lower() else "sqlite"
    return HealthResponse(
        status="healthy",
        app=settings.PROJECT_NAME,
        version=settings.VERSION,
        environment=settings.APP_ENV,
        storage_provider=settings.STORAGE_PROVIDER,
        database=db_type,
    )
