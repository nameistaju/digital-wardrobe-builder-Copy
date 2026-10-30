from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)


def test_health_check_endpoint():
    """Test that GET /api/v1/health returns 200 OK and expected JSON schema."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app"] == settings.PROJECT_NAME
    assert data["version"] == settings.VERSION
    assert "environment" in data


def test_root_endpoint():
    """Test root endpoint returns 200 OK with links to health and docs."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["app"] == settings.PROJECT_NAME
    assert data["health"] == "/api/v1/health"


def test_root_health_check_endpoint():
    """Test that lightweight GET /health returns 200 OK for cloud load balancers."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["app"] == settings.PROJECT_NAME
    assert "version" in data


def test_cors_headers():
    """Test that configured CORS origin headers and Vercel domains are permitted."""
    for origin in [
        settings.FRONTEND_ORIGIN,
        "https://digital-wardrobe-builder.vercel.app",
        "https://digital-wardrobe-builder-git-feature.vercel.app",
    ]:
        response = client.get(
            "/api/v1/health",
            headers={"Origin": origin},
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == origin
