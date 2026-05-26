"""RemoteToolRouter — same interface as ToolRegistry but executes via WebSocket.

The server's Claude loop calls remote.execute(name, args) just as it does for
the local ToolRegistry. Underneath, this sends a tool_call message over the
agent's WebSocket and awaits the tool_response future.

Usage:
    conn = app.state.agents[workspace_id]       # WSConnection from agent_hub
    remote = RemoteToolRouter(conn, timeout=60)
    agent = SentinelAgent(tools=remote.definitions(), channel=channel)
    await agent.run(brief, remote.execute)
"""
import asyncio
import uuid

from sentinel.agent_hub import WSConnection
from sentinel.tools import ToolRegistry


# Static tool definitions (same as local registry — both sides share schema)
_TOOL_DEFS: list[dict] | None = None


def _get_tool_defs() -> list[dict]:
    global _TOOL_DEFS
    if _TOOL_DEFS is None:
        from sentinel.tools.signals import SignalTools
        from sentinel.tools.code import CodeTools
        from sentinel.tools.exec import ExecTools
        from sentinel.tools.patch import PatchTools
        from pathlib import Path
        from sentinel.adapters.health.http import HttpHealthProbe
        from sentinel.adapters.logs.process import ProcessLogSource
        from sentinel.adapters.metrics.prometheus import PrometheusMetricSource
        from sentinel.adapters.runtime.local import LocalRuntime

        # Minimal stubs just to extract definitions — never called
        log_src = ProcessLogSource(health_url="http://localhost")
        metric_src = PrometheusMetricSource(url="http://localhost/metrics")
        health = HttpHealthProbe(url="http://localhost/health")
        runtime = LocalRuntime(app_dir=Path("/tmp"))
        root = Path("/tmp")

        defs = []
        for cls in (SignalTools, CodeTools, ExecTools, PatchTools):
            if cls == SignalTools:
                obj = cls(log_src, metric_src, health)
            elif cls == CodeTools:
                obj = cls(root)
            elif cls == ExecTools:
                obj = cls(runtime, {"commands": {"test": "echo"}})
            else:
                obj = cls(runtime, root)
            defs.extend(obj.definitions())
        _TOOL_DEFS = defs
    return _TOOL_DEFS


class RemoteToolRouter:
    def __init__(
        self,
        conn: WSConnection,
        timeout: float = 60,
        workspace: dict | None = None,
        channel=None,
        db=None,
        patch_store=None,
    ):
        self._conn = conn
        self._timeout = timeout
        self._workspace = workspace or {}
        self._channel = channel
        self._db = db
        self._patch_store = patch_store

    def definitions(self) -> list[dict]:
        return _get_tool_defs()

    async def execute(self, name: str, args: dict) -> dict:
        # Intercept propose_patch in approve mode before routing to agent
        if name in ("propose_patch", "write_file") and self._workspace.get("fix_mode") == "approve":
            return await self._pending_patch(name, args)
        return await self._remote_call(name, args)

    async def _remote_call(self, name: str, args: dict) -> dict:
        req_id = uuid.uuid4().hex
        loop = asyncio.get_event_loop()
        fut: asyncio.Future = loop.create_future()
        self._conn.pending[req_id] = fut

        try:
            await self._conn.send({"kind": "tool_call", "req_id": req_id, "tool_name": name, "args": args})
            return await asyncio.wait_for(fut, timeout=self._timeout)
        except asyncio.TimeoutError:
            self._conn.pending.pop(req_id, None)
            return {"error": f"tool '{name}' timed out after {self._timeout}s (agent may be hung)"}
        except RuntimeError as e:
            self._conn.pending.pop(req_id, None)
            return {"error": str(e)}

    async def _pending_patch(self, name: str, args: dict) -> dict:
        """Hold the patch for user approval before applying."""
        from sentinel.db import insert_pending_patch, update_patch_status

        file = args.get("file", "")
        diff = args.get("unified_diff") or args.get("content", "")
        ws_id = self._workspace.get("id", 0)
        run_id = self._channel.run_id if self._channel else "unknown"

        diff_id = insert_pending_patch(self._db, run_id, ws_id, file, diff)

        # Emit the pending_approval event so the dashboard shows the card
        if self._channel:
            self._channel.emit("fixing", "pending_approval", {
                "diff_id": diff_id,
                "file": file,
                "diff": diff,
                "tool": name,
            })

        # Create and await the approval future
        fut = self._patch_store.create(diff_id)
        try:
            result = await asyncio.wait_for(fut, timeout=300)  # 5 min approval window
        except asyncio.TimeoutError:
            update_patch_status(self._db, diff_id, "timeout")
            return {"error": "patch approval timed out (5 min limit)"}

        if result.get("rejected"):
            update_patch_status(self._db, diff_id, "rejected")
            return {"error": "patch rejected by user", "rejected": True}

        # User approved — send the exact write operation to the agent and wait for confirmation.
        update_patch_status(self._db, diff_id, "applying")
        req_id = uuid.uuid4().hex
        loop = asyncio.get_event_loop()
        apply_fut: asyncio.Future = loop.create_future()
        self._conn.pending[req_id] = apply_fut
        if name == "write_file":
            await self._conn.send({
                "kind": "write_file",
                "diff_id": diff_id,
                "req_id": req_id,
                "file": file,
                "content": diff,
            })
        else:
            await self._conn.send({
                "kind": "apply_patch",
                "diff_id": diff_id,
                "req_id": req_id,
                "file": file,
                "diff": diff,
            })

        try:
            apply_result = await asyncio.wait_for(apply_fut, timeout=self._timeout)
            update_patch_status(
                self._db,
                diff_id,
                "applied" if apply_result.get("success") else "failed",
            )
            return apply_result
        except asyncio.TimeoutError:
            self._conn.pending.pop(req_id, None)
            update_patch_status(self._db, diff_id, "timeout")
            return {"error": "agent timed out applying the patch"}
        except RuntimeError as e:
            self._conn.pending.pop(req_id, None)
            update_patch_status(self._db, diff_id, "failed")
            return {"error": str(e)}
