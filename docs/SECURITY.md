# Security and data boundaries

This is a synthetic observability project using fictional device names and simulated metrics. It does not connect to real Huawei systems, customer equipment or storage management environments.

## Current controls

* Read-only API endpoints with no administration operations.
* Local development CORS allowlist.
* Docker Compose ports published only on loopback by default.
* No storage API keys, personal data, employer configuration or customer information.
* All test fixtures use fictional arrays and stable timestamps.

## Production boundaries

Before any connection to live storage systems, review authorization, least privilege, TLS, audit logging, strict network allowlists, authentication, rate limiting, approved retention and a documented security architecture.

Vite environment variables are exposed to the browser. Never place any secret in a variable starting with VITE_.

This repository is a portfolio lab, not a production monitoring system. Its dependencies and Docker images should be pinned and reviewed before deploying to an operational environment.
