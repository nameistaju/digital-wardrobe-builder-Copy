from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class TryOnStatusResponse(BaseModel):
    is_configured: bool
    model_name: str
    endpoint: str
    available_models: List[str] = [
        "idm-vton",
        "gemini-nano-banana-2.1",
        "gemini-3.1-flash-image",
        "gemini-3.1-flash-lite-image",
        "gemini-2.5-flash-image",
        "qwen-image-edit",
        "qwen-image",
    ]
    idm_vton_configured: bool = True
    gemini_configured: bool = False
    nvidia_configured: bool = False


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
