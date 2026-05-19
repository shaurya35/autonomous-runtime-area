import json
import uuid
from pathlib import Path


_FAKE_EVENTS = [
    {"type": "phase", "phase": "detecting", "ts": 0.0},
    {"type": "thought", "content": "Checking error rate spike on shop-api.", "ts": 1.2},
    {"type": "tool_call", "tool": "get_logs", "args": {"app": "shop-api"}, "ts": 2.5},
    {"type": "tool_result", "tool": "get_logs", "content": "ERROR: NullPointerException in OrderService", "ts": 3.1},
    {"type": "phase", "phase": "diagnosing", "ts": 4.0},
    {"type": "thought", "content": "Root cause: missing null check in OrderService.process()", "ts": 5.3},
    {"type": "phase", "phase": "fixing", "ts": 6.0},
    {"type": "tool_call", "tool": "apply_patch", "args": {"file": "src/OrderService.java"}, "ts": 7.1},
    {"type": "tool_result", "tool": "apply_patch", "content": "Patch applied successfully", "ts": 8.0},
    {"type": "phase", "phase": "verifying", "ts": 9.0},
    {"type": "tool_call", "tool": "run_tests", "args": {}, "ts": 10.0},
    {"type": "tool_result", "tool": "run_tests", "content": "All tests passed", "ts": 13.5},
    {"type": "done", "score": 0.95, "mttr_s": 14, "ts": 14.0},
]


class DemoSeeder:
    def seed(self, evidence_dir: Path, results_dir: Path, apps_dir: Path) -> str:
        evidence_dir.mkdir(parents=True, exist_ok=True)
        results_dir.mkdir(parents=True, exist_ok=True)

        fixture = Path(__file__).parent.parent / "tests" / "fixtures" / "demo-runs" / "SRE-0001-canonical.jsonl"
        run_id = f"demo-{uuid.uuid4().hex[:8]}"

        if fixture.exists():
            (evidence_dir / f"{run_id}.jsonl").write_text(fixture.read_text())
        else:
            lines = [json.dumps(e) for e in _FAKE_EVENTS]
            (evidence_dir / f"{run_id}.jsonl").write_text("\n".join(lines) + "\n")

        result = {
            "run_id": run_id,
            "app": "shop-api",
            "incident_id": "SRE-0001",
            "status": "done",
            "score": 0.95,
            "mttr_s": 14,
            "phases_reached": ["detecting", "diagnosing", "fixing", "verifying"],
        }
        (results_dir / f"{run_id}.json").write_text(json.dumps(result))

        return run_id
