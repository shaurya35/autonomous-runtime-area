"""End-to-end test for the existing demo loop.

Boots the FastAPI app in-process and runs a full incident: inject SRE-0001,
agent diagnoses + patches, scoring records a non-zero score.

Requires ANTHROPIC_API_KEY in the environment AND the bundled shop-api running
on http://localhost:8080 (cd apps/rust && cargo run). Skipped otherwise.
"""
import asyncio
import os

import httpx
import pytest


pytestmark = pytest.mark.e2e


def _shop_api_up() -> bool:
    try:
        r = httpx.get("http://localhost:8080/healthz", timeout=1.0)
        return r.status_code == 200
    except Exception:
        return False


@pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY"),
    reason="needs ANTHROPIC_API_KEY",
)
@pytest.mark.skipif(
    not _shop_api_up(),
    reason="shop-api not running on :8080 (cd apps/rust && cargo run)",
)
async def test_full_loop_sre_0001():
    # Let the real preflight run for this test.
    os.environ.pop("SENTINEL_SKIP_PREFLIGHT", None)

    from main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # Sanity
        r = await client.get("/health")
        assert r.status_code == 200

        r = await client.post(
            "/incidents/start",
            json={"app": "shop-api", "incident_id": "SRE-0001"},
        )
        assert r.status_code == 200, r.text
        run_id = r.json()["run_id"]

        # Poll until terminal (ceiling 90s)
        deadline = asyncio.get_event_loop().time() + 90
        record = None
        while asyncio.get_event_loop().time() < deadline:
            r = await client.get(f"/incidents/{run_id}")
            record = r.json()
            if record.get("status") in ("done", "failed"):
                break
            await asyncio.sleep(1.0)

        assert record is not None
        assert record["status"] == "done", f"run failed: {record}"
        assert record.get("score", 0) > 0
        phases = record.get("phases_reached", [])
        assert "detecting" in phases
        assert "diagnosing" in phases
