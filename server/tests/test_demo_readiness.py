import asyncio
import json
from types import SimpleNamespace

import pytest

from sentinel.remote_tools import RemoteToolRouter
from sentinel.seed import DemoSeeder


class FakeConnection:
    def __init__(self, result=None):
        self.pending = {}
        self.sent = []
        self.result = result or {"success": True}

    async def send(self, msg):
        self.sent.append(msg)
        if msg["kind"] in ("apply_patch", "write_file"):
            self.pending[msg["req_id"]].set_result(self.result)


class FakePatchStore:
    def create(self, diff_id):
        fut = asyncio.get_event_loop().create_future()
        fut.set_result({"approved": True})
        return fut


def test_demo_seed_writes_channel_events(tmp_path):
    run_id = DemoSeeder().seed(tmp_path / "evidence", tmp_path / "results", tmp_path / "apps")
    event_file = tmp_path / "evidence" / f"{run_id}.jsonl"
    result_file = tmp_path / "results" / f"{run_id}.json"

    first = json.loads(event_file.read_text().splitlines()[0])
    result = json.loads(result_file.read_text())

    assert first["run_id"] == run_id
    assert first["incident_id"] == "SRE-0001"
    assert first["type"] == "thought"
    assert "payload" in first
    assert result["status"] == "done"


@pytest.mark.asyncio
async def test_approved_patch_correlates_apply_response_by_req_id(tmp_path):
    conn = FakeConnection()
    db = SimpleNamespace(
        execute=lambda *args, **kwargs: None,
        commit=lambda: None,
    )

    import sentinel.db as db_mod

    original_insert = db_mod.insert_pending_patch
    original_update = db_mod.update_patch_status
    db_mod.insert_pending_patch = lambda *args, **kwargs: "diff-1"
    db_mod.update_patch_status = lambda *args, **kwargs: None
    try:
        router = RemoteToolRouter(
            conn=conn,
            workspace={"id": 1, "fix_mode": "approve"},
            channel=SimpleNamespace(run_id="run-1", emit=lambda *args, **kwargs: None),
            db=db,
            patch_store=FakePatchStore(),
        )

        result = await router.execute(
            "propose_patch",
            {"file": "src/main.rs", "unified_diff": "--- a\n+++ b\n"},
        )
    finally:
        db_mod.insert_pending_patch = original_insert
        db_mod.update_patch_status = original_update

    apply_msg = next(msg for msg in conn.sent if msg["kind"] == "apply_patch")
    assert apply_msg["diff_id"] == "diff-1"
    assert apply_msg["req_id"] != "diff-1"
    assert result == {"success": True}


@pytest.mark.asyncio
async def test_approved_write_file_routes_as_write_file(tmp_path):
    conn = FakeConnection()
    db = SimpleNamespace(
        execute=lambda *args, **kwargs: None,
        commit=lambda: None,
    )

    import sentinel.db as db_mod

    original_insert = db_mod.insert_pending_patch
    original_update = db_mod.update_patch_status
    db_mod.insert_pending_patch = lambda *args, **kwargs: "diff-write"
    db_mod.update_patch_status = lambda *args, **kwargs: None
    try:
        router = RemoteToolRouter(
            conn=conn,
            workspace={"id": 1, "fix_mode": "approve"},
            channel=SimpleNamespace(run_id="run-1", emit=lambda *args, **kwargs: None),
            db=db,
            patch_store=FakePatchStore(),
        )

        result = await router.execute(
            "write_file",
            {"file": "src/main.rs", "content": "new content\n"},
        )
    finally:
        db_mod.insert_pending_patch = original_insert
        db_mod.update_patch_status = original_update

    write_msg = next(msg for msg in conn.sent if msg["kind"] == "write_file")
    assert write_msg["diff_id"] == "diff-write"
    assert write_msg["content"] == "new content\n"
    assert result == {"success": True}


@pytest.mark.asyncio
async def test_failed_approved_patch_marks_failed_status(tmp_path):
    conn = FakeConnection(result={"success": False, "error": "bad patch"})
    db = SimpleNamespace(
        execute=lambda *args, **kwargs: None,
        commit=lambda: None,
    )
    statuses = []

    import sentinel.db as db_mod

    original_insert = db_mod.insert_pending_patch
    original_update = db_mod.update_patch_status
    db_mod.insert_pending_patch = lambda *args, **kwargs: "diff-fail"
    db_mod.update_patch_status = lambda _db, _diff_id, status: statuses.append(status)
    try:
        router = RemoteToolRouter(
            conn=conn,
            workspace={"id": 1, "fix_mode": "approve"},
            channel=SimpleNamespace(run_id="run-1", emit=lambda *args, **kwargs: None),
            db=db,
            patch_store=FakePatchStore(),
        )

        result = await router.execute(
            "propose_patch",
            {"file": "src/main.rs", "unified_diff": "--- a\n+++ b\n"},
        )
    finally:
        db_mod.insert_pending_patch = original_insert
        db_mod.update_patch_status = original_update

    assert result == {"success": False, "error": "bad patch"}
    assert statuses == ["applying", "failed"]
