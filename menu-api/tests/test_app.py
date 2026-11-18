from fastapi.testclient import TestClient
from app import app

def test_info():
    with TestClient(app) as client:
        response = client.get("/info")
        assert response.status_code == 200
        assert response.json()["service"] == "menu-api"

def test_info_metadata():
    with TestClient(app) as client:
        response = client.get("/info")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "endpoints" in data
        assert "/categories" in data["endpoints"]
