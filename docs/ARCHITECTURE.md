# Architecture and design decisions

## Scope

StorageOps Lab is a fully synthetic, read-only observability simulator. It does not connect to or manage real storage arrays.

~~~text
React / Vite dashboard
        |
        | HTTP GET /api/v1
        v
FastAPI backend
        |
        v
Deterministic metric simulator
        |
        +--> /metrics (Prometheus format)
        +--> capacity and latency alerts
~~~

## API contracts

| Endpoint | Purpose |
| --- | --- |
| GET /health | Simulator health |
| GET /api/v1/overview | Aggregate summary and alarms |
| GET /api/v1/arrays | Device snapshots |
| GET /api/v1/arrays/{id} | Per-device metrics and alarms |
| GET /api/v1/arrays/{id}/history?points=24 | Historical points at 15-minute intervals |
| GET /api/v1/alerts | Current threshold alarms |
| GET /metrics | Prometheus-style gauge metrics |

## Domain model

Three fictional storage arrays each define total capacity, baseline usage, baseline IOPS, latency, throughput and a time phase. Deterministic sine and cosine waves simulate fluctuations. Values are rounded and bounded. Capacity at or above 80 percent and latency at or above 5 ms generate alerts.

The values are designed for UI, API and alert testing and are **not physically validated workload measurements**.

## Design decisions

* Separate deterministic domain simulation from HTTP handlers.
* Keep interfaces read-only, with no customer network access.
* Use explicit timestamps in unit test fixtures.
* Keep a minimal Prometheus exposition endpoint.
* Favor replaceable layers suitable for future infrastructure architecture labs.

## Next iterations

1. Design generic collector interfaces and synthetic JSON import.
2. Add Prometheus and Grafana in an isolated lab.
3. Version alert policies and configuration schemas.
4. Introduce time-series persistence and retention controls.
5. Consider vendor APIs only with documented approval and read-only credentials. Do not publish employer configurations, internal IPs or customer data.
