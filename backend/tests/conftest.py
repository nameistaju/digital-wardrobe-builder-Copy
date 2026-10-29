import os
import asyncio
import pytest

# Ensure environment variables are set before any app module is imported
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_wardrobe.db"
os.environ["STORAGE_PROVIDER"] = "local"


def pytest_configure(config):
    os.environ["APP_ENV"] = "test"
    os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_wardrobe.db"
    os.environ["STORAGE_PROVIDER"] = "local"


from app.core.database import init_db


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Ensure database tables are initialized before running test suite."""
    asyncio.run(init_db())
    yield
