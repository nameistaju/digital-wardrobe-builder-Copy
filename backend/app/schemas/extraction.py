from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class BoundingBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class CandidateGarment(BaseModel):
    id: str
    category: str
    subcategory: Optional[str] = None
    confidence: float
    image_url: str
    bounding_box: Dict[str, float]
    status: str = "pending"  # pending, approved, rejected


class ExtractionJobOut(BaseModel):
    id: int
    user_id: int
    source_image_url: str
    status: str  # pending, processing, completed, failed
    candidate_garments: List[CandidateGarment]
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApproveCandidateRequest(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    color: Optional[str] = None
    season: Optional[str] = "all"
    brand: Optional[str] = None
    notes: Optional[str] = None


class RefineCandidateRequest(BaseModel):
    bounding_box: Optional[Dict[str, float]] = None
    action: str = "crop"  # crop, resegment
