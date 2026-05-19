import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "fixtures/sample-app"))


@pytest.fixture
def client():
    from app import app as flask_app, _metrics
    flask_app.config["TESTING"] = True
    _metrics["http_requests_total"].clear()
    _metrics["errors_total"] = 0
    _metrics["divide_calls_total"] = 0
    with flask_app.test_client() as c:
        yield c


def test_index(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.get_json()["status"] == "ok"


def test_healthz(client):
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.get_json()["status"] == "ok"


def test_divide_ok(client):
    r = client.get("/divide?a=10&b=2")
    assert r.status_code == 200
    assert r.get_json()["result"] == 5.0


def test_divide_by_zero_is_bug(client):
    r = client.get("/divide?a=10&b=0")
    assert r.status_code == 500
    assert "error" in r.get_json()


def test_metrics_endpoint(client):
    client.get("/")
    r = client.get("/metrics")
    assert r.status_code == 200
    assert "http_requests_total" in r.data.decode()
    assert "errors_total" in r.data.decode()


def test_metrics_increments_on_error(client):
    from app import _metrics
    before = _metrics["errors_total"]
    client.get("/divide?a=10&b=0")
    assert _metrics["errors_total"] > before
