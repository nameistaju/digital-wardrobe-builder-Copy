import asyncio
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.api.v1 import api_router
from app.core.config import settings
from app.core.database import init_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager: ensure storage exists and initialize DB without blocking server port binding."""
    logger.info("Lifespan startup: verifying storage paths...")
    settings.absolute_storage_path.mkdir(parents=True, exist_ok=True)
    logger.info("Lifespan startup: scheduling async DB schema verification...")
    # Initialize database in the background so Uvicorn binds immediately to the port
    # and satisfies cloud port-binding probes without waiting for remote DB handshakes.
    asyncio.create_task(init_db())
    logger.info("Lifespan startup complete: port is ready to accept traffic.")
    yield
    logger.info("Lifespan shutdown complete.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-minded backend foundation for the Digital Wardrobe Builder.",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API v1 routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint welcoming clients and directing them to docs and health status."""
    return {
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "health": f"{settings.API_V1_STR}/health",
    }


@app.get("/health", tags=["Health"], status_code=status.HTTP_200_OK)
async def health_check():
    """Lightweight root health check endpoint for cloud load balancers and Render health checks."""
    return {
        "status": "healthy",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.APP_ENV,
    }


if __name__ == "__main__":
    port = int(os.environ.get("PORT", settings.PORT))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=True if settings.APP_ENV == "development" else False,
    )
