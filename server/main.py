import asyncio
import json
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from sentinel.vitals import VitalSimulator
from srebench.schema import AppManifest, load_incident, load_manifest

REPO_ROOT    = Path(__file__).parent.parent
APPS_DIR     = REPO_ROOT / "apps"
EVIDENCE_DIR = Path(__file__).parent / "evidence"
RESULTS_DIR  = Path(__file__).parent / "results"


def _discover_apps() -> dict[str, AppManifest]:
    apps: dict[str, AppManifest] = {}
    if not APPS_DIR.exists():
        return apps
    for p in APPS_DIR.iterdir():
        manifest_file = p / "srebench.yaml"
        if manifest_file.exists():
            try:
                apps[p.name] = load_manifest(manifest_file)
            except Exception:
                continue
    return apps


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.apps = _discover_apps()
    app.state.vital_sims = {name: VitalSimulator(name) for name in app.state.apps}
    app.state.incidents: dict[str, dict] = {}
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="SREBench Server", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/apps")
def list_apps():
    return [
        {"name": name, "description": m.description, "language": m.language, "tags": m.tags}
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
    incidents_dir = APPS_DIR / name / "incidents"
    if not incidents_dir.exists():
        return []
    out = []
    for p in sorted(incidents_dir.glob("*.yaml")):
        try:
            inc = load_incident(p)
            out.append({
                "id": inc.id,
                "title": inc.title,
                "difficulty": inc.difficulty,
                "category": inc.category,
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
def start_incident(body: StartIncidentBody):
    if body.app not in app.state.apps:
        raise HTTPException(404, f"App '{body.app}' not found")
    run_id = str(uuid.uuid4())
    record = {
        "run_id": run_id,
        "app": body.app,
        "incident_id": body.incident_id,
        "status": "running",
        "started_at": time.time(),
    }
    app.state.incidents[run_id] = record
    (EVIDENCE_DIR / f"{run_id}.jsonl").touch()
    return record


@app.get("/incidents")
def list_incidents():
    return list(app.state.incidents.values())


@app.get("/incidents/{run_id}")
def get_incident(run_id: str):
    if run_id not in app.state.incidents:
        raise HTTPException(404, f"Run '{run_id}' not found")
    return app.state.incidents[run_id]


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
        difficulty = _get_difficulty(app_name, inc_id)
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


def _get_difficulty(app_name: str, incident_id: str) -> str:
    inc_path = APPS_DIR / app_name / "incidents" / f"{incident_id}.yaml"
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
    return {"seeded": True, "run_id": run_id}
