import pytest
from pathlib import Path
from sentinel.channel import IncidentChannel, ChannelEvent


@pytest.fixture
def channel(tmp_path):
    return IncidentChannel("test-run", "TEST-0001", tmp_path)


def test_emit_writes_jsonl(channel, tmp_path):
    channel.emit("detecting", "thought", {"text": "checking logs"})
    lines = (tmp_path / "test-run.jsonl").read_text().strip().splitlines()
    assert len(lines) == 1
    ev = ChannelEvent.model_validate_json(lines[0])
    assert ev.phase == "detecting"


def test_read_all_roundtrip(channel):
    channel.emit("detecting", "thought", {"text": "a"})
    channel.emit("diagnosing", "tool_call", {"tool": "read_logs", "input": {}})
    events = channel.read_all()
    assert len(events) == 2
    assert events[0].phase == "detecting"
    assert events[1].phase == "diagnosing"


def test_read_all_empty(tmp_path):
    ch = IncidentChannel("no-run", "NO-0001", tmp_path)
    assert ch.read_all() == []


@pytest.mark.asyncio
async def test_subscribe_yields_events(channel):
    channel.emit("detecting", "thought", {"text": "x"})
    channel.emit("done", "summary", {"phases_reached": ["detecting"]})
    events = []
    async for ev in channel.subscribe():
        events.append(ev)
    assert events[-1].phase == "done"
