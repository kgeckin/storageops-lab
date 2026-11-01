# Host agent: collect your own machine metrics

This is a **manual, opt-in collector** for the machine where it is run. It reads high-level CPU, RAM, one disk volume and aggregate network byte counters using psutil. It never collects usernames, running processes, files, IP addresses, browser history or remote machines.

## Windows host, WSL + Docker backend

Your Docker backend runs inside WSL. To measure **Windows**, run this agent using **Windows Python and PowerShell**, not inside WSL. Running it in Ubuntu measures the WSL Linux instance instead.

1. Start the StorageOps API using Docker Compose as documented in [the project README](../README.md).
2. On the Windows host, open PowerShell in `storageops-lab/agent`.
3. Create and activate a Python environment and install psutil:

~~~powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
~~~

4. Set a unique agent identity and bearer token, matching a key in the repository root `.env` used by Docker Compose:

~~~powershell
$env:STORAGEOPS_AGENT_ID = "my-windows"
$env:STORAGEOPS_AGENT_TOKEN = "PASTE_THE_SAME_RANDOM_TOKEN"
$env:STORAGEOPS_API_URL = "http://127.0.0.1:8000"
~~~

5. Preview the locally collected data without transmitting it:

~~~powershell
python host_agent.py --dry-run
~~~

6. Send exactly one real reading as evidence:

~~~powershell
python host_agent.py --once
~~~

Expected: `Accepted host=my-windows at ... CPU=... RAM=...` and your real values at http://127.0.0.1:8000/api/v1/hosts.

7. For continuous readings during a lab session:

~~~powershell
python host_agent.py --interval 30
~~~

Stop with Ctrl+C. Do not put your bearer token in screenshots, Git commits or command history shared with others. PowerShell environment variables in this session are temporary.

### More computers

Each machine requires its owner's explicit authorization, its own separate token, a secure reachable API endpoint, and a reviewed multi-tenant access model. The current Docker Compose service is intentionally exposed on loopback only. **Do not open the backend to the internet or client networks to test additional machines.** The server can already register multiple host IDs, but authenticated viewing and secure remote transport must be implemented before use beyond a trusted local lab.

### Security boundaries

Tokens authorize **write-only telemetry submissions**, not remote command execution. All host metrics are stored in a local SQLite volume and automatically purged after seven days. The server uses receipt timestamps to determine whether a host is online or stale. Revoke a host by removing its token from the root .env registration and restarting the API.
