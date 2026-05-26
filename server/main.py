import asyncio
import json
import logging
import os
import shutil
import subprocess
import time
import traceback
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from dotenv import load_dotenv

# Load .env from repo root (two levels up from server/), then fall back to
# server/.env. existing shell exports take priority (override=False).
_repo_root = Path(__file__).parent.parent
load_dotenv(_repo_root / ".env", override=False)
load_dotenv(Path(__file__).parent / ".env", override=False)

from fastapi import FastAPI, HTTPException, Query, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from sentinel.vitals import VitalSimulator, VitalCollector
from sentinel.agent import SentinelAgent
from sentinel.channel import IncidentChannel
from sentinel.adapters.factory import make_log_source, make_metric_source, make_health_probe, make_runtime
from sentinel.tools import ToolRegistry
from sentinel.db import init_db, get_workspace_by_id
from sentinel.routes.auth import router as auth_router, require_user
from sentinel.routes.workspaces import router as workspaces_router
from sentinel.agent_hub import handle_agent_connection
from sentinel.remote_tools import RemoteToolRouter
from sentinel.detector import AnomalyDetector
from sentinel.pending_patch import PendingPatchStore
from srebench.schema import AppManifest, load_incident, load_manifest
from srebench.injector import Injector
from srebench.scorer import Scorer, IncidentResult

REPO_ROOT    = Path(os.getenv("REPO_ROOT", Path(__file__).parent.parent))
APPS_DIR     = Path(os.getenv("APPS_DIR", REPO_ROOT / "apps"))
EVIDENCE_DIR = Path(os.getenv("EVIDENCE_DIR", Path(__file__).parent / "evidence"))
RESULTS_DIR  = Path(os.getenv("RESULTS_DIR", Path(__file__).parent / "results"))


def _discover_apps() -> tuple[dict[str, AppManifest], dict[str, Path]]:
    apps: dict[str, AppManifest] = {}
    app_dirs: dict[str, Path] = {}
    if not APPS_DIR.exists():
        return apps, app_dirs
    for p in APPS_DIR.iterdir():
        manifest_file = p / "srebench.yaml"
        if manifest_file.exists():
            try:
                manifest = load_manifest(p)
                apps[manifest.name] = manifest
                app_dirs[manifest.name] = p
            except Exception:
                continue
    return apps, app_dirs


log = logging.getLogger("sentinel.boot")


