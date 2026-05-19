import asyncio
import json
import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import yaml
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

load_dotenv()

APPS_DIR = Path(os.getenv("APPS_DIR", "./apps"))
EVIDENCE_DIR = Path(os.getenv("EVIDENCE_DIR", "./evidence"))
RESULTS_DIR = Path(os.getenv("RESULTS_DIR", "./results"))

for d in [EVIDENCE_DIR, RESULTS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

try:
    from sentinel.manifest import discover_apps
    from sentinel.channel import IncidentChannel
    HAS_SENTINEL = True
except ImportError:
    HAS_SENTINEL = False


class StartIncidentRequest(BaseModel):
    app: str
    incident_id: str


class IncidentRunResponse(BaseModel):
    run_id: str
    app: str
    incident_id: str
    status: str = "running"
    score: float | None = None
    mttr_s: float | None = None
    phases_reached: list[str] = []
    stream_url: str = ""


@asynccontextmanager
async def lifespan(application: FastAPI):
    application.state.apps: dict = {}
    application.state.runs: dict[str, IncidentRunResponse] = {}
    application.state.channels: dict = {}
    if HAS_SENTINEL:
        application.state.apps = {
            name: manifest.model_dump()
            for name, manifest in discover_apps(APPS_DIR).items()
        }
    yield


app = FastAPI(title="Sentinel", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"status": "ok", "has_sentinel": HAS_SENTINEL}


@app.get("/apps")
def list_apps():
    return list(app.state.apps.values())


@app.get("/apps/{name}")
def get_app(name: str):
    if name not in app.state.apps:
        raise HTTPException(status_code=404, detail=f"App '{name}' not found")
    return app.state.apps[name]


@app.get("/apps/{name}/health")
async def get_app_health(name: str):
    if name not in app.state.apps:
        raise HTTPException(status_code=404, detail=f"App '{name}' not found")
    if not HAS_SENTINEL:
        return {"error": "sentinel not available"}
    try:
        from sentinel.adapters.factory import make_health_probe
        status = await make_health_probe(app.state.apps[name]["signals"]).check()
        return status.model_dump()
    except Exception as e:
        return {"healthy": False, "error": str(e)}


@app.get("/apps/{name}/logs")
async def get_app_logs(name: str, since: int = 60, grep: str | None = None):
    if name not in app.state.apps:
        raise HTTPException(status_code=404, detail=f"App '{name}' not found")
    if not HAS_SENTINEL:
        return {"logs": []}
    try:
        from sentinel.adapters.factory import make_log_source
        lines = await make_log_source(app.state.apps[name]["signals"]).tail(since_seconds=since, grep=grep)
        return {"logs": [l.model_dump() for l in lines]}
    except Exception as e:
        return {"logs": [], "error": str(e)}


@app.get("/apps/{name}/metrics")
async def get_app_metrics(name: str):
    if name not in app.state.apps:
        raise HTTPException(status_code=404, detail=f"App '{name}' not found")
    if not HAS_SENTINEL:
        return {"series": []}
    try:
        from sentinel.adapters.factory import make_metric_source
        series = await make_metric_source(app.state.apps[name]["signals"]).scrape()
        return {"series": [s.model_dump() for s in series]}
    except Exception as e:
        return {"series": [], "error": str(e)}


@app.post("/incidents/start", response_model=IncidentRunResponse)
async def start_incident(req: StartIncidentRequest, background_tasks: BackgroundTasks):
    if req.app not in app.state.apps:
        raise HTTPException(status_code=404, detail=f"App '{req.app}' not found")
    run_id = str(uuid.uuid4())[:8]
    run_info = IncidentRunResponse(
        run_id=run_id, app=req.app, incident_id=req.incident_id,
        status="running", stream_url=f"/incidents/{run_id}/stream",
    )
    app.state.runs[run_id] = run_info
    if HAS_SENTINEL:
        channel = IncidentChannel(run_id, req.incident_id, EVIDENCE_DIR)
        app.state.channels[run_id] = channel
        background_tasks.add_task(_run_agent, run_id, req.app, req.incident_id, channel)
    return run_info


async def _run_agent(run_id: str, app_name: str, incident_id: str, channel):
    import time
    run_info = app.state.runs[run_id]
    start = time.time()
    try:
        from sentinel.adapters.factory import make_log_source, make_metric_source, make_health_probe, make_runtime
        from sentinel.tools import ToolRegistry
        from sentinel.agent import SentinelAgent
        from srebench.schema import load_incident

        manifest_dict = app.state.apps[app_name]
        repo_root = Path(".").resolve()

        incident_path = None
        for entry in APPS_DIR.iterdir():
            candidate = entry / "incidents" / f"{incident_id}.yaml"
            if candidate.exists():
                incident_path = candidate
                break
        if not incident_path:
            raise FileNotFoundError(f"Incident {incident_id} not found")

        incident = load_incident(incident_path)
        brief = f"Alert: {incident.agent_sees.alert}\n\nSymptoms:\n" + \
                "\n".join(f"- {s}" for s in incident.agent_sees.symptoms)

        registry = ToolRegistry(
            manifest_dict,
            make_log_source(manifest_dict["signals"]),
            make_metric_source(manifest_dict["signals"]),
            make_health_probe(manifest_dict["signals"]),
            make_runtime(manifest_dict, repo_root),
            repo_root,
        )
        result = await SentinelAgent(tools=registry.definitions(), channel=channel).run(brief, registry.execute)

        phases = result.get("phases_reached", [])
        run_info.phases_reached = phases
        run_info.mttr_s = round(time.time() - start, 2)
        run_info.status = "done"
        run_info.score = round(
            0.2 * ("detecting" in phases) +
            0.3 * ("diagnosing" in phases) +
            0.5 * ("verifying" in phases), 4)

        (RESULTS_DIR / f"{run_id}.json").write_text(json.dumps({
            "run_id": run_id, "incident_id": incident_id, "app": app_name,
            "score": run_info.score, "mttr_s": run_info.mttr_s, "phases_reached": phases,
        }, indent=2))
    except Exception as e:
        run_info.status = "failed"
        channel.emit("failed", "summary", {"error": str(e)})


@app.get("/incidents")
def list_incidents():
    return list(app.state.runs.values())


@app.get("/incidents/{run_id}")
def get_incident(run_id: str):
    if run_id not in app.state.runs:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")
    return app.state.runs[run_id]


@app.get("/incidents/{run_id}/stream")
async def stream_incident(run_id: str):
    if run_id not in app.state.channels:
        raise HTTPException(status_code=404, detail=f"No channel for run '{run_id}'")
    channel = app.state.channels[run_id]

    async def gen():
        async for event in channel.subscribe():
            yield {"data": event.model_dump_json()}

    return EventSourceResponse(gen())
