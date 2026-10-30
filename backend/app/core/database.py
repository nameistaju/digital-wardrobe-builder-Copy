import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

logger = logging.getLogger(__name__)

# Resolve connection parameters (handles SQLite and Supabase PostgreSQL with asyncpg & SSL)
db_url, connect_args = settings.get_database_connection_params()

engine = create_async_engine(
    db_url,
    echo=False,
    future=True,
    connect_args=connect_args,
    # Configure connection pool safely for cloud and local
    pool_pre_ping=True,
    pool_recycle=300,
    pool_timeout=10,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that provides an asynchronous database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """
    Initializes database tables if they do not exist.
    Preserves all existing user records and tables without altering or dropping data.
    """
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database schema verified successfully.")
    except Exception as e:
        logger.error("Database schema initialization check failed: %s", e)
        # In production, do not crash immediately so health checks can report database state
        if settings.APP_ENV != "production":
            raise