def _preflight() -> None:
    """Fail fast on missing prerequisites. Runs in lifespan before serving."""
    if os.getenv("SENTINEL_SKIP_PREFLIGHT") == "1":
        return
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise RuntimeError(
            "ANTHROPIC_API_KEY not set. Copy .env.example to .env and fill it in, "
            "or export ANTHROPIC_API_KEY in your shell before starting the server."
        )
    if shutil.which("docker"):
        try:
            r = subprocess.run(
                ["docker", "info"], capture_output=True, timeout=5, check=False,
            )
            if r.returncode != 0:
                log.warning(
                    "docker CLI is present but `docker info` failed; "
                    "runtime will fall back to LocalRuntime which cannot run the bundled shop-api. "
                    "Stderr: %s",
                    r.stderr.decode(errors="replace").strip(),
                )
        except Exception as e:
            log.warning("docker preflight check raised %s: %s", type(e).__name__, e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _preflight()
    app.state.db = init_db()
    app.state.apps, app.state.app_dirs = _discover_apps()
    app.state.vital_sims = {name: VitalSimulator(name) for name in app.state.apps}
    app.state.vital_collector = VitalCollector(app.state.vital_sims, app.state.apps)
    app.state.vital_collector.start()
    app.state.incidents: dict[str, dict] = {}
    app.state.agents: dict[int, object] = {}        # workspace_id → WSConnection (Phase 3)
    app.state.ws_events: dict[int, asyncio.Queue] = {}  # workspace_id → event queue
    app.state.detector = AnomalyDetector(app.state)
    app.state.patch_store = PendingPatchStore()
    app.state.evidence_dir = EVIDENCE_DIR
    app.state.results_dir = RESULTS_DIR
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    for _result_file in sorted(RESULTS_DIR.glob("*.json")):
        try:
            _data = json.loads(_result_file.read_text())
            _run_id = _data.get("run_id") or _result_file.stem
            if _run_id not in app.state.incidents:
                app.state.incidents[_run_id] = _data
        except Exception:
            pass
    yield
    app.state.vital_collector.stop()
    app.state.db.close()


app = FastAPI(title="SREBench Server", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)
app.include_router(auth_router)
app.include_router(workspaces_router)


@app.websocket("/agent/connect")
async def agent_connect(websocket: WebSocket):
    await handle_agent_connection(websocket, app.state)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/apps")
def list_apps():
    return [
        {"name": name, "language": m.language}
        for name, m in app.state.apps.items()
    ]


@app.get("/apps/{name}")
def get_app(name: str):
    if name not in app.state.apps:
        raise HTTPException(404, f"App '{name}' not found")
    return app.state.apps[name].model_dump()


@app.get("/apps/{name}/health")
def app_health(name: str):
    if name not in app.state.apps:
        raise HTTPException(404, f"App '{name}' not found")
    return {"app": name, "status": "unknown", "message": "App health not monitored in sim mode"}


@app.get("/apps/{name}/logs")
def app_logs(name: str, lines: int = 50):
    if name not in app.state.apps:
        raise HTTPException(404, f"App '{name}' not found")
    return {"app": name, "logs": []}


@app.get("/apps/{name}/metrics")
def app_metrics(name: str):
    if name not in app.state.apps:
        raise HTTPException(404, f"App '{name}' not found")
    return app.state.vital_sims[name].sample(time.time())


@app.get("/apps/{name}/incidents")
def list_app_incidents(name: str):
    if name not in app.state.apps:
        raise HTTPException(404, f"App '{name}' not found")
    incidents_dir = app.state.app_dirs[name] / "incidents"
    if not incidents_dir.exists():
        return []
    out = []
    for p in sorted(incidents_dir.glob("*.yaml")):
        try:
            inc = load_incident(p)
            agent_sees = getattr(inc, "agent_sees", None)
            out.append({
                "id": inc.id,
                "title": inc.title,
                "difficulty": inc.difficulty,
                "category": inc.category,
                "alert": getattr(agent_sees, "alert", None),
                "symptoms": getattr(agent_sees, "symptoms", []) or [],
            })
        except Exception:
            continue
    return out


@app.get("/apps/{name}/vitals")
def app_vitals(
    name: str,
    since: int = Query(60, ge=1, le=3600),
    simulate: bool = Query(False),
):
    if name not in app.state.apps:
        raise HTTPException(404, f"App '{name}' not found")
    sim = app.state.vital_sims[name]
    now = time.time()
    start = now - since
    samples_raw = [sim.sample(start + i) for i in range(since)]
    keys = ("req_per_sec", "p99_latency_ms", "error_rate_pct", "cpu_pct")
    vitals = {k: [s[k] for s in samples_raw] for k in keys}
    return {"ts_end": round(now, 1), "samples_per_second": 1, "vitals": vitals}


@app.get("/apps/{name}/vitals/stream")
async def app_vitals_stream(name: str):
    if name not in app.state.apps:
        raise HTTPException(404, f"App '{name}' not found")
    sim = app.state.vital_sims[name]

    async def generator() -> AsyncIterator[dict]:
        while True:
            yield {"data": json.dumps(sim.sample(time.time()))}
            await asyncio.sleep(1)

    return EventSourceResponse(generator())


class IncidentRefBody(BaseModel):
    incident_id: str


@app.post("/apps/{name}/inject")
def inject(name: str, body: IncidentRefBody):
    if name not in app.state.apps:
        raise HTTPException(404, f"App '{name}' not found")
    app.state.vital_sims[name].injected = True
    return {"applied": True, "incident_id": body.incident_id}


@app.post("/apps/{name}/heal")
def heal(name: str, body: IncidentRefBody):
    if name not in app.state.apps:
        raise HTTPException(404, f"App '{name}' not found")
    app.state.vital_sims[name].injected = False
    return {"healed": True}


class StartIncidentBody(BaseModel):
    app: str
    incident_id: str


@app.post("/incidents/start")
async def start_incident(body: StartIncidentBody):
    if body.app not in app.state.apps:
        raise HTTPException(404, f"App '{body.app}' not found")

    incident_path = app.state.app_dirs[body.app] / "incidents" / f"{body.incident_id}.yaml"
    if not incident_path.exists():
        raise HTTPException(404, f"Incident spec '{body.incident_id}' not found for app '{body.app}'")

    run_id = str(uuid.uuid4())
    record = {
        "run_id": run_id,
        "app": body.app,
        "incident_id": body.incident_id,
        "status": "running",
        "started_at": time.time(),
    }
    app.state.incidents[run_id] = record

    manifest = app.state.apps[body.app]
    spec = load_incident(incident_path)
    channel = IncidentChannel(run_id, body.incident_id, EVIDENCE_DIR)
    manifest_dict = manifest.model_dump()
    log_source = make_log_source(manifest_dict["signals"])
    metric_source = make_metric_source(manifest_dict["signals"])
    health_probe = make_health_probe(manifest_dict["signals"])
    runtime = make_runtime(manifest_dict, REPO_ROOT)
    registry = ToolRegistry(manifest_dict, log_source, metric_source, health_probe, runtime, REPO_ROOT)
    agent = SentinelAgent(tools=registry.definitions(), channel=channel)

    brief = (
        f"INCIDENT: {spec.id} — {spec.title}\n"
        f"App: {body.app} ({manifest.language})\n"
        f"Alert: {spec.agent_sees.alert}\n"
        f"Symptoms:\n" + "\n".join(f"  - {s}" for s in spec.agent_sees.symptoms)
    )

    injector = Injector(manifest, REPO_ROOT)

    async def run_agent():
        try:
            await injector.inject(spec)
        except Exception as e:
            channel.emit("failed", "error", {
                "text": f"inject failed: {type(e).__name__}: {e}",
                "traceback": traceback.format_exc(),
            })
            app.state.incidents[run_id]["status"] = "failed"
            app.state.incidents[run_id]["error"] = f"inject failed: {e}"
            return
        try:
            result = await agent.run(brief, registry.execute)
            if result.get("status") == "failed":
                app.state.incidents[run_id].update({
                    "status": "failed",
                    "error": result.get("error", "agent_failed"),
                    "mttr_s": result.get("mttr_s", 0),
                    "phases_reached": result.get("phases_reached", []),
                })
                return
            scorer = Scorer()
            phases = result.get("phases_reached", [])
            post_ok = await scorer.run_tests(spec.post_fix_tests) if spec.post_fix_tests else False
            incident_result = IncidentResult(
                run_id=run_id,
                incident_id=body.incident_id,
                detected="detecting" in phases,
                diagnosed="diagnosing" in phases,
                fixed=post_ok,
                mttr_s=result.get("mttr_s", 0),
                phases_reached=phases,
                post_tests_passed=post_ok,
            )
            incident_result.score = scorer.score(incident_result)
            final = {**record, "status": "done", **incident_result.model_dump()}
            app.state.incidents[run_id].update({"status": "done", "score": incident_result.score,
                                                 "mttr_s": incident_result.mttr_s,
                                                 "phases_reached": phases})
            (RESULTS_DIR / f"{run_id}.json").write_text(json.dumps(final))
        except Exception as e:
            channel.emit("failed", "error", {
                "text": f"agent crashed: {type(e).__name__}: {e}",
                "traceback": traceback.format_exc(),
            })
            app.state.incidents[run_id]["status"] = "failed"
            app.state.incidents[run_id]["error"] = str(e)
        finally:
            try:
                await injector.reset(spec)
            except Exception as e:
                channel.emit("failed", "error", {
                    "text": f"reset failed: {type(e).__name__}: {e}",
                })

    asyncio.create_task(run_agent())
    return record


@app.post("/workspaces/{ws_id}/incidents/start")
async def start_workspace_incident(ws_id: int, body: StartIncidentBody, request: Request):
    """Start an incident against a real workspace's connected agent."""
    user = require_user(request)
    db = request.app.state.db
    ws = get_workspace_by_id(db, ws_id)
    if not ws or ws["user_id"] != user["id"]:
        raise HTTPException(404, "Workspace not found.")

    conn = app.state.agents.get(ws_id)
    if conn is None:
        raise HTTPException(503, "No agent connected for this workspace. "
                                 "Start the Sentinel sidecar (docker compose up sentinel-agent).")

    run_id = str(uuid.uuid4())
    record = {
        "run_id": run_id,
        "workspace_id": ws_id,
        "incident_id": body.incident_id,
        "status": "running",
        "started_at": time.time(),
    }
    app.state.incidents[run_id] = record
    channel = IncidentChannel(run_id, body.incident_id, EVIDENCE_DIR)
    conn.channels[run_id] = channel

    remote = RemoteToolRouter(
        conn=conn,
        workspace=dict(ws),
        channel=channel,
        db=app.state.db,
        patch_store=app.state.patch_store,
    )
    agent = SentinelAgent(tools=remote.definitions(), channel=channel)
    brief = f"INCIDENT: {body.incident_id}\nWorkspace: {ws_id}\n{body.app or ''}"

    async def run_ws_agent():
        try:
            result = await agent.run(brief, remote.execute)
            if result.get("status") == "failed":
                app.state.incidents[run_id].update({
                    "status": "failed",
                    "error": result.get("error", "agent_failed"),
                    "phases_reached": result.get("phases_reached", []),
                    "mttr_s": result.get("mttr_s", 0),
                })
                return
            phases = result.get("phases_reached", [])
            app.state.incidents[run_id].update({
                "status": "done",
                "phases_reached": phases,
                "mttr_s": result.get("mttr_s", 0),
            })
        except Exception as e:
            channel.emit("failed", "error", {
                "text": f"agent crashed: {type(e).__name__}: {e}",
                "traceback": traceback.format_exc(),
            })
            app.state.incidents[run_id]["status"] = "failed"
            app.state.incidents[run_id]["error"] = str(e)
        finally:
            conn.channels.pop(run_id, None)

    asyncio.create_task(run_ws_agent())
    return record


@app.post("/workspaces/{ws_id}/incidents/{run_id}/approve")
async def approve_patch(ws_id: int, run_id: str, request: Request):
    user = require_user(request)
    db = request.app.state.db
    ws = get_workspace_by_id(db, ws_id)
    if not ws or ws["user_id"] != user["id"]:
        raise HTTPException(404, "Workspace not found.")
    # Find the pending diff for this run
    row = db.execute(
        "SELECT diff_id FROM pending_patches WHERE run_id = ? AND status = 'pending'",
        (run_id,),
    ).fetchone()
    if not row:
        raise HTTPException(404, "No pending patch found for this run.")
    diff_id = row["diff_id"]
    resolved = app.state.patch_store.resolve(diff_id, {"approved": True})
    if not resolved:
        raise HTTPException(409, "Patch was already resolved.")
    return {"approved": True, "diff_id": diff_id}


@app.post("/workspaces/{ws_id}/incidents/{run_id}/reject")
async def reject_patch(ws_id: int, run_id: str, request: Request):
    user = require_user(request)
    db = request.app.state.db
    ws = get_workspace_by_id(db, ws_id)
    if not ws or ws["user_id"] != user["id"]:
        raise HTTPException(404, "Workspace not found.")
    row = db.execute(
        "SELECT diff_id FROM pending_patches WHERE run_id = ? AND status = 'pending'",
        (run_id,),
    ).fetchone()
    if not row:
        raise HTTPException(404, "No pending patch found for this run.")
    diff_id = row["diff_id"]
    resolved = app.state.patch_store.reject(diff_id)
    if not resolved:
        raise HTTPException(409, "Patch was already resolved.")
    return {"rejected": True, "diff_id": diff_id}


@app.get("/incidents")
def list_incidents():
    return list(app.state.incidents.values())


@app.get("/incidents/{run_id}")
def get_incident(run_id: str):
    if run_id not in app.state.incidents:
        result_file = RESULTS_DIR / f"{run_id}.json"
        if result_file.exists():
            try:
                return json.loads(result_file.read_text())
            except Exception:
                pass
    if run_id not in app.state.incidents:
        raise HTTPException(404, f"Run '{run_id}' not found")
    return app.state.incidents[run_id]


@app.get("/incidents/{run_id}/report")
async def download_report(run_id: str):
    from fastapi.responses import Response as FastAPIResponse
    from sentinel.report import generate_report_pdf

    # Resolve run from memory or disk
    run_data = app.state.incidents.get(run_id)
    if run_data is None:
        result_file = RESULTS_DIR / f"{run_id}.json"
        if result_file.exists():
            try:
                run_data = json.loads(result_file.read_text())
            except Exception:
                pass
    if run_data is None:
        raise HTTPException(404, f"Run '{run_id}' not found")
    if run_data.get("status") == "running":
        raise HTTPException(400, "Report is only available for completed runs")
    if run_data.get("workspace_id") is not None:
        raise HTTPException(403, "Reports are available for benchmark runs only")

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    try:
        pdf_bytes = generate_report_pdf(
            run_id=run_id,
            results_dir=RESULTS_DIR,
            evidence_dir=EVIDENCE_DIR,
            app_dirs=app.state.app_dirs,
            anthropic_api_key=api_key,
        )
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Report generation failed: {e}")

    return FastAPIResponse(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="report-{run_id[:8]}.pdf"'},
    )


@app.get("/incidents/{run_id}/stream")
async def stream_incident(
    run_id: str,
    replay: bool = Query(False),
    speed: float = Query(1.0, ge=0.1),
):
    if replay:
        evidence_file = EVIDENCE_DIR / f"{run_id}.jsonl"
        if not evidence_file.exists():
            raise HTTPException(404, f"Evidence for run '{run_id}' not found")

        async def replay_generator() -> AsyncIterator[dict]:
            lines = evidence_file.read_text().splitlines()
            prev_ts: float | None = None
            for line in lines:
                if not line.strip():
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                ts = event.get("ts")
                if ts is not None and prev_ts is not None:
                    delay = (ts - prev_ts) / speed
                    if delay > 0:
                        await asyncio.sleep(delay)
                prev_ts = ts
                yield {"data": json.dumps(event)}

        return EventSourceResponse(replay_generator())

    if run_id not in app.state.incidents:
        raise HTTPException(404, f"Run '{run_id}' not found")
    evidence_file = EVIDENCE_DIR / f"{run_id}.jsonl"

    async def live_generator() -> AsyncIterator[dict]:
        offset = 0
        while True:
            if evidence_file.exists():
                lines = evidence_file.read_text().splitlines()
                for line in lines[offset:]:
                    if line.strip():
                        offset += 1
                        yield {"data": line}
            if app.state.incidents.get(run_id, {}).get("status") in ("done", "failed"):
                # Flush any events written between last read and status flip
                if evidence_file.exists():
                    lines = evidence_file.read_text().splitlines()
                    for line in lines[offset:]:
                        if line.strip():
                            offset += 1
                            yield {"data": line}
                break
            await asyncio.sleep(0.5)

    return EventSourceResponse(live_generator())


@app.get("/leaderboard")
def leaderboard():
    runs: list[dict] = []
    for p in RESULTS_DIR.glob("*.json"):
        try:
            runs.append(json.loads(p.read_text()))
        except Exception:
            continue

    grouped: dict[tuple[str, str], list[dict]] = {}
    for r in runs:
        key = (r.get("app", ""), r.get("incident_id", ""))
        grouped.setdefault(key, []).append(r)

    all_app_names = sorted({k[0] for k in grouped})
    incident_ids = sorted({k[1] for k in grouped}) or ["SRE-0001", "SRE-0003", "SRE-0006", "SRE-0013", "SRE-0020"]

    rows = []
    for app_name in all_app_names:
        cells = [
            {
                "incident_id": inc_id,
                "best_score": max((r.get("score", 0.0) for r in grouped[(app_name, inc_id)]), default=0.0),
                "runs": len(grouped[(app_name, inc_id)]),
            }
            for inc_id in incident_ids
            if (app_name, inc_id) in grouped
        ]
        if cells:
            rows.append({"app": app_name, "cells": cells})

    solved_easy = solved_medium = solved_hard = 0
    total_easy = total_medium = total_hard = 0
    mttr_values: list[float] = []

    for (app_name, inc_id), inc_runs in grouped.items():
        difficulty = _get_difficulty(app_name, inc_id, app.state.app_dirs)
        best = max((r.get("score", 0.0) for r in inc_runs), default=0.0)
        solved = best >= 0.7
        if difficulty == "easy":
            total_easy += 1
            if solved:
                solved_easy += 1
        elif difficulty == "medium":
            total_medium += 1
            if solved:
                solved_medium += 1
        elif difficulty == "hard":
            total_hard += 1
            if solved:
                solved_hard += 1
        mttr_values.extend(float(r["mttr_s"]) for r in inc_runs if "mttr_s" in r)

    avg_mttr = round(sum(mttr_values) / len(mttr_values), 2) if mttr_values else 0.0

    return {
        "rows": rows,
        "incident_ids": incident_ids,
        "stats": {
            "solved_easy": solved_easy,
            "total_easy": total_easy,
            "solved_medium": solved_medium,
            "total_medium": total_medium,
            "solved_hard": solved_hard,
            "total_hard": total_hard,
            "avg_mttr_s": avg_mttr,
        },
    }


def _get_difficulty(app_name: str, incident_id: str, app_dirs: dict[str, Path] | None = None) -> str:
    app_dir = (app_dirs or {}).get(app_name)
    if app_dir is None:
        return "unknown"
    inc_path = app_dir / "incidents" / f"{incident_id}.yaml"
    if inc_path.exists():
        try:
            return load_incident(inc_path).difficulty
        except Exception:
            pass
    return "unknown"


@app.post("/demo/seed")
def demo_seed():
    from sentinel.seed import DemoSeeder
    run_id = DemoSeeder().seed(EVIDENCE_DIR, RESULTS_DIR, APPS_DIR)
    result_file = RESULTS_DIR / f"{run_id}.json"
    if result_file.exists():
        try:
            app.state.incidents[run_id] = json.loads(result_file.read_text())
        except Exception:
            app.state.incidents[run_id] = {
                "run_id": run_id,
                "app": "shop-api",
                "incident_id": "SRE-0001",
                "status": "done",
            }
    return {"seeded": True, "run_id": run_id}
