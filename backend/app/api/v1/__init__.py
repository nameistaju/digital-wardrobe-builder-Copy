from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.garments import router as garments_router
from app.api.v1.extraction import router as extraction_router
from app.api.v1.outfits import router as outfits_router
from app.api.v1.storage import router as storage_router
from app.api.v1.tryon import router as tryon_router

api_router = APIRouter()
api_router.include_router(health_router, prefix="/health", tags=["Health"])
api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(garments_router, prefix="/garments", tags=["Garments"])
api_router.include_router(extraction_router, prefix="/extraction", tags=["AI Extraction"])
api_router.include_router(outfits_router, prefix="/outfits", tags=["Outfits"])
api_router.include_router(storage_router, prefix="/storage", tags=["Storage Assets"])
api_router.include_router(tryon_router, prefix="/try-on", tags=["AI Virtual Try-On"])

__all__ = ["api_router"]
