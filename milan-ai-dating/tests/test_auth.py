"""
Milan AI - Authentication Tests
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.database import Base, get_db
from app.core.security import get_password_hash
from app.db.models import User

# Create test database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
Base.metadata.create_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture
def test_user():
    return {
        "email": "test@example.com",
        "password": "TestPassword123",
        "first_name": "Test User",
        "date_of_birth": "1995-01-01",
        "gender": "male"
    }


def test_register_user(test_user):
    """Test user registration"""
    response = client.post("/api/v1/auth/register", json=test_user)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_login_user(test_user):
    """Test user login"""
    # First register
    client.post("/api/v1/auth/register", json=test_user)
    
    # Then login
    response = client.post(
        "/api/v1/auth/login",
        data={"username": test_user["email"], "password": test_user["password"]}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


def test_login_invalid_credentials():
    """Test login with invalid credentials"""
    response = client.post(
        "/api/v1/auth/login",
        data={"username": "invalid@example.com", "password": "wrongpassword"}
    )
    assert response.status_code == 401


def test_get_current_user(test_user):
    """Test getting current user"""
    # Register and login
    register_response = client.post("/api/v1/auth/register", json=test_user)
    token = register_response.json()["access_token"]
    
    # Get current user
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_user["email"]
