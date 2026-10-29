import io
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from PIL import Image

from app.core.database import get_db, AsyncSessionLocal
from app.core.storage import storage_service
from app.services.ai_segmentation import segment_full_body_outfit, remove_image_background
from app.models.user import User
from app.models.extraction import ExtractionJob
from app.models.garment import Garment
from app.schemas.extraction import ExtractionJobOut, ApproveCandidateRequest, RefineCandidateRequest
from app.schemas.garment import GarmentOut
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


async def run_async_extraction(job_id: int, image_bytes: bytes, filename: str):
    """Background task executing clothing segmentation and candidate extraction."""
    async with AsyncSessionLocal() as db:
        try:
            # Set job status to processing
            stmt = select(ExtractionJob).where(ExtractionJob.id == job_id)
            res = await db.execute(stmt)
            job = res.scalar_one_or_none()
            if not job:
                return

            job.status = "processing"
            await db.commit()

            # Execute segmentation
            raw_candidates = segment_full_body_outfit(image_bytes)

            stored_candidates = []
            for c in raw_candidates:
                # Save candidate transparent crop to storage
                cand_url = await storage_service.save_file(
                    c["image_bytes"],
                    f"cand_{c['category']}_{c['id']}.png",
                    subfolder="candidates",
                )
                stored_candidates.append({
                    "id": c["id"],
                    "category": c["category"],
                    "subcategory": c["subcategory"],
                    "confidence": c["confidence"],
                    "image_url": cand_url,
                    "bounding_box": c["bounding_box"],
                    "status": "pending",
                })

            job.candidate_garments = stored_candidates
            job.status = "completed"
            await db.commit()

        except Exception as e:
            logger.error("Extraction job %s failed: %s", job_id, e)
            stmt = select(ExtractionJob).where(ExtractionJob.id == job_id)
            res = await db.execute(stmt)
            job = res.scalar_one_or_none()
            if job:
                job.status = "failed"
                job.error_message = str(e)
                await db.commit()


@router.post("/upload", response_model=ExtractionJobOut, status_code=status.HTTP_202_ACCEPTED)
async def upload_for_extraction(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a full-body photograph to trigger asynchronous AI garment parsing."""
    content = await file.read()
    source_url = await storage_service.save_file(content, file.filename or "outfit.jpg", subfolder="outfits_raw")

    job = ExtractionJob(
        user_id=current_user.id,
        source_image_url=source_url,
        status="pending",
        candidate_garments=[],
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Dispatch asynchronous parsing task
    background_tasks.add_task(run_async_extraction, job.id, content, file.filename or "outfit.jpg")

    return ExtractionJobOut.model_validate(job)


@router.get("/{job_id}", response_model=ExtractionJobOut)
async def get_extraction_job(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the status and candidates of an extraction job."""
    stmt = select(ExtractionJob).where(ExtractionJob.id == job_id, ExtractionJob.user_id == current_user.id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Extraction job not found.")
    return ExtractionJobOut.model_validate(job)


@router.post("/{job_id}/candidates/{candidate_id}/approve", response_model=GarmentOut)
async def approve_candidate(
    job_id: int,
    candidate_id: str,
    details: ApproveCandidateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Approves an extracted candidate garment and permanently adds it to the user's wardrobe."""
    stmt = select(ExtractionJob).where(ExtractionJob.id == job_id, ExtractionJob.user_id == current_user.id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Extraction job not found.")

    candidates = list(job.candidate_garments)
    target_candidate = None
    for c in candidates:
        if c.get("id") == candidate_id:
            target_candidate = c
            c["status"] = "approved"
            break

    if not target_candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate garment not found.")

    # Update job JSON
    job.candidate_garments = candidates

    # Create permanent garment in wardrobe
    chosen_category = details.category or target_candidate.get("category", "tops")
    chosen_name = details.name or f"Extracted {chosen_category.capitalize()}"

    garment = Garment(
        user_id=current_user.id,
        name=chosen_name,
        category=chosen_category.lower().strip(),
        subcategory=details.subcategory or target_candidate.get("subcategory"),
        color=details.color,
        season=details.season or "all",
        brand=details.brand,
        notes=details.notes,
        is_favorite=False,
        image_url=target_candidate["image_url"],
        original_image_url=job.source_image_url,
        source_type="extracted_outfit",
        extraction_confidence=target_candidate.get("confidence", 0.9),
    )
    db.add(garment)
    await db.commit()
    await db.refresh(garment)

    return GarmentOut.model_validate(garment)


@router.post("/{job_id}/candidates/{candidate_id}/reject", status_code=status.HTTP_200_OK)
async def reject_candidate(
    job_id: int,
    candidate_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rejects an extracted candidate garment."""
    stmt = select(ExtractionJob).where(ExtractionJob.id == job_id, ExtractionJob.user_id == current_user.id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Extraction job not found.")

    candidates = list(job.candidate_garments)
    found = False
    for c in candidates:
        if c.get("id") == candidate_id:
            c["status"] = "rejected"
            found = True
            break

    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate garment not found.")

    job.candidate_garments = candidates
    await db.commit()
    return {"message": "Candidate rejected successfully"}


@router.post("/{job_id}/candidates/{candidate_id}/refine", status_code=status.HTTP_200_OK)
async def refine_candidate(
    job_id: int,
    candidate_id: str,
    refine_data: RefineCandidateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Refines candidate bounds from the manual correction interface."""
    stmt = select(ExtractionJob).where(ExtractionJob.id == job_id, ExtractionJob.user_id == current_user.id)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Extraction job not found.")

    candidates = list(job.candidate_garments)
    target = None
    for c in candidates:
        if c.get("id") == candidate_id:
            target = c
            if refine_data.bounding_box:
                c["bounding_box"] = refine_data.bounding_box
            break

    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found.")

    job.candidate_garments = candidates
    await db.commit()
    return {"message": "Candidate refined successfully", "candidate": target}
