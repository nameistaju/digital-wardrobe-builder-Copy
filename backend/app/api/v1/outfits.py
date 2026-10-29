import base64
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.storage import storage_service
from app.models.user import User
from app.models.outfit import Outfit
from app.schemas.outfit import OutfitCreate, OutfitUpdate, OutfitOut
from app.api.deps import get_current_user

router = APIRouter()


@router.post("", response_model=OutfitOut, status_code=status.HTTP_201_CREATED)
async def create_outfit(
    outfit_in: OutfitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save an outfit layout created in the outfit builder."""
    preview_url = outfit_in.preview_image_url

    # If preview is sent as base64 data URL from HTML5 canvas, save it as a PNG file
    if preview_url and preview_url.startswith("data:image"):
        try:
            header, base64_data = preview_url.split(",", 1)
            raw_bytes = base64.b64decode(base64_data)
            preview_url = await storage_service.save_file(
                raw_bytes,
                f"outfit_preview_{uuid.uuid4().hex[:8]}.png",
                subfolder="outfits",
            )
        except Exception:
            preview_url = None

    outfit = Outfit(
        user_id=current_user.id,
        name=outfit_in.name.strip(),
        description=outfit_in.description.strip() if outfit_in.description else None,
        season=outfit_in.season,
        occasion=outfit_in.occasion,
        preview_image_url=preview_url,
        layout_data=[item.model_dump() for item in outfit_in.layout_data],
        is_favorite=outfit_in.is_favorite,
    )
    db.add(outfit)
    await db.commit()
    await db.refresh(outfit)

    return OutfitOut.model_validate(outfit)


@router.get("", response_model=List[OutfitOut])
async def list_outfits(
    season: Optional[str] = None,
    occasion: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all outfits belonging to the current user."""
    conditions = [Outfit.user_id == current_user.id]
    if season and season.lower() != "all":
        conditions.append(Outfit.season == season.lower())
    if occasion and occasion.lower() != "all":
        conditions.append(Outfit.occasion == occasion.lower())

    stmt = select(Outfit).where(*conditions).order_by(Outfit.created_at.desc())
    res = await db.execute(stmt)
    outfits = res.scalars().all()
    return [OutfitOut.model_validate(o) for o in outfits]


@router.get("/{outfit_id}", response_model=OutfitOut)
async def get_outfit(
    outfit_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single outfit by ID."""
    stmt = select(Outfit).where(Outfit.id == outfit_id, Outfit.user_id == current_user.id)
    res = await db.execute(stmt)
    outfit = res.scalar_one_or_none()
    if not outfit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outfit not found.")
    return OutfitOut.model_validate(outfit)


@router.patch("/{outfit_id}", response_model=OutfitOut)
async def update_outfit(
    outfit_id: int,
    outfit_in: OutfitUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update outfit name, metadata, or canvas layout."""
    stmt = select(Outfit).where(Outfit.id == outfit_id, Outfit.user_id == current_user.id)
    res = await db.execute(stmt)
    outfit = res.scalar_one_or_none()
    if not outfit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outfit not found.")

    update_data = outfit_in.model_dump(exclude_unset=True)
    if "layout_data" in update_data and update_data["layout_data"] is not None:
        outfit.layout_data = [item.model_dump() if hasattr(item, "model_dump") else item for item in outfit_in.layout_data]
        del update_data["layout_data"]

    for field, val in update_data.items():
        setattr(outfit, field, val)

    await db.commit()
    await db.refresh(outfit)
    return OutfitOut.model_validate(outfit)


@router.delete("/{outfit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_outfit(
    outfit_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an outfit and its preview thumbnail."""
    stmt = select(Outfit).where(Outfit.id == outfit_id, Outfit.user_id == current_user.id)
    res = await db.execute(stmt)
    outfit = res.scalar_one_or_none()
    if not outfit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Outfit not found.")

    if outfit.preview_image_url:
        await storage_service.delete_file(outfit.preview_image_url)

    await db.delete(outfit)
    await db.commit()
    return None
