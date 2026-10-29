import logging
from pathlib import Path
from typing import List, Optional, Tuple
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

DEFAULT_DEV_SECRET = "dev-wardrobe-secret-key-min-32-chars-long-2026-secure"


class Settings(BaseSettings):
    """Application configuration settings loaded from environment or .env file."""

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env", Path(__file__).resolve().parent.parent.parent / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "Digital Wardrobe API"
    VERSION: str = "0.3.0"
    API_V1_STR: str = "/api/v1"

    APP_ENV: str = Field(default="development", description="Environment mode: development, test, or production")
    FRONTEND_ORIGIN: str = Field(default="http://localhost:3000", description="Primary allowed origin for frontend client")
    CORS_ORIGINS: Optional[str] = Field(default=None, description="Comma-separated list of additional allowed CORS origins")
    HOST: str = Field(default="127.0.0.1", description="Host address to bind the API server")
    PORT: int = Field(default=8000, description="Port number to bind the API server (Render sets $PORT)")

    # Database: Supports SQLite (aiosqlite) locally and Supabase PostgreSQL (asyncpg) in production
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./wardrobe.db",
        description="Database connection string (SQLite for dev or Supabase PostgreSQL+asyncpg)",
    )

    # Security & JWT
    SECRET_KEY: str = Field(
        default=DEFAULT_DEV_SECRET,
        description="JWT encryption secret key",
    )
    JWT_SECRET_KEY: Optional[str] = Field(
        default=None,
        description="Alias for SECRET_KEY if provided by cloud environment",
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Storage: Supports local filesystem in dev and Cloudflare R2 in production
    STORAGE_PROVIDER: str = Field(
        default="local",
        description="Storage backend: 'local' (filesystem) or 'r2' (Cloudflare R2)",
    )
    STORAGE_DIR: str = Field(
        default="storage",
        description="Local storage directory for development",
    )
    MAX_UPLOAD_SIZE_BYTES: int = 15 * 1024 * 1024  # 15 MB

    # Cloudflare R2 Configuration (Private S3-compatible bucket)
    R2_ACCOUNT_ID: Optional[str] = Field(default=None, description="Cloudflare Account ID")
    R2_ACCESS_KEY_ID: Optional[str] = Field(default=None, description="R2 Access Key ID")
    R2_SECRET_ACCESS_KEY: Optional[str] = Field(default=None, description="R2 Secret Access Key")
    R2_BUCKET_NAME: str = Field(default="digital-wardrobe-assets", description="Cloudflare R2 Bucket Name")
    R2_ENDPOINT_URL: Optional[str] = Field(default=None, description="Direct R2 S3 API Endpoint URL")

    # NVIDIA NIM Virtual Try-On (Qwen Models)
    NVIDIA_API_KEY: Optional[str] = Field(
        default=None,
        description="NVIDIA API Key for Qwen virtual try-on models (never expose to frontend)",
    )
    NVIDIA_TRYON_ENDPOINT: str = Field(
        default="https://integrate.api.nvidia.com/v1/genai/qwen/qwen-image-edit",
        description="NVIDIA NIM endpoint for Qwen-Image-Edit (or local http://localhost:8080/v1/infer)",
    )
    NVIDIA_QWEN_IMAGE_ENDPOINT: str = Field(
        default="https://integrate.api.nvidia.com/v1/genai/qwen/qwen-image",
        description="NVIDIA NIM endpoint for Qwen-Image foundation model (or local http://localhost:8000/v1/infer)",
    )
    NVIDIA_TRYON_TIMEOUT_SECONDS: int = Field(
        default=120,
        description="Timeout in seconds for AI image generation requests",
    )

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
    def active_secret_key(self) -> str:
        """Returns the active JWT secret key, preferring JWT_SECRET_KEY if explicitly set."""
        return self.JWT_SECRET_KEY or self.SECRET_KEY

    @property
    def cors_origins(self) -> List[str]:
        """Parsed list of allowed origins for CORS middleware."""
        origins: List[str] = []
        if self.FRONTEND_ORIGIN:
            origins.append(self.FRONTEND_ORIGIN)

        if self.CORS_ORIGINS:
            for item in self.CORS_ORIGINS.split(","):
                cleaned = item.strip().rstrip("/")
                if cleaned and cleaned not in origins:
                    origins.append(cleaned)

        if self.APP_ENV == "development":
            for fallback in ("http://localhost:3000", "http://127.0.0.1:3000"):
                if fallback not in origins:
                    origins.append(fallback)

        return origins

    @property
    def resolved_r2_endpoint_url(self) -> Optional[str]:
        """Returns the resolved Cloudflare R2 S3 endpoint URL."""
        if self.R2_ENDPOINT_URL and self.R2_ENDPOINT_URL.strip():
            return self.R2_ENDPOINT_URL.strip()
        if self.R2_ACCOUNT_ID and self.R2_ACCOUNT_ID.strip():
            return f"https://{self.R2_ACCOUNT_ID.strip()}.r2.cloudflarestorage.com"
        return None

    @property
    def absolute_storage_path(self) -> Path:
        """Returns the resolved absolute path to the local storage folder."""
        p = Path(__file__).resolve().parent.parent.parent.parent / self.STORAGE_DIR
        p.mkdir(parents=True, exist_ok=True)
        return p

    def get_database_connection_params(self) -> Tuple[str, dict]:
        """
        Normalizes DATABASE_URL for SQLAlchemy async engine.
        Handles Supabase connection poolers, asyncpg driver injection, and SSL requirement.
        """
        raw_url = self.DATABASE_URL.strip()
        clean_url = raw_url
        connect_args: dict = {}

        # Convert standard postgres/postgresql scheme to postgresql+asyncpg
        if clean_url.startswith("postgres://"):
            clean_url = clean_url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif clean_url.startswith("postgresql://") and not clean_url.startswith("postgresql+asyncpg://"):
            clean_url = clean_url.replace("postgresql://", "postgresql+asyncpg://", 1)

        # Asyncpg uses ssl parameter in connect_args, not in query string
        if clean_url.startswith("postgresql+asyncpg://"):
            # If sslmode=require is in URL, strip it so asyncpg doesn't error
            if "sslmode=require" in clean_url:
                clean_url = clean_url.replace("?sslmode=require", "").replace("&sslmode=require", "")
                connect_args["ssl"] = "require"
            elif "supabase" in clean_url or self.APP_ENV == "production":
                connect_args["ssl"] = "require"

        elif clean_url.startswith("sqlite"):
            connect_args["check_same_thread"] = False

        return clean_url, connect_args

    def validate_production_readiness(self) -> List[str]:
        """
        Validates production configuration safety.
        Returns a list of errors if configuration violates production security standards.
        """
        errors = []
        if self.APP_ENV == "production":
            # Security checks
            if self.active_secret_key == DEFAULT_DEV_SECRET:
                errors.append(
                    "SECRET_KEY is using the default development key. "
                    "A secure, randomly generated secret is required in production."
                )
            if len(self.active_secret_key) < 32:
                errors.append("SECRET_KEY must be at least 32 characters long in production.")

            # Storage checks
            if self.STORAGE_PROVIDER == "r2":
                if not self.R2_ACCESS_KEY_ID:
                    errors.append("R2_ACCESS_KEY_ID is required when STORAGE_PROVIDER=r2.")
                if not self.R2_SECRET_ACCESS_KEY:
                    errors.append("R2_SECRET_ACCESS_KEY is required when STORAGE_PROVIDER=r2.")
                if not self.resolved_r2_endpoint_url:
                    errors.append("R2_ACCOUNT_ID or R2_ENDPOINT_URL is required when STORAGE_PROVIDER=r2.")

            # Database check
            if "sqlite" in self.DATABASE_URL.lower():
                logger.warning(
                    "Production is configured with SQLite. "
                    "For cloud deployment on Render, configure Supabase PostgreSQL via DATABASE_URL."
                )

        return errors


try:
    settings = Settings()
    # Log any configuration warnings
    prod_errors = settings.validate_production_readiness()
    if prod_errors:
        for err in prod_errors:
            logger.error("Configuration Warning: %s", err)
except Exception as e:
    logger.error("Failed to load environment configuration: %s. Using default settings.", e)
    settings = Settings(_env_file=None)
