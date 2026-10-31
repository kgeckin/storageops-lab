"""Reproducible simulated storage metrics. No hardware connection."""

from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import cos, pi, sin


@dataclass(frozen=True)
class StorageArray:
    id: str
    name: str
    workload: str
    total_tb: float
    base_used_tb: float
    base_iops: int
    base_latency_ms: float
    base_throughput_mbps: int
    phase: float


ARRAYS: tuple[StorageArray, ...] = (
    StorageArray("array-a", "Atlas A", "Block · All Flash", 240, 155, 58000, 0.75, 4300, 0.2),
    StorageArray("array-b", "Atlas B", "File · Hybrid", 180, 147, 18000, 4.4, 1900, 1.1),
    StorageArray("array-c", "Atlas C", "Object · Capacity", 500, 323, 7200, 2.9, 1200, 2.2),
)


def utc_time(value: datetime | None = None) -> datetime:
    now = value or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("Metric time must be timezone aware.")
    return now.astimezone(timezone.utc)


def snapshot(array: StorageArray, at: datetime | None = None) -> dict:
    """Return bounded synthetic metrics at a point in time."""
    time = utc_time(at)
    minute = time.timestamp() / 60
    wave = sin(2 * pi * minute / 180 + array.phase)
    load = 1 + 0.23 * wave + 0.06 * cos(2 * pi * minute / 43 + array.phase)
    load = max(0.4, min(1.4, load))
    used = array.base_used_tb + 0.5 * sin(2 * pi * minute / 1440 + array.phase)
    used = min(array.total_tb, max(0.0, used))
    latency = max(0.08, array.base_latency_ms * (0.82 + 0.26 * load))
    return {
        "id": array.id,
        "name": array.name,
        "workload": array.workload,
        "at": time.isoformat().replace("+00:00", "Z"),
        "capacity": {
            "used_tb": round(used, 2),
            "total_tb": array.total_tb,
            "utilization_pct": round(100 * used / array.total_tb, 1),
        },
        "performance": {
            "iops": int(array.base_iops * load),
            "latency_ms": round(latency, 2),
            "throughput_mbps": round(array.base_throughput_mbps * load, 1),
        },
    }


def history(array: StorageArray, points: int = 24, at: datetime | None = None) -> list[dict]:
    if points < 2 or points > 96:
        raise ValueError("points must be between 2 and 96")
    time = utc_time(at)
    return [snapshot(array, time - timedelta(minutes=15 * (points - i - 1))) for i in range(points)]


def alerts(snapshot_data: dict) -> list[dict]:
    ident = snapshot_data["id"]
    capacity = snapshot_data["capacity"]["utilization_pct"]
    latency = snapshot_data["performance"]["latency_ms"]
    issues: list[dict] = []
    if capacity >= 80:
        issues.append({
            "id": f"{ident}-capacity",
            "array_id": ident,
            "severity": "warning" if capacity < 90 else "critical",
            "type": "capacity",
            "message": f"Capacity utilization is {capacity:.1f}% (threshold: 80%).",
        })
    if latency >= 5:
        issues.append({
            "id": f"{ident}-latency",
            "array_id": ident,
            "severity": "warning" if latency < 8 else "critical",
            "type": "latency",
            "message": f"Latency is {latency:.2f} ms (threshold: 5 ms).",
        })
    return issues


def get_array(array_id: str) -> StorageArray | None:
    return next((a for a in ARRAYS if a.id == array_id), None)


def overview(at: datetime | None = None) -> dict:
    snapshots = [snapshot(a, at) for a in ARRAYS]
    all_alerts = [item for sample in snapshots for item in alerts(sample)]
    used = sum(s["capacity"]["used_tb"] for s in snapshots)
    total = sum(s["capacity"]["total_tb"] for s in snapshots)
    return {
        "simulation": True,
        "arrays": snapshots,
        "summary": {
            "array_count": len(snapshots),
            "capacity_used_tb": round(used, 2),
            "capacity_total_tb": round(total, 2),
            "utilization_pct": round(100 * used / total, 1),
            "total_iops": sum(s["performance"]["iops"] for s in snapshots),
            "alert_count": len(all_alerts),
        },
        "alerts": all_alerts,
    }
