"""API contract tests without storage devices."""

from fastapi.testclient import TestClient
from storageops.api import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "mode": "simulation"}


def test_overview_contract():
    body = client.get("/api/v1/overview").json()
    assert body["simulation"] is True
    assert len(body["arrays"]) == 3
    assert "total_iops" in body["summary"]


def test_detail_and_missing_id():
    assert client.get("/api/v1/arrays/array-a").status_code == 200
    assert client.get("/api/v1/arrays/not-real").status_code == 404


def test_history_query_validation():
    assert len(client.get("/api/v1/arrays/array-a/history?points=7").json()["points"]) == 7
    assert client.get("/api/v1/arrays/array-a/history?points=1").status_code == 422
    assert client.get("/api/v1/arrays/array-a/history?points=97").status_code == 422


def test_prometheus_endpoint():
    r = client.get("/metrics")
    assert r.status_code == 200
    assert 'storageops_iops{array="array-a"}' in r.text
    assert "# TYPE storageops_latency_ms gauge" in r.text


def test_only_read_operations():
    assert client.post("/api/v1/arrays").status_code == 405
