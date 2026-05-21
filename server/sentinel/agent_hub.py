"""WebSocket endpoint for inbound agent connections.

The agent (running in the user's docker-compose) opens a persistent WebSocket
to /agent/connect, authenticates with its workspace api_key, and then waits
for tool_call messages from the server.

app.state.agents: dict[workspace_id, WSConnection]
app.state.ws_events: dict[workspace_id, asyncio.Queue]  — for /workspaces/{id}/events SSE
"""
import asyncio
import json
import logging
import time
from dataclasses import dataclass, field

from fastapi import WebSocket, WebSocketDisconnect

from sentinel.db import (
    get_workspace_by_api_key,
    set_app_connected,
)

log = logging.getLogger(__name__)


@dataclass
class WSConnection:
    websocket: WebSocket
    workspace_id: int
    hostname: str
    connected_at: float = field(default_factory=time.time)
    # req_id → Future[dict] for pending tool calls
    pending: dict[str, asyncio.Future] = field(default_factory=dict)
    # run_id → IncidentChannel for event forwarding
    channels: dict[str, object] = field(default_factory=dict)

    async def send(self, msg: dict) -> None:
        await self.websocket.send_text(json.dumps(msg))

    def cancel_all(self) -> None:
        for fut in self.pending.values():
            if not fut.done():
                fut.set_exception(RuntimeError("agent disconnected"))
        self.pending.clear()


async def handle_agent_connection(websocket: WebSocket, app_state) -> None:
    """Called by the /agent/connect WebSocket route in main.py."""
    await websocket.accept()

    # Auth: require Authorization: Bearer wskey_...
    auth = websocket.headers.get("Authorization", "")
    if not auth.startswith("Bearer wskey_"):
        await websocket.send_text(json.dumps({"kind": "error", "message": "missing or invalid api_key"}))
        await websocket.close(code=4001)
        return

    api_key = auth.removeprefix("Bearer ")
    ws_row = get_workspace_by_api_key(app_state.db, api_key)
    if ws_row is None:
        await websocket.send_text(json.dumps({"kind": "error", "message": "api_key not found"}))
        await websocket.close(code=4003)
        return

    ws_id = ws_row["id"]

    # Wait for hello message to get hostname
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=10)
        hello = json.loads(raw)
        hostname = hello.get("hostname", "unknown")
    except Exception:
        hostname = "unknown"

    conn = WSConnection(websocket=websocket, workspace_id=ws_id, hostname=hostname)
    app_state.agents[ws_id] = conn
    set_app_connected(app_state.db, ws_id)

    # Notify the /workspaces/{id}/events SSE stream
    q: asyncio.Queue | None = app_state.ws_events.get(ws_id)
    if q:
        try:
            q.put_nowait({"kind": "agent_connected", "hostname": hostname, "workspace_id": ws_id})
        except asyncio.QueueFull:
            pass

    log.info("agent connected: workspace=%d hostname=%s", ws_id, hostname)

    try:
        async for raw in websocket.iter_text():
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            kind = msg.get("kind")

            if kind == "heartbeat":
                # Forward vitals to any running detector (Phase 5)
                detector = getattr(app_state, "detector", None)
                if detector:
                    await detector.on_heartbeat(ws_id, msg)

            elif kind == "tool_response":
                req_id = msg.get("req_id")
                fut = conn.pending.pop(req_id, None)
                if fut and not fut.done():
                    if "error" in msg:
                        fut.set_exception(RuntimeError(msg["error"]))
                    else:
                        fut.set_result(msg.get("result", {}))

            elif kind == "event":
                # Forward agent-emitted events to the relevant IncidentChannel
                run_id = msg.get("run_id")
                channel = conn.channels.get(run_id)
                if channel:
                    channel.emit(msg.get("phase", "detecting"), msg.get("type", "thought"), msg.get("payload", {}))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        log.warning("agent ws error workspace=%d: %s", ws_id, e)
    finally:
        conn.cancel_all()
        app_state.agents.pop(ws_id, None)
        log.info("agent disconnected: workspace=%d", ws_id)

        q = app_state.ws_events.get(ws_id)
        if q:
            try:
                q.put_nowait({"kind": "agent_disconnected", "workspace_id": ws_id})
            except asyncio.QueueFull:
                pass
