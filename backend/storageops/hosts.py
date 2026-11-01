"""Opt-in host telemetry API.

Only a device with a separately configured bearer token can submit samples.
The server assigns host identity from token registration. No discovery, SSH,
remote execution, process collection, or disk file reading is implemented.
"""

from __future__ import annotations

import json
import os
import re
import secrets
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock

from fastapi import APIRouter, Header, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator

router = APIRouter(prefix="/api/v1/hosts", tags=["host-telemetry"])
_DB_LOCK = Lock()
_HOST_ID_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.]{0,63}$")


class HostSample(BaseModel):
    host_id: str = Field(min_length=1, max_length=64)
    os_family: str = Field(pattern=r"^(Windows|Linux|Darwin)$")
    cpu_percent: float = Field(ge=0, le=100)
    memory_total_bytes: int = Field(gt=0)
    memory_used_bytes: int = Field(ge=0)
    disk_total_bytes: int = Field(gt=0)
    disk_used_bytes: int = Field(ge=0)
    network_sent_bytes: int = Field(ge=0)
    network_recv_bytes: int = Field(ge=0)
    cpu_count: int = Field(ge=1, le=1024)

    @model_validator(mode="after")
    def validate_usage(self):
        if self.memory_used_bytes > self.memory_total_bytes:
            raise ValueError("memory used cannot exceed total")
        if self.disk_used_bytes > self.disk_total_bytes:
            raise ValueError("disk used cannot exceed total")
        if not _HOST_ID_PATTERN.fullmatch(self.host_id):
            raise ValueError("invalid host id")
        return self


def _registration() -> dict[str, str]:
    raw = os.getenv("STORAGEOPS_AGENTS_JSON", "{}")
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("STORAGEOPS_AGENTS_JSON is not valid JSON") from exc
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise RuntimeError("STORAGEOPS_AGENTS_JSON must be an object")
    if any(
        not isinstance(k, str) or not _HOST_ID_PATTERN.fullmatch(k)
        or not isinstance(v, str) or len(v) < 24
        for k, v in value.items()
    ):
        raise RuntimeError("Each host must have a valid ID and a random token of 24+ characters")
    if len(set(value.values())) != len(value):
        raise RuntimeError("Agent tokens must be unique")
    return value


def _database_path() -> Path:
    return Path(os.getenv("STORAGEOPS_DB_PATH", "/tmp/storageops_telemetry.sqlite3"))


def _connect() -> sqlite3.Connection:
    path = _database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 10000")
    conn.execute(
        """CREATE TABLE IF NOT EXISTS host_samples (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          host_id TEXT NOT NULL,
          received_at TEXT NOT NULL,
          os_family TEXT NOT NULL,
          cpu_percent REAL NOT NULL,
          cpu_count INTEGER NOT NULL,
          memory_total_bytes INTEGER NOT NULL,
          memory_used_bytes INTEGER NOT NULL,
          disk_total_bytes INTEGER NOT NULL,
          disk_used_bytes INTEGER NOT NULL,
          network_sent_bytes INTEGER NOT NULL,
          network_recv_bytes INTEGER NOT NULL
        )"""
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_host_samples_host_time ON host_samples(host_id, id)"
    )
    return conn


def _authorized_host(authorization: str | None) -> str:
    configured = _registration()
    if not configured:
        raise HTTPException(status_code=503, detail="No host agents enrolled. Configure local tokens first.")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Agent bearer token required")
    token = authorization[7:]
    found = None
    for host_id, secret in configured.items():
        if secrets.compare_digest(token, secret):
            found = host_id
    if found is None:
        raise HTTPException(status_code=401, detail="Invalid agent token")
    return found


def _view(row: sqlite3.Row) -> dict:
    data = dict(row)
    return {
        "host_id": data["host_id"],
        "received_at": data["received_at"],
        "os_family": data["os_family"],
        "cpu_percent": round(data["cpu_percent"], 1),
        "cpu_count": data["cpu_count"],
        "memory": {
            "total_bytes": data["memory_total_bytes"],
            "used_bytes": data["memory_used_bytes"],
            "percent": round(data["memory_used_bytes"] * 100 / data["memory_total_bytes"], 1),
        },
        "disk": {
            "total_bytes": data["disk_total_bytes"],
            "used_bytes": data["disk_used_bytes"],
            "percent": round(data["disk_used_bytes"] * 100 / data["disk_total_bytes"], 1),
        },
        "network": {
            "sent_bytes": data["network_sent_bytes"],
            "received_bytes": data["network_recv_bytes"],
        },
    }


@router.post("/ingest", status_code=202)
def ingest(sample: HostSample, authorization: str | None = Header(default=None)):
    """Accept only data from explicitly enrolled hosts. Identity is token bound."""
    permitted_id = _authorized_host(authorization)
    if sample.host_id != permitted_id:
        raise HTTPException(status_code=403, detail="Token is assigned to another host")
    moment = datetime.now(timezone.utc).isoformat()
    with _DB_LOCK:
        with closing(_connect()) as conn:
          with conn:
            conn.execute(
                """INSERT INTO host_samples (
                  host_id, received_at, os_family, cpu_percent, cpu_count,
                  memory_total_bytes, memory_used_bytes, disk_total_bytes,
                  disk_used_bytes, network_sent_bytes, network_recv_bytes
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    permitted_id, moment, sample.os_family, sample.cpu_percent, sample.cpu_count,
                    sample.memory_total_bytes, sample.memory_used_bytes,
                    sample.disk_total_bytes, sample.disk_used_bytes,
                    sample.network_sent_bytes, sample.network_recv_bytes,
                ),
            )
            cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            conn.execute("DELETE FROM host_samples WHERE received_at < ?", (cutoff,))
    return {"accepted": True, "host_id": permitted_id, "received_at": moment}


def _host_rows(limit: int = 60, host_id: str | None = None) -> list[sqlite3.Row]:
    with closing(_connect()) as conn:
        if host_id is None:
            rows = conn.execute(
                """SELECT s.* FROM host_samples s
                   JOIN (SELECT host_id, MAX(id) latest FROM host_samples GROUP BY host_id) last
                   ON s.id = last.latest ORDER BY s.host_id"""
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM host_samples WHERE host_id=? ORDER BY id DESC LIMIT ?",
                (host_id, limit),
            ).fetchall()
    return rows


def _annotate(item: dict) -> dict:
    age = (datetime.now(timezone.utc) -
           datetime.fromisoformat(item["received_at"])).total_seconds()
    return {**item, "status": "online" if age <= 180 else "stale", "age_seconds": max(0, int(age))}


@router.get("")
def list_hosts():
    """List only enrolled, reporting hosts; includes clear last-seen status."""
    registered = set(_registration())
    return [_annotate(_view(r)) for r in _host_rows() if r["host_id"] in registered]


@router.get("/{host_id}")
def host_detail(host_id: str):
    if host_id not in _registration():
        raise HTTPException(status_code=404, detail="Unknown enrolled host")
    rows = _host_rows(1, host_id)
    if not rows:
        raise HTTPException(status_code=404, detail="No telemetry received from this host")
    return _annotate(_view(rows[0]))


@router.get("/{host_id}/history")
def host_history(host_id: str, points: int = Query(60, ge=2, le=288)):
    if host_id not in _registration():
        raise HTTPException(status_code=404, detail="Unknown enrolled host")
    rows = _host_rows(points, host_id)
    return {"host_id": host_id, "points": [_view(row) for row in reversed(rows)]}
