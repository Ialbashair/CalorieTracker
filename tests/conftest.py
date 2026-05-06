import sys
from pathlib import Path

import pytest
import mongomock
from fastapi.testclient import TestClient

# Add the project root folder to Python's import path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

import main


@pytest.fixture(autouse=True)
def mock_database(monkeypatch):
    """
    Replaces the real MongoDB collections with fake in-memory collections.
    This keeps tests from touching the real Nutri database.
    """
    test_client = mongomock.MongoClient()
    test_db = test_client["Nutri_Test"]

    monkeypatch.setattr(main, "users_collection", test_db["User_Info"])
    monkeypatch.setattr(main, "foods_collection", test_db["Foods"])
    monkeypatch.setattr(main, "food_logs_collection", test_db["Food_logs"])
    monkeypatch.setattr(main, "food_logs_archive_collection", test_db["Food_logs_archive"])
    monkeypatch.setattr(main, "exercises_collection", test_db["Exercises"])
    monkeypatch.setattr(main, "exercise_logs_collection", test_db["Exercise_logs"])
    monkeypatch.setattr(main, "exercise_logs_archive_collection", test_db["Exercise_logs_archive"])
    monkeypatch.setattr(main, "posts_collection", test_db["Posts"])
    monkeypatch.setattr(main, "water_logs_collection", test_db["Water_logs"])
    monkeypatch.setattr(main, "water_logs_archive_collection", test_db["Water_logs_archive"])

    main.settings.secret_key = "test-secret-key"

    yield


@pytest.fixture
def client():
    return TestClient(main.app)


@pytest.fixture
def auth_headers(client):
    """
    Creates a normal user and returns Authorization headers for that user.
    """
    client.post("/register", json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123"
    })

    response = client.post("/login", json={
        "email": "test@example.com",
        "password": "password123"
    })

    token = response.json()["access_token"]

    return {
        "Authorization": f"Bearer {token}"
    }


@pytest.fixture
def admin_headers(client):
    """
    Creates an admin user directly in the fake database and returns admin auth headers.
    """
    hashed_password = main.hash_password("adminpass123")

    main.users_collection.insert_one({
        "username": "adminuser",
        "email": "admin@example.com",
        "password": hashed_password,
        "role": "admin",
        "created_at": main.datetime.now(main.timezone.utc)
    })

    response = client.post("/login", json={
        "email": "admin@example.com",
        "password": "adminpass123"
    })

    token = response.json()["access_token"]

    return {
        "Authorization": f"Bearer {token}"
    }