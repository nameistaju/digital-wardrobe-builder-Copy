from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class GarmentBase(BaseModel):
    name: str = Field(..., max_length=255)
    category: str = Field(..., description="tops, bottoms, outerwear, shoes, bags, accessories, one-piece, other")
    subcategory: Optional[str] = None
    color: Optional[str] = None
    season: Optional[str] = "all"
    brand: Optional[str] = None
    notes: Optional[str] = None
    is_favorite: bool = False


class GarmentCreate(GarmentBase):
    pass


class GarmentUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    color: Optional[str] = None
    season: Optional[str] = None
    brand: Optional[str] = None
    notes: Optional[str] = None
    is_favorite: Optional[bool] = None


class GarmentOut(GarmentBase):
    id: int
    user_id: int
    image_url: str
    original_image_url: Optional[str] = None
    source_type: str
    extraction_confidence: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GarmentListResponse(BaseModel):
    items: List[GarmentOut]
    total: int


class CategoryCount(BaseModel):
    category: str
    count: int
