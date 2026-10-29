from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_

from app.core.database import get_db
from app.core.storage import storage_service
from app.services.ai_segmentation import remove_image_background
from app.models.user import User
from app.models.garment import Garment
from app.schemas.garment import GarmentOut, GarmentListResponse, GarmentUpdate, CategoryCount
from app.api.deps import get_current_user

router = APIRouter()


@router.post("/upload", response_model=GarmentOut, status_code=status.HTTP_201_CREATED)
async def upload_garment(
    file: UploadFile = File(...),
    name: str = Form(...),
    category: str = Form(...),
    subcategory: Optional[str] = Form(None),
    color: Optional[str] = Form(None),
    season: Optional[str] = Form("all"),
    brand: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    is_favorite: bool = Form(False),
    remove_background: bool = Form(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Uploads an individual garment with optional background removal."""
    content = await file.read()
    original_url = await storage_service.save_file(content, file.filename or "upload.jpg", subfolder="originals")

    processed_content = content
    if remove_background:
        try:
            processed_content = remove_image_background(content)
        except Exception:
            pass  # Fall back to original content if processing fails

    final_url = await storage_service.save_file(
        processed_content,
        f"clean_{file.filename or 'upload.png'}",
        subfolder="garments",
    )

    garment = Garment(
        user_id=current_user.id,
        name=name.strip(),
        category=category.lower().strip(),
        subcategory=subcategory.strip() if subcategory else None,
        color=color.strip() if color else None,
        season=season.lower().strip() if season else "all",
        brand=brand.strip() if brand else None,
        notes=notes.strip() if notes else None,
        is_favorite=is_favorite,
        image_url=final_url,
        original_image_url=original_url,
        source_type="individual_upload",
    )
    db.add(garment)
    await db.commit()
    await db.refresh(garment)

    return GarmentOut.model_validate(garment)


@router.get("", response_model=GarmentListResponse)
async def list_garments(
    category: Optional[str] = None,
    season: Optional[str] = None,
    is_favorite: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List and filter garments belonging to the authenticated user."""
    conditions = [Garment.user_id == current_user.id]

    if category and category.lower() != "all":
        conditions.append(Garment.category == category.lower().strip())
    if season and season.lower() != "all":
        conditions.append(Garment.season == season.lower().strip())
    if is_favorite is not None:
        conditions.append(Garment.is_favorite == is_favorite)
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        conditions.append(
            or_(
                func.lower(Garment.name).like(term),
                func.lower(Garment.subcategory).like(term),
                func.lower(Garment.color).like(term),
                func.lower(Garment.brand).like(term),
            )
        )

    # Count total
    count_stmt = select(func.count(Garment.id)).where(and_(*conditions))
    total_res = await db.execute(count_stmt)
    total = total_res.scalar() or 0

    # Query items
    query = (
        select(Garment)
        .where(and_(*conditions))
        .order_by(Garment.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    res = await db.execute(query)
    items = res.scalars().all()

    return GarmentListResponse(
        items=[GarmentOut.model_validate(item) for item in items],
        total=total,
    )


@router.get("/categories", response_model=List[CategoryCount])
async def get_category_counts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns count of items grouped by category for the current user."""
    stmt = (
        select(Garment.category, func.count(Garment.id))
        .where(Garment.user_id == current_user.id)
        .group_by(Garment.category)
    )
    res = await db.execute(stmt)
    rows = res.all()
    return [CategoryCount(category=row[0], count=row[1]) for row in rows]


@router.get("/{garment_id}", response_model=GarmentOut)
async def get_garment(
    garment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch single garment by ID."""
    stmt = select(Garment).where(Garment.id == garment_id, Garment.user_id == current_user.id)
    res = await db.execute(stmt)
    garment = res.scalar_one_or_none()
    if not garment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Garment not found.")
    return GarmentOut.model_validate(garment)


@router.patch("/{garment_id}", response_model=GarmentOut)
async def update_garment(
    garment_id: int,
    updates: GarmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update metadata or favorite status of a garment."""
    stmt = select(Garment).where(Garment.id == garment_id, Garment.user_id == current_user.id)
    res = await db.execute(stmt)
    garment = res.scalar_one_or_none()
    if not garment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Garment not found.")

    update_data = updates.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(garment, field, val)

    await db.commit()
    await db.refresh(garment)
    return GarmentOut.model_validate(garment)


@router.delete("/{garment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_garment(
    garment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a garment and remove its stored images."""
    stmt = select(Garment).where(Garment.id == garment_id, Garment.user_id == current_user.id)
    res = await db.execute(stmt)
    garment = res.scalar_one_or_none()
    if not garment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Garment not found.")

    # Delete files
    await storage_service.delete_file(garment.image_url)
    if garment.original_image_url:
        await storage_service.delete_file(garment.original_image_url)

    await db.delete(garment)
    await db.commit()
    return None
