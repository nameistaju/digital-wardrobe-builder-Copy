import logging
from pathlib import Path
from typing import List
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application configuration settings loaded from environment or .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "Digital Wardrobe API"
    VERSION: str = "0.2.0"
    API_V1_STR: str = "/api/v1"

    APP_ENV: str = Field(default="development", description="Environment mode: development, test, or production")
    FRONTEND_ORIGIN: str = Field(default="http://localhost:3000", description="Allowed CORS origin for frontend client")
    HOST: str = Field(default="127.0.0.1", description="Host address to bind the API server")
    PORT: int = Field(default=8000, description="Port number to bind the API server")

    # Database
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./wardrobe.db",
        description="Database connection string (SQLite for dev or PostgreSQL+asyncpg)",
    )

    # Security & JWT
    SECRET_KEY: str = Field(
        default="dev-wardrobe-secret-key-min-32-chars-long-2026-secure",
        description="JWT encryption secret key",
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Storage
    STORAGE_DIR: str = Field(
        default="storage",
        description="Local storage directory for uploaded garments and outfits",
    )
    MAX_UPLOAD_SIZE_BYTES: int = 15 * 1024 * 1024  # 15 MB

    @field_validator("PORT", mode="before")
    @classmethod
    def validate_port(cls, v: object) -> int:
        try:
            val = int(v)  # type: ignore[arg-type]
            if 1 <= val <= 65535:
                return val
            logger.warning("Port %s is out of valid range (1-65535). Falling back to 8000.", val)
            return 8000
        except (ValueError, TypeError):
            logger.warning("Invalid PORT value %r. Falling back to default port 8000.", v)
            return 8000

    @field_validator("FRONTEND_ORIGIN", mode="before")
    @classmethod
    def validate_frontend_origin(cls, v: object) -> str:
        if isinstance(v, str) and v.strip():
            return v.strip().rstrip("/")
        return "http://localhost:3000"

    @property
    def cors_origins(self) -> List[str]:
        """Parsed list of allowed origins for CORS middleware."""
        origins = [self.FRONTEND_ORIGIN]
        if self.APP_ENV == "development":
            for fallback in ("http://localhost:3000", "http://127.0.0.1:3000"):
                if fallback not in origins:
                    origins.append(fallback)
        return origins

    @property
    def absolute_storage_path(self) -> Path:
        """Returns the resolved absolute path to the storage folder."""
        # Relative to project root
        p = Path(__file__).resolve().parent.parent.parent.parent / self.STORAGE_DIR
        p.mkdir(parents=True, exist_ok=True)
        return p


try:
    settings = Settings()
except Exception as e:
    logger.error("Failed to load environment configuration: %s. Using default settings.", e)
    settings = Settings(_env_file=None)
