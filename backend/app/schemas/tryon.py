from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class TryOnStatusResponse(BaseModel):
    is_configured: bool
    status: str = "available"  # "available", "unavailable", "quota_exceeded"
    model_name: str = "IDM-VTON (ECCV 2024)"
    endpoint: str = "yisol/IDM-VTON"
    detail: Optional[str] = None
    stage: Optional[str] = None
    hardware: Optional[str] = None


class TryOnResponse(BaseModel):
    id: int
    result_image_url: str
    person_image_url: str
    garment_image_url: str
    garment_id: Optional[int] = None
    prompt: Optional[str] = None
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TryOnHistoryResponse(BaseModel):
    items: List[TryOnResponse]
    total: int
