import asyncio
import pytest
from app.core.database import init_db


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Ensure database tables are initialized before running test suite."""
    asyncio.run(init_db())
    yield
