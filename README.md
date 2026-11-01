<div align="center">

<img src="docs/assets/cover.svg" width="100%" alt="StorageOps Lab infrastructure observability project" />

# StorageOps Lab

**A premium infrastructure observability workbench with simulated storage arrays and opt-in real host telemetry.**

[Quick start](#quick-start) · [Prove your own Windows metrics](#prove-your-own-windows-metrics) · [Architecture](docs/ARCHITECTURE.md) · [Design system](docs/DESIGN_SYSTEM.md)

</div>

## Overview

StorageOps Lab has two clearly separated data sources. **Synthetic storage arrays** demonstrate capacity, throughput, IOPS, latency, topology and alert policies. **Real host telemetry** is collected only when an authorized user explicitly runs a small Python agent on their own Windows, Linux or macOS system.

The dashboard contains interactive, responsive pages for Overview, Storage Arrays, Host Telemetry, Performance and Incidents. It provides capacity rings, gradient time-series charts, sparklines, comparison bars, an intensity heatmap, threshold observations, a topology view, search, CSV export, refresh controls and dark/light appearance.

## Quick start

**Prerequisites:** WSL 2 + Ubuntu, Docker Desktop using the WSL 2 engine, and Docker Compose. On your Ubuntu terminal:

```bash
cd ~/projects/storageops-lab
git switch main
git pull origin main
docker compose up --build -d
docker compose ps
```

This reads from `main` **after the v2 Pull Request has been merged**. To preview before merging, use:

```bash
git fetch origin
git switch feat/observability-v2-host-agent
docker compose up --build -d
docker compose ps
```

Your local browser endpoints:

* **Dashboard:** http://127.0.0.1:5173
* **API docs:** http://127.0.0.1:8000/docs
* **API health:** http://127.0.0.1:8000/health

Both services bind to the computer's loopback interface. The dashboard talks to the API using an Nginx same-origin proxy in Docker. You do not need a real agent to explore the synthetic lab.

## Prove your own Windows metrics

This section measures **your real Windows computer**. WSL is a separate Linux environment, so do **not** run the agent inside Ubuntu if your intent is to measure Windows CPU and RAM.

### Step 1. Generate a separate random enrollment token

In the Ubuntu terminal at the repository root:

```bash
python3 -c 'import secrets; print(secrets.token_urlsafe(32))'
```

Copy the generated value privately. Do not share it in screenshots, GitHub or chat.

### Step 2. Configure the local API

Still in Ubuntu:

```bash
cp .env.example .env
nano .env
```

Change the token placeholder to your generated value:

```text
STORAGEOPS_AGENTS_JSON={"my-windows":"YOUR_UNIQUE_RANDOM_TOKEN"}
```

Save and close. Your `.env` is ignored by Git. Restrict access with `chmod 600 .env`. Restart the API to load its token registrations:

```bash
docker compose up --build -d
docker compose config --quiet
```

**Do not paste the full Docker Compose configuration into a public chat**, because rendered environment values may include your token.

### Step 3. Copy the agent to Windows

Run in **Windows PowerShell**, not Ubuntu:

```powershell
$agentDir = Join-Path $env:USERPROFILE "storageops-agent"
New-Item -ItemType Directory -Force -Path $agentDir | Out-Null
Copy-Item "\\wsl.localhost\Ubuntu\home\kgeckin\projects\storageops-lab\agent\*" $agentDir -Recurse -Force
Set-Location $agentDir
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

If your Ubuntu username or WSL distribution is different, adjust the UNC path. Alternatively copy the `agent/` folder using Windows File Explorer at `\\wsl.localhost\Ubuntu\home\kgeckin\projects\storageops-lab`.

### Step 4. Make one real reading

In the same Windows PowerShell window:

```powershell
$env:STORAGEOPS_AGENT_ID = "my-windows"
$secret = Read-Host "Paste your agent token" -AsSecureString
$env:STORAGEOPS_AGENT_TOKEN = [System.Net.NetworkCredential]::new("", $secret).Password
Remove-Variable secret
$env:STORAGEOPS_API_URL = "http://127.0.0.1:8000"

.\.venv\Scripts\python.exe host_agent.py --dry-run
.\.venv\Scripts\python.exe host_agent.py --once
```

The dry run shows local measurements without sending them. The once command submits them and should print `Accepted host=my-windows at ...`. A successful receipt means the local API accepted a sample from your configured agent, not that the server cryptographically verified the hardware identity.

### Step 5. Verify in the dashboard

Open **Host Telemetry** at http://127.0.0.1:5173. Your `my-windows` host should appear with CPU, memory, disk and network counters. You can independently confirm the JSON via http://127.0.0.1:8000/api/v1/hosts.

For a historical chart, run the agent continuously in Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe host_agent.py --interval 30
```

Stop with **Ctrl+C**. The online indicator becomes *stale* after three minutes without data.

**Do not send your token, full `.env`, or private system screenshots.** A screenshot of the Host Telemetry page with the token hidden is enough to demonstrate your own device measurement.

## Repository structure

```text
storageops-lab/
├── agent/
│   ├── host_agent.py           # Explicit local Windows/Linux/macOS collector
│   ├── requirements.txt
│   └── README.md
├── backend/
│   ├── storageops/
│   │   ├── api.py              # FastAPI simulator and metrics endpoints
│   │   ├── hosts.py            # Token authorization and SQLite host samples
│   │   └── simulator.py        # Synthetic device trends
│   ├── tests/
│   └── Dockerfile
├── frontend/
│   ├── src/main.jsx            # React application state and five views
│   ├── src/charts.js           # Reusable ECharts option generators
│   ├── src/components.jsx      # Shared dashboard controls and panels
│   ├── src/styles.css          # Dark and light themes
│   ├── nginx.conf              # Same-origin API proxy
│   ├── vite.config.js          # Development API proxy
│   └── Dockerfile
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DESIGN_SYSTEM.md
│   └── SECURITY.md
├── .env.example
├── docker-compose.yml
└── README.md
```

## Validation

```bash
cd backend
python -m pip install -r requirements-dev.txt
python -m pytest -q tests
```

For frontend:

```bash
cd frontend
npm install
npm run build
```

GitHub Actions checks run independently. A passing backend unit test does not prove Windows agent integration. The **end-to-end demonstration on your Windows computer** must be confirmed with the commands above. Other peoples' devices have not been tested or accessed.

## Architecture and privacy

Read [Architecture](docs/ARCHITECTURE.md), [Design System](docs/DESIGN_SYSTEM.md) and [Security](docs/SECURITY.md).

Agent registration supports a separate token per approved host, but the current server has **no user-login or customer-isolated dashboard**. It is restricted to local development. Do not publish the API to a LAN, customer network or the internet. Before any remote deployment, implement TLS, tenant-scoped authorization, secure enrollment and permission review.

Host samples are stored in a persistent local SQLite volume with seven-day retention. The collector does not inspect file contents, users, process lists, local IPs, remote devices, or secrets.

## License

No project license has been selected. Permission to reuse code is not implied.
