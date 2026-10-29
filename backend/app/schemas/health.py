from typing import Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Schema for API health status check."""

    status: str = Field(..., description="Operational status of the service", json_schema_extra={"example": "healthy"})
    app: str = Field(..., description="Name of the service", json_schema_extra={"example": "Digital Wardrobe API"})
    version: str = Field(..., description="Semantic version of the application", json_schema_extra={"example": "0.3.0"})
    environment: str = Field(..., description="Active runtime environment", json_schema_extra={"example": "development"})
    storage_provider: Optional[str] = Field(default="local", description="Active storage provider ('local' or 'r2')")
    database: Optional[str] = Field(default="sqlite", description="Active database type ('sqlite' or 'postgresql')")
