import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from main import app
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_list_apps_empty(client):
    r = client.get("/apps")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_list_incidents_empty(client):
    r = client.get("/incidents")
    assert r.status_code == 200
    assert r.json() == []


def test_get_unknown_app(client):
    assert client.get("/apps/nonexistent").status_code == 404


def test_start_unknown_app(client):
    r = client.post("/incidents/start", json={"app": "nonexistent", "incident_id": "X"})
    assert r.status_code == 404
