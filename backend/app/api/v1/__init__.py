"""API version 1 routers."""

from fastapi import APIRouter
from app.api.v1.health import router as health_router

api_router = APIRouter()
api_router.include_router(health_router, prefix="/health", tags=["Health"])

__all__ = ["api_router"]
