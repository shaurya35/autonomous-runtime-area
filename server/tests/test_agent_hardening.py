from types import SimpleNamespace

import pytest

from sentinel.agent import SentinelAgent
from sentinel.channel import IncidentChannel


class EndTurnClient:
    class messages:
        @staticmethod
        def create(**_kwargs):
            return SimpleNamespace(
                content=[SimpleNamespace(text="<phase>detecting</phase> done")],
                stop_reason="end_turn",
            )


@pytest.mark.asyncio
async def test_agent_returns_done_on_end_turn(tmp_path):
    channel = IncidentChannel("run-done", "SRE-X", tmp_path)
    agent = SentinelAgent([], channel)
    agent.client = EndTurnClient()

    result = await agent.run("brief", lambda _name, _args: {})

    events = channel.read_all()
    assert result["status"] == "done"
    assert result["phases_reached"] == ["detecting"]
    assert events[-1].phase == "done"
    assert events[-1].type == "summary"


@pytest.mark.asyncio
async def test_agent_emits_failed_on_max_iterations(tmp_path, monkeypatch):
    channel = IncidentChannel("run-max", "SRE-X", tmp_path)
    agent = SentinelAgent([], channel)
    agent.MAX_ITERATIONS = 0
    agent.client = EndTurnClient()

    result = await agent.run("brief", lambda _name, _args: {})

    events = channel.read_all()
    assert result["status"] == "failed"
    assert result["error"] == "max_iterations_exceeded"
    assert events[-1].phase == "failed"
    assert events[-1].payload["reason"] == "max_iterations_exceeded"


class FailingClient:
    class messages:
        @staticmethod
        def create(**_kwargs):
            raise RuntimeError("api down")


@pytest.mark.asyncio
async def test_agent_emits_failed_on_api_error(tmp_path):
    channel = IncidentChannel("run-api", "SRE-X", tmp_path)
    agent = SentinelAgent([], channel)
    agent.client = FailingClient()

    result = await agent.run("brief", lambda _name, _args: {})

    events = channel.read_all()
    assert result["status"] == "failed"
    assert result["error"] == "anthropic_request_failed"
    assert events[-1].phase == "failed"
    assert "anthropic request failed" in events[-1].payload["text"]
