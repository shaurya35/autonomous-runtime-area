import asyncio
import time
from pathlib import Path
from typing import Literal
from pydantic import BaseModel


Phase = Literal["detecting", "diagnosing", "fixing", "verifying", "done", "failed"]


class ChannelEvent(BaseModel):
    ts: float
    run_id: str
    incident_id: str
    phase: Phase
    type: Literal["thought", "tool_call", "tool_result", "score", "summary"]
    payload: dict


class IncidentChannel:
    def __init__(self, run_id: str, incident_id: str, evidence_dir: Path):
        self.run_id = run_id
        self.incident_id = incident_id
        self._path = evidence_dir / f"{run_id}.jsonl"
        self._queue: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self._phase: Phase = "detecting"
        evidence_dir.mkdir(parents=True, exist_ok=True)

    def emit(self, phase: Phase, event_type: str, payload: dict) -> ChannelEvent:
        self._phase = phase
        event = ChannelEvent(
            ts=time.time(), run_id=self.run_id, incident_id=self.incident_id,
            phase=phase, type=event_type, payload=payload,
        )
        with open(self._path, "a") as f:
            f.write(event.model_dump_json() + "\n")
        try:
            self._queue.put_nowait(event)
        except asyncio.QueueFull:
            pass
        return event

    async def subscribe(self):
        """Async generator of ChannelEvents for SSE streaming."""
        while True:
            event = await self._queue.get()
            yield event
            if event.phase in ("done", "failed"):
                break

    def read_all(self) -> list[ChannelEvent]:
        if not self._path.exists():
            return []
        events = []
        with open(self._path) as f:
            for line in f:
                line = line.strip()
                if line:
                    events.append(ChannelEvent.model_validate_json(line))
        return events
