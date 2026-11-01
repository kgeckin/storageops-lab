# StorageOps Lab v2 architecture

## Two explicit telemetry planes

```text
                                     LOCAL MACHINE
         +---------------------+                          +-------------------------+
         | React + ECharts UI  |  Same-origin GET /api    | FastAPI backend         |
         | Nginx on :5173      | -----------------------> | on :8000               |
         +---------------------+                          +-----------+-------------+
                                                                     |
                              +--------------------------------------+-----------------+
                              |                                                        |
                   +----------v-------------+                                 +--------v----------+
                   | Synthetic storage      |                                 | Opt-in host        |
                   | simulator              |                                 | ingestion          |
                   | 3 fictional arrays     |                                 | per-host token     |
                   | history, alarms        |                                 | + SQLite 7d        |
                   +------------------------+                                 +--------^----------+
                                                                                       |
                                                                          POST /api/v1/hosts/ingest
                                                                          Bearer token via loopback
                                                                                       |
                                                                          +------------+-----------+
                                                                          | Windows Python agent   |
                                                                          | psutil CPU/RAM/disk/net|
                                                                          | Runs outside WSL       |
                                                                          +------------------------+
```

## Data provenance and boundaries

| Dataset | Source | Trust statement |
| --- | --- | --- |
| Block/file/object arrays | Deterministic Python simulator | Not measured on storage hardware |
| IOPS, latency, throughput | Mathematical simulation | Does not represent actual performance |
| Alert timeline | Threshold crossings derived from simulated snapshots | Not persisted incident tickets |
| Rack/topology | Illustrative device visualization | Does not represent real cabling |
| Host CPU/RAM/disk/network | Opt-in psutil agent on chosen OS | A reported local sample, not remote attestation |

## API overview

Existing simulation endpoints are preserved.

| Endpoint | Method | Meaning |
| --- | --- | --- |
| `/api/v1/overview` | GET | Synthetic fleet and current alerts |
| `/api/v1/arrays/{id}/history` | GET | Deterministic 15 minute snapshots |
| `/metrics` | GET | Synthetic Prometheus metrics |
| `/api/v1/hosts/ingest` | POST | Token-protected host submission |
| `/api/v1/hosts` | GET | Recently reporting, enrolled hosts |
| `/api/v1/hosts/{id}` | GET | Latest host sample |
| `/api/v1/hosts/{id}/history` | GET | Sample history (up to 288 points) |

All host IDs are assigned to registered bearer tokens. A token for one ID cannot submit readings under another host ID. Host read access, however, is not separately authenticated, so the server must remain local until identity and tenant authorization are added.

## Persistence

SQLite stores host metrics in `/data/hosts.sqlite3` in Docker's named `host-metrics` volume. Storage simulation is deliberately stateless. A seven-day expiry is applied on ingestion. Stopping Compose preserves the volume. `docker compose down -v` deletes the volume and its collected host history.

## Operational behavior

The agent is installed **on the machine to be observed**, not remotely deployed. The first lab uses native Windows Python with WSL/Docker serving a loopback API. Sample interval defaults to 30 seconds when continuous collection is enabled. A host is shown as stale when no new sample arrives for three minutes.

No SSH agent installation, network scanning, privilege escalation, command execution or automatic customer discovery is provided.

## Future authorized multi-host design

* A management service for explicitly approving and revoking host enrollments.
* HTTPS with certificate validation and mutual TLS for remote collection.
* A tenant-scoped identity layer for both ingestion and query access.
* Device identity proof, key rotation, fine-grained data collection permission.
* Rate limiting, API audit trails, storage retention controls and secured deployments.
* Generic plugins for documented vendor monitoring APIs, after permission review.

This future design is **not implemented or demonstrated** in v2.
