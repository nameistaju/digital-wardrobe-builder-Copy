from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Schema for API health status check."""

    status: str = Field(..., description="Operational status of the service", json_schema_extra={"example": "healthy"})
    app: str = Field(..., description="Name of the service", json_schema_extra={"example": "Digital Wardrobe API"})
    version: str = Field(..., description="Semantic version of the application", json_schema_extra={"example": "0.1.0"})
    environment: str = Field(..., description="Active runtime environment", json_schema_extra={"example": "development"})
