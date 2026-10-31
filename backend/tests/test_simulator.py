"""Deterministic domain tests without hardware access."""

from datetime import datetime, timezone
import pytest
from storageops.simulator import ARRAYS, alerts, history, overview, snapshot

FIXED = datetime(2026, 11, 1, 12, 0, tzinfo=timezone.utc)


def test_snapshots_are_deterministic():
    assert snapshot(ARRAYS[0], FIXED) == snapshot(ARRAYS[0], FIXED)


def test_metrics_are_physically_bounded():
    for device in ARRAYS:
        s = snapshot(device, FIXED)
        assert 0 <= s["capacity"]["used_tb"] <= s["capacity"]["total_tb"]
        assert 0 <= s["capacity"]["utilization_pct"] <= 100
        assert s["performance"]["latency_ms"] > 0
        assert s["performance"]["iops"] >= 0


def test_history_has_ordered_timestamps():
    points = history(ARRAYS[0], 8, FIXED)
    assert len(points) == 8
    assert [p["at"] for p in points] == sorted(p["at"] for p in points)


@pytest.mark.parametrize("invalid", [0, 1, 97])
def test_history_rejects_out_of_range(invalid):
    with pytest.raises(ValueError):
        history(ARRAYS[0], invalid, FIXED)


def test_capacity_alert_is_explainable():
    issues = alerts(snapshot(ARRAYS[1], FIXED))
    assert any(item["type"] == "capacity" and "80%" in item["message"] for item in issues)


def test_overview_aggregates_total_capacity():
    d = overview(FIXED)
    assert d["simulation"] is True
    assert d["summary"]["array_count"] == 3
    assert d["summary"]["capacity_total_tb"] == 920
    assert d["summary"]["alert_count"] == len(d["alerts"])
