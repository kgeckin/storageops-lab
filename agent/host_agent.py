"""Explicitly opt-in Windows, Linux, or macOS host telemetry collector.

Install/run on the machine being monitored. Does not require administrator
privileges and never reads private files, process lists, usernames or passwords.
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import re
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import psutil


def sample(host_id: str, disk_path: str | None = None) -> dict:
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.]{0,63}", host_id):
        raise ValueError("Host ID must contain only letters, numbers, underscore and dot.")
    system = platform.system()
    if system not in ("Windows", "Linux", "Darwin"):
        raise ValueError("Unsupported operating system.")
    target = disk_path or (Path.home().anchor if system == "Windows" else "/")
    disk = psutil.disk_usage(str(target))
    memory = psutil.virtual_memory()
    network = psutil.net_io_counters()
    if network is None:
        raise RuntimeError("Network counters unavailable on this machine.")
    return {
        "host_id": host_id,
        "os_family": system,
        "cpu_percent": psutil.cpu_percent(interval=0.25),
        "cpu_count": psutil.cpu_count(logical=True) or 1,
        "memory_total_bytes": memory.total,
        "memory_used_bytes": memory.used,
        "disk_total_bytes": disk.total,
        "disk_used_bytes": disk.used,
        "network_sent_bytes": network.bytes_sent,
        "network_recv_bytes": network.bytes_recv,
    }


def send(payload: dict, base_url: str, token: str, timeout: int = 10) -> dict:
    # Never send credentials in a URL, and restrict plaintext HTTP to local loopback.
    if not base_url.startswith(("http://127.0.0.1:", "http://localhost:", "https://")):
        raise ValueError("Only local HTTP or HTTPS endpoints are supported.")
    if not token or len(token) < 24:
        raise ValueError("Set a secure STORAGEOPS_AGENT_TOKEN with 24 or more characters.")
    req = Request(
        base_url.rstrip("/") + "/api/v1/hosts/ingest",
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token,
        },
    )
    with urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Send consent-based host metrics to StorageOps Lab.")
    parser.add_argument("--once", action="store_true", help="Send one reading and exit.")
    parser.add_argument("--dry-run", action="store_true", help="Print one local reading without sending.")
    parser.add_argument("--interval", type=int, default=30, help="Polling seconds, minimum 10.")
    args = parser.parse_args()

    host_id = os.getenv("STORAGEOPS_AGENT_ID", "my-windows")
    token = os.getenv("STORAGEOPS_AGENT_TOKEN", "")
    url = os.getenv("STORAGEOPS_API_URL", "http://127.0.0.1:8000")
    disk_path = os.getenv("STORAGEOPS_DISK_PATH")

    if args.interval < 10:
        parser.error("--interval must be at least 10 seconds")
    try:
        while True:
            data = sample(host_id, disk_path)
            if args.dry_run:
                print(json.dumps(data, indent=2))
                return 0
            result = send(data, url, token)
            print(
                f"Accepted host={result['host_id']} at {result['received_at']} "
                f"CPU={data['cpu_percent']:.1f}% RAM={data['memory_used_bytes'] / data['memory_total_bytes'] * 100:.1f}%",
                flush=True,
            )
            if args.once:
                return 0
            time.sleep(args.interval)
    except (ValueError, OSError, HTTPError, URLError, RuntimeError, KeyError) as exc:
        # Avoid printing request headers or bearer tokens.
        if isinstance(exc, HTTPError):
            print(f"Collection rejected: HTTP {exc.code}. Check enrolled ID and token.", file=sys.stderr)
        else:
            print(f"Collection failed: {type(exc).__name__}. Check local setup and API availability.", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("Host agent stopped.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
