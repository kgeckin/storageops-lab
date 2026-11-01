# Security, authorization and privacy

## Lab posture

StorageOps Lab v2 is intended for **one trusted developer computer**. The simulation API and read-only host dashboard are accessible via Windows/WSL loopback ports only. Never change those bindings to public or private-network interfaces while testing with unprotected client data.

## Host authorization

Each configured host ID has its own random 32-byte-equivalent bearer token. A submission is accepted only if the secret matches the registered ID. Host names are **pseudonyms configured by the operator**, not automatically detected system identity.

The agent does not collect passwords, processes, open network ports, IP addresses, usernames, installed applications, file names or file content. It gathers overall CPU utilization, logical CPU count, memory usage, one filesystem's capacity, and aggregate bytes sent and received.

Do not run the collector on anyone else's computer or corporate systems without explicit authorization. The multi-host capability is a design foundation, not permission to monitor customers.

## Data security

* Backend listens on `127.0.0.1:8000` in Docker Compose.
* Browser dashboard listens on `127.0.0.1:5173`.
* Nginx proxies browser requests within the Docker network.
* API does not require elevated device privileges.
* Bearer token is supplied only through process environment variables.
* Tokens are never committed or displayed in application responses.
* Separate tokens per registered host can be revoked from the local configuration.
* SQLite host samples persist across container restarts and expire after seven days on subsequent ingestion.
* `docker compose down -v` permanently deletes the local volume.

## Limitations before real customer environments

There is no multi-tenant read authentication or secure remote enrollment. Loopback is the only deployment supported here. Additional protections required for production include TLS, backend authentication, scoped authorization, audited enrollment, secret rotation, tenant-level data isolation, input rate limiting, integrity verification, long-term storage architecture, backup, and explicit customer consent.

The client agent's measurement is **self-reported** and cannot prove hardware identity or detect agent tampering. A successful HTTP receipt establishes that a configured bearer token was accepted, not cryptographic system attestation.

## Responsible development

Do not paste secrets into Pull Requests, screenshots or support chats. Never publish generated `.env` or SQLite database files. Do not use live Huawei or customer credentials and do not interpret simulated performance as actual storage telemetry.
