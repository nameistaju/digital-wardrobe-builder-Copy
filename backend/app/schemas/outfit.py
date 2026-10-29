from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class CanvasItem(BaseModel):
    garment_id: int
    x: float
    y: float
    width: float
    height: float
    z_index: int = 1
    rotation: float = 0.0


class OutfitCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    season: Optional[str] = None
    occasion: Optional[str] = None
    preview_image_url: Optional[str] = None
    layout_data: List[CanvasItem] = Field(default_factory=list)
    is_favorite: bool = False


class OutfitUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    season: Optional[str] = None
    occasion: Optional[str] = None
    preview_image_url: Optional[str] = None
    layout_data: Optional[List[CanvasItem]] = None
    is_favorite: Optional[bool] = None


class OutfitOut(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str] = None
    season: Optional[str] = None
    occasion: Optional[str] = None
    preview_image_url: Optional[str] = None
    layout_data: List[CanvasItem]
    is_favorite: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
