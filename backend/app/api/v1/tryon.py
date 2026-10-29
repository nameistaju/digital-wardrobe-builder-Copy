import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from app.core.config import settings
from app.core.database import get_db
from app.core.storage import storage_service
from app.api.deps import get_current_user
from app.models.user import User
from app.models.garment import Garment
from app.models.tryon import TryOnRecord
from app.schemas.tryon import TryOnStatusResponse, TryOnResponse, TryOnHistoryResponse
from app.services.nvidia_tryon import generate_virtual_tryon

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/status", response_model=TryOnStatusResponse)
async def get_tryon_status():
    """Returns availability and configuration state of the NVIDIA Virtual Try-On service."""
    has_key = bool(settings.NVIDIA_API_KEY and settings.NVIDIA_API_KEY.strip())
    return TryOnStatusResponse(
        is_configured=has_key,
        model_name="qwen/qwen-image-edit",
        endpoint=settings.NVIDIA_TRYON_ENDPOINT,
    )


@router.post("/generate", response_model=TryOnResponse, status_code=status.HTTP_201_CREATED)
async def create_virtual_tryon(
    person_image: UploadFile = File(..., description="Real full-body or torso photograph of the person"),
    garment_image: Optional[UploadFile] = File(None, description="Clothing product photograph"),
    garment_id: Optional[int] = Form(None, description="ID of existing wardrobe item to try on"),
    prompt: Optional[str] = Form(None, description="Optional styling or draping instruction"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Executes real AI Virtual Try-On using NVIDIA Qwen-Image-Edit NIM.
    Takes a person photo and either an uploaded garment image or an existing wardrobe garment ID.
    """
    if not garment_image and not garment_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either a garment image file or an existing garment_id must be provided.",
        )

    # Read and validate person image
    person_bytes = await person_image.read()
    if not person_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Person image file is empty.",
        )
    storage_service.validate_file(person_bytes, person_image.filename or "person.jpg")

    # Resolve garment bytes and URL
    garment_bytes: bytes
    garment_image_url: str

    if garment_id is not None:
        result = await db.execute(
            select(Garment).where(
                Garment.id == garment_id,
                Garment.user_id == current_user.id,
            )
        )
        garment = result.scalars().first()
        if not garment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Wardrobe garment #{garment_id} not found.",
            )
        garment_image_url = garment.image_url
        fetched_bytes = await storage_service.get_file_bytes(garment.image_url)
        if not fetched_bytes:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Could not retrieve the image file for the selected wardrobe item.",
            )
        garment_bytes = fetched_bytes
    else:
        garment_bytes = await garment_image.read()  # type: ignore[union-attr]
        if not garment_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Garment image file is empty.",
            )
        storage_service.validate_file(garment_bytes, garment_image.filename or "garment.jpg")  # type: ignore[union-attr]
        garment_image_url = await storage_service.save_file(
            garment_bytes,
            garment_image.filename or "garment.jpg",  # type: ignore[union-attr]
            subfolder="tryon/garments",
        )

    # Save person image to storage
    person_image_url = await storage_service.save_file(
        person_bytes,
        person_image.filename or "person.jpg",
        subfolder="tryon/persons",
    )

    # Call NVIDIA AI Virtual Try-On service
    generated_bytes = await generate_virtual_tryon(
        person_bytes=person_bytes,
        garment_bytes=garment_bytes,
        custom_prompt=prompt,
    )

    # Save generated AI result image
    result_image_url = await storage_service.save_file(
        generated_bytes,
        "tryon_result.png",
        subfolder="tryon/results",
    )

    # Save try-on history record
    record = TryOnRecord(
        user_id=current_user.id,
        person_image_url=person_image_url,
        garment_image_url=garment_image_url,
        garment_id=garment_id,
        result_image_url=result_image_url,
        prompt=prompt.strip() if prompt else None,
        status="completed",
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    logger.info("Successfully generated AI try-on record #%s for user #%s", record.id, current_user.id)
    return record


@router.get("/history", response_model=TryOnHistoryResponse)
async def get_tryon_history(
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieves previous AI Virtual Try-On generations for the current user."""
    count_query = select(func.count()).select_from(TryOnRecord).where(TryOnRecord.user_id == current_user.id)
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    query = (
        select(TryOnRecord)
        .where(TryOnRecord.user_id == current_user.id)
        .order_by(desc(TryOnRecord.created_at))
        .offset(offset)
        .limit(min(limit, 100))
    )
    result = await db.execute(query)
    items = result.scalars().all()

    return TryOnHistoryResponse(items=list(items), total=total)
