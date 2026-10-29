import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_auth_workflow():
    """Test user registration, login, and profile retrieval."""
    uid = uuid.uuid4().hex[:8]
    test_email = f"curator_{uid}@example.com"
    test_password = "securePassword123"

    # 1. Register user
    reg_response = client.post(
        "/api/v1/auth/register",
        json={"email": test_email, "password": test_password, "full_name": "Test Curator"},
    )
    assert reg_response.status_code == 201
    data = reg_response.json()
    assert "access_token" in data
    assert data["user"]["email"] == test_email

    token = data["access_token"]

    # 2. Duplicate registration rejected
    dup_response = client.post(
        "/api/v1/auth/register",
        json={"email": test_email, "password": "otherPassword"},
    )
    assert dup_response.status_code == 400

    # 3. Login with valid credentials
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": test_email, "password": test_password},
    )
    assert login_response.status_code == 200
    assert "access_token" in login_response.json()

    # 4. Login with invalid password
    bad_login = client.post(
        "/api/v1/auth/login",
        json={"email": test_email, "password": "wrongPassword"},
    )
    assert bad_login.status_code == 401

    # 5. Access protected /me endpoint with token
    me_response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["email"] == test_email

    # 6. Access protected /me without token fails
    unauth_response = client.get("/api/v1/auth/me")
    assert unauth_response.status_code == 401


def test_demo_login():
    """Test demo guest login endpoint."""
    response = client.post("/api/v1/auth/demo")
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "demo@wardrobe.app"
