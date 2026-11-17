from fastapi.testclient import TestClient
from app import app

def test_info():
    with TestClient(app) as client:
        response = client.get("/info")
        assert response.status_code == 200
        assert response.json()["service"] == "menu-api"
