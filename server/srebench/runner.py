import asyncio
import json
import time
import uuid
from pathlib import Path

import httpx
import typer
from rich.console import Console
from rich.table import Table

from srebench.schema import load_incident, load_manifest
from srebench.injector import Injector
from srebench.scorer import Scorer, IncidentResult
from srebench.load_test import LoadTester

app = typer.Typer(name="srebench", help="SREBench — incident benchmark runner")
console = Console()


def _find_incident(apps_dir: Path, app_name: str | None, incident_id: str):
    for app_dir in apps_dir.iterdir():
        if not (app_dir / "srebench.yaml").exists():
            continue
        manifest = load_manifest(app_dir)
        if app_name and manifest.name != app_name:
            continue
        incident_path = app_dir / "incidents" / f"{incident_id}.yaml"
        if incident_path.exists():
            return load_incident(incident_path), manifest, app_dir
    raise typer.BadParameter(f"Incident {incident_id} not found under {apps_dir}")


@app.command("run")
def run(
    incident_id: str = typer.Argument(...),
    app_name: str = typer.Option(None, "--app"),
    gold: bool = typer.Option(False, "--gold"),
    apps_dir: Path = typer.Option(Path("./apps"), "--apps-dir"),
    output_dir: Path = typer.Option(Path("./results"), "--output-dir"),
    api_url: str = typer.Option("http://localhost:8000", "--api-url"),
):
    """Run an incident through the eval loop."""
    asyncio.run(_run_async(incident_id, app_name, gold, apps_dir, output_dir, api_url))


async def _run_async(incident_id, app_name, gold, apps_dir, output_dir, api_url):
    incident, manifest, app_dir = _find_incident(apps_dir, app_name, incident_id)
    repo_root = Path(".").resolve()
    injector = Injector(manifest, repo_root)
    scorer = Scorer()
    output_dir.mkdir(parents=True, exist_ok=True)
    run_id = str(uuid.uuid4())[:8]

    console.print(f"[bold]Running {incident_id}[/bold] on {manifest.name} (run_id={run_id})")
    await injector.inject(incident)

    result = IncidentResult(run_id=run_id, incident_id=incident_id,
                             pre_tests_passed=await scorer.run_tests(incident.pre_fix_tests))
    start_time = time.time()

    if gold:
        result.detected = result.diagnosed = True
        result.fixed = await scorer.run_tests(incident.post_fix_tests)
    else:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(f"{api_url}/incidents/start",
                                          json={"app": manifest.name, "incident_id": incident_id})
                resp.raise_for_status()
                agent_run_id = resp.json()["run_id"]
            for _ in range(60):
                await asyncio.sleep(5)
                async with httpx.AsyncClient(timeout=5) as client:
                    r = await client.get(f"{api_url}/incidents/{agent_run_id}")
                    if r.status_code == 200 and r.json().get("status") in ("done", "failed"):
                        phases = r.json().get("phases_reached", [])
                        result.detected = "detecting" in phases
                        result.diagnosed = "diagnosing" in phases
                        result.phases_reached = phases
                        break
        except Exception as e:
            console.print(f"  [yellow]Agent API unavailable: {e}[/yellow]")
        result.fixed = await scorer.run_tests(incident.post_fix_tests)

    result.mttr_s = time.time() - start_time
    result.post_tests_passed = result.fixed
    result.score = scorer.score(result)

    out = output_dir / f"{run_id}.json"
    out.write_text(result.model_dump_json(indent=2))

    t = Table(title=f"Result: {incident_id}")
    t.add_column("Metric"); t.add_column("Value")
    for k, v in [("Score", f"{result.score:.3f}"), ("MTTR", f"{result.mttr_s:.1f}s"),
                  ("Detected", str(result.detected)), ("Diagnosed", str(result.diagnosed)),
                  ("Fixed", str(result.fixed)), ("Result file", str(out))]:
        t.add_row(k, v)
    console.print(t)


@app.command("inject")
def inject(
    incident_id: str = typer.Argument(...),
    app_name: str = typer.Option(None, "--app"),
    apps_dir: Path = typer.Option(Path("./apps"), "--apps-dir"),
    reset: bool = typer.Option(False, "--reset"),
):
    """Inject (or reset) a fault."""
    incident, manifest, _ = _find_incident(apps_dir, app_name, incident_id)
    injector = Injector(manifest, Path(".").resolve())
    if reset:
        asyncio.run(injector.reset(incident))
        console.print(f"Reset {incident_id}")
    else:
        asyncio.run(injector.inject(incident))
        console.print(f"Injected {incident_id}")


@app.command("score")
def score(run_id: str = typer.Argument(...), results_dir: Path = typer.Option(Path("./results"))):
    """Print the score for a completed run."""
    p = results_dir / f"{run_id}.json"
    if not p.exists():
        console.print(f"[red]Run {run_id} not found[/red]"); raise typer.Exit(1)
    result = IncidentResult.model_validate_json(p.read_text())
    result.score = Scorer().score(result)
    console.print_json(result.model_dump_json(indent=2))


@app.command("load-test")
def load_test(
    app_name: str = typer.Argument(...),
    base_url: str = typer.Argument(...),
    duration: int = typer.Option(30, "--duration"),
    concurrency: int = typer.Option(10, "--concurrency"),
    apps_dir: Path = typer.Option(Path("./apps"), "--apps-dir"),
):
    """Run synthetic load against an app."""
    import yaml
    for app_dir in apps_dir.iterdir():
        if (app_dir / "srebench.yaml").exists():
            with open(app_dir / "srebench.yaml") as f:
                d = yaml.safe_load(f)
            if d.get("name") == app_name:
                result = asyncio.run(LoadTester(d, base_url, concurrency, duration).run())
                console.print_json(json.dumps(result))
                return
    console.print(f"[red]App {app_name} not found[/red]")


if __name__ == "__main__":
    app()
