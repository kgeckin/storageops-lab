"""Read-only FastAPI endpoints for synthetic storage observability."""

from __future__ import annotations
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from .simulator import ARRAYS, alerts, get_array, history, overview, snapshot
from .hosts import router as host_router

app = FastAPI(
    title="StorageOps Lab",
    description="Synthetic storage telemetry for architecture and observability experiments.",
    version="0.1.0",
)
app.include_router(host_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET"],
    allow_headers=["Accept", "Content-Type"],
)


@app.get("/health", tags=["system"])
def health():
    return {"status": "ok", "mode": "simulation"}


@app.get("/api/v1/overview", tags=["observability"])
def get_overview():
    return overview()


@app.get("/api/v1/arrays", tags=["observability"])
def list_arrays():
    return [snapshot(device) for device in ARRAYS]


@app.get("/api/v1/arrays/{array_id}", tags=["observability"])
def array_detail(array_id: str):
    array = get_array(array_id)
    if array is None:
        raise HTTPException(status_code=404, detail="Unknown lab array")
    result = snapshot(array)
    result["alerts"] = alerts(result)
    return result


@app.get("/api/v1/arrays/{array_id}/history", tags=["observability"])
def array_history(array_id: str, points: int = Query(24, ge=2, le=96)):
    array = get_array(array_id)
    if array is None:
        raise HTTPException(status_code=404, detail="Unknown lab array")
    return {"array_id": array_id, "interval_minutes": 15, "points": history(array, points)}


@app.get("/api/v1/alerts", tags=["observability"])
def list_alerts():
    return overview()["alerts"]


@app.get("/metrics", response_class=PlainTextResponse, tags=["observability"])
def prometheus_metrics():
    lines = [
        "# HELP storageops_capacity_utilization_percent Synthetic capacity utilization percentage",
        "# TYPE storageops_capacity_utilization_percent gauge",
    ]
    current = [snapshot(device) for device in ARRAYS]
    for s in current:
        lines.append(f'storageops_capacity_utilization_percent{{array="{s["id"]}"}} {s["capacity"]["utilization_pct"]}')
    lines.extend([
        "# HELP storageops_iops Synthetic IO operations per second",
        "# TYPE storageops_iops gauge",
    ])
    for s in current:
        lines.append(f'storageops_iops{{array="{s["id"]}"}} {s["performance"]["iops"]}')
    lines.extend([
        "# HELP storageops_latency_ms Synthetic average latency in milliseconds",
        "# TYPE storageops_latency_ms gauge",
    ])
    for s in current:
        lines.append(f'storageops_latency_ms{{array="{s["id"]}"}} {s["performance"]["latency_ms"]}')
    return "\n".join(lines) + "\n"
