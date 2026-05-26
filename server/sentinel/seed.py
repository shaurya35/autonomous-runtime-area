import json
import time
import uuid
from pathlib import Path


_FAKE_EVENTS = [
    ("detecting", "thought", {"text": "Alert received: login endpoint is returning 500s after the latest request."}, 0.0),
    ("detecting", "tool_call", {"tool": "read_logs", "input": {"since_seconds": 60}}, 1.2),
    ("detecting", "tool_result", {"tool": "read_logs", "result": {"logs": ["thread 'tokio-runtime-worker' panicked at src/routes/auth.rs: called `Option::unwrap()` on a None value"]}}, 2.4),
    ("diagnosing", "thought", {"text": "The failure is isolated to the auth route when the password field is missing."}, 3.6),
    ("diagnosing", "tool_call", {"tool": "read_file", "input": {"path": "apps/rust/src/routes/auth.rs"}}, 4.2),
    ("diagnosing", "tool_result", {"tool": "read_file", "result": {"content": "let password = body.password.unwrap();"}}, 5.5),
    ("fixing", "thought", {"text": "Replace the unsafe unwrap with validation that returns a 400 response."}, 7.0),
    ("fixing", "tool_call", {"tool": "propose_patch", "input": {"file": "apps/rust/src/routes/auth.rs"}}, 8.1),
    ("fixing", "tool_result", {"tool": "propose_patch", "result": {"success": True, "summary": "Added missing-password validation."}}, 9.2),
    ("verifying", "tool_call", {"tool": "run_tests", "input": {"cmd": "cargo test --manifest-path apps/rust/Cargo.toml"}}, 10.1),
    ("verifying", "tool_result", {"tool": "run_tests", "result": {"returncode": 0, "stdout": "5 passed"}}, 13.0),
    ("done", "summary", {"score": 0.95, "mttr_s": 14, "text": "Incident resolved. Login now rejects malformed requests without crashing."}, 14.0),
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
            start = time.time()
            lines = [
                json.dumps({
                    "ts": start + offset,
                    "run_id": run_id,
                    "incident_id": "SRE-0001",
                    "phase": phase,
                    "type": event_type,
                    "payload": payload,
                })
                for phase, event_type, payload, offset in _FAKE_EVENTS
            ]
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
