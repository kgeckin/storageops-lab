"""Host telemetry API integration tests with isolated SQLite and no devices."""

import json
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from storageops.api import app

client = TestClient(app)
TOKEN = "safe-only-for-tests-0123456789abcdef"
PAYLOAD = {
    "host_id": "my-windows",
    "os_family": "Windows",
    "cpu_percent": 27.5,
    "cpu_count": 16,
    "memory_total_bytes": 16_000_000_000,
    "memory_used_bytes": 7_000_000_000,
    "disk_total_bytes": 500_000_000_000,
    "disk_used_bytes": 155_000_000_000,
    "network_sent_bytes": 1_200_000,
    "network_recv_bytes": 4_000_000,
}


@pytest.fixture(autouse=True)
def isolate_storage(monkeypatch, tmp_path):
    monkeypatch.setenv("STORAGEOPS_DB_PATH", str(tmp_path / "hosts.db"))
    monkeypatch.setenv("STORAGEOPS_AGENTS_JSON", json.dumps({"my-windows": TOKEN}))


def submit(payload=None, token=TOKEN):
    return client.post(
        "/api/v1/hosts/ingest",
        json=payload or PAYLOAD,
        headers={"Authorization": "Bearer " + token},
    )


def test_empty_fleet_before_first_sample():
    assert client.get("/api/v1/hosts").json() == []


def test_first_host_sample_and_history():
    r = submit()
    assert r.status_code == 202
    assert r.json()["accepted"] is True
    fleet = client.get("/api/v1/hosts").json()
    assert len(fleet) == 1
    assert fleet[0]["host_id"] == "my-windows"
    assert fleet[0]["memory"]["percent"] == 43.8
    history = client.get("/api/v1/hosts/my-windows/history").json()
    assert len(history["points"]) == 1
    assert history["points"][0]["cpu_percent"] == 27.5


def test_multiple_samples_have_monotonic_records():
    assert submit().status_code == 202
    p = dict(PAYLOAD, cpu_percent=49.4)
    assert submit(p).status_code == 202
    points = client.get("/api/v1/hosts/my-windows/history").json()["points"]
    assert [point["cpu_percent"] for point in points] == [27.5, 49.4]


def test_missing_or_invalid_token_rejected():
    assert client.post("/api/v1/hosts/ingest", json=PAYLOAD).status_code == 401
    assert submit(token="wrong-secret").status_code == 401
    assert client.get("/api/v1/hosts").json() == []


def test_host_cannot_impersonate_other_id(monkeypatch):
    monkeypatch.setenv(
        "STORAGEOPS_AGENTS_JSON",
        json.dumps({"my-windows": TOKEN, "second-pc": "another-test-token-012345678901234567"}),
    )
    assert submit(dict(PAYLOAD, host_id="second-pc")).status_code == 403


@pytest.mark.parametrize("invalid", [-1, 101, 999])
def test_cpu_out_of_bounds(invalid):
    assert submit(dict(PAYLOAD, cpu_percent=invalid)).status_code == 422


def test_used_memory_larger_than_total_rejected():
    assert submit(dict(PAYLOAD, memory_used_bytes=16_000_000_001)).status_code == 422


def test_unknown_host_cannot_be_read():
    assert client.get("/api/v1/hosts/unknown").status_code == 404


def test_history_points_validation():
    assert client.get("/api/v1/hosts/my-windows/history?points=1").status_code == 422
    assert client.get("/api/v1/hosts/my-windows/history?points=300").status_code == 422


def test_no_enrollment_means_no_ingestion(monkeypatch):
    monkeypatch.setenv("STORAGEOPS_AGENTS_JSON", "{}")
    assert submit().status_code == 503
    assert client.get("/api/v1/hosts").json() == []


def test_invalid_registration_is_error(monkeypatch):
    monkeypatch.setenv("STORAGEOPS_AGENTS_JSON", "{broken")
    with pytest.raises(RuntimeError):
        client.get("/api/v1/hosts")


def test_stale_host_status(monkeypatch):
    from storageops.hosts import _connect
    assert submit().status_code == 202
    old = (datetime.now(timezone.utc) - timedelta(minutes=6)).isoformat()
    with _connect() as con:
        con.execute("UPDATE host_samples SET received_at=?", (old,))
    body = client.get("/api/v1/hosts").json()
    assert body[0]["status"] == "stale"
