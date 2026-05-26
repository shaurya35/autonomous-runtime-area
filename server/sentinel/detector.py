"""Anomaly detector for real workspace agents.

Runs a per-workspace state machine fed by heartbeat messages from
agent_hub.py. Trips when:
  - 3 consecutive health failures, OR
  - error_rate_pct > workspace.threshold sustained for SUSTAIN_SECONDS.

On trip, calls _create_incident(workspace_id) which mirrors the logic
in server/main.py start_incident() but routed through RemoteToolRouter.
"""
import asyncio
import logging
import time
from dataclasses import dataclass, field

log = logging.getLogger(__name__)

CONSEC_FAIL_THRESHOLD = 3
SUSTAIN_SECONDS = 30
COOLDOWN_SECONDS = 120  # don't re-trigger within 2 min of the last incident


@dataclass
class WorkspaceState:
    workspace_id: int
    consec_fails: int = 0
    high_error_since: float | None = None
    last_incident_at: float = 0.0


class AnomalyDetector:
    def __init__(self, app_state):
        self._app = app_state
        self._states: dict[int, WorkspaceState] = {}

    async def on_heartbeat(self, workspace_id: int, msg: dict) -> None:
        health = msg.get("health", {})
        vitals = msg.get("vitals", {})
        ok = health.get("ok", True)
        error_rate = vitals.get("http_requests_error_rate", None) or vitals.get("error_rate_pct", None) or 0.0

        state = self._states.setdefault(workspace_id, WorkspaceState(workspace_id))

        # Consecutive health-fail check
        if not ok:
            state.consec_fails += 1
        else:
            state.consec_fails = 0

        # Sustained high error rate check
        ws = self._app.db.execute(
            "SELECT threshold FROM workspaces WHERE id = ?", (workspace_id,)
        ).fetchone()
        threshold = dict(ws)["threshold"] if ws else 5.0

        if error_rate > threshold:
            state.high_error_since = state.high_error_since or time.time()
        else:
            state.high_error_since = None

        # Trip conditions
        consec_trip = state.consec_fails >= CONSEC_FAIL_THRESHOLD
        sustain_trip = (
            state.high_error_since is not None
            and (time.time() - state.high_error_since) >= SUSTAIN_SECONDS
        )

        if not (consec_trip or sustain_trip):
            return

        # Cooldown: don't spam incidents
        if time.time() - state.last_incident_at < COOLDOWN_SECONDS:
            return

        state.last_incident_at = time.time()
        state.consec_fails = 0
        state.high_error_since = None

        reason = (
            f"health failed {CONSEC_FAIL_THRESHOLD} times in a row"
            if consec_trip
            else f"error_rate > {threshold}% for {SUSTAIN_SECONDS}s"
        )
        log.info("anomaly detected workspace=%d: %s", workspace_id, reason)
        asyncio.create_task(self._create_incident(workspace_id, reason))

    async def _create_incident(self, workspace_id: int, reason: str) -> None:
        from sentinel.agent_hub import WSConnection
        from sentinel.remote_tools import RemoteToolRouter
        from sentinel.agent import SentinelAgent
        from sentinel.channel import IncidentChannel
        import uuid
        from pathlib import Path

        conn: WSConnection | None = self._app.agents.get(workspace_id)
        if conn is None:
            log.warning("detector tried to create incident but no agent for workspace=%d", workspace_id)
            return

        evidence_dir = getattr(self._app, "evidence_dir", Path(__file__).parent.parent / "evidence")
        run_id = str(uuid.uuid4())
        channel = IncidentChannel(run_id, "auto-detect", evidence_dir)
        conn.channels[run_id] = channel

        record = {
            "run_id": run_id,
            "workspace_id": workspace_id,
            "incident_id": "auto-detect",
            "status": "running",
            "started_at": time.time(),
            "trigger": reason,
        }
        self._app.incidents[run_id] = record

        ws_row = self._app.db.execute(
            "SELECT * FROM workspaces WHERE id = ?", (workspace_id,)
        ).fetchone()
        workspace = dict(ws_row) if ws_row else {"id": workspace_id, "fix_mode": "approve"}
        remote = RemoteToolRouter(
            conn=conn,
            workspace=workspace,
            channel=channel,
            db=self._app.db,
            patch_store=getattr(self._app, "patch_store", None),
        )
        agent = SentinelAgent(tools=remote.definitions(), channel=channel)
        brief = (
            f"AUTOMATIC INCIDENT DETECTED\n"
            f"Workspace: {workspace_id}\n"
            f"Trigger: {reason}\n"
            f"Investigate, diagnose, and propose a fix."
        )

        import traceback as tb
        try:
            result = await agent.run(brief, remote.execute)
            if result.get("status") == "failed":
                self._app.incidents[run_id].update({
                    "status": "failed",
                    "error": result.get("error", "agent_failed"),
                    "phases_reached": result.get("phases_reached", []),
                    "mttr_s": result.get("mttr_s", 0),
                })
                return
            phases = result.get("phases_reached", [])
            self._app.incidents[run_id].update({
                "status": "done",
                "phases_reached": phases,
                "mttr_s": result.get("mttr_s", 0),
            })
        except Exception as e:
            channel.emit("failed", "error", {
                "text": f"agent crashed: {type(e).__name__}: {e}",
                "traceback": tb.format_exc(),
            })
            self._app.incidents[run_id]["status"] = "failed"
            self._app.incidents[run_id]["error"] = str(e)
        finally:
            conn.channels.pop(run_id, None)
