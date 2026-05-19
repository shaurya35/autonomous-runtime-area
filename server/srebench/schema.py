from pathlib import Path
from typing import Literal
import yaml
from pydantic import BaseModel


class InjectStep(BaseModel):
    type: Literal["code_change", "runtime_fault", "config_change"]
    file: str | None = None
    diff: str | None = None
    command: str | None = None
    env_var: str | None = None
    value: str | None = None


class GroundTruth(BaseModel):
    root_cause: str
    fix_type: Literal["code_change", "config_change", "runtime_action"]
    fix_diff: str | None = None
    fix_commands: list[str] = []


class AgentSees(BaseModel):
    alert: str
    symptoms: list[str]
    recent_deploys: list[str] = []


class IncidentSpec(BaseModel):
    id: str
    title: str
    app: str
    category: Literal["code", "config", "resource", "network", "integration"]
    difficulty: Literal["easy", "medium", "hard"]
    inject: list[InjectStep]
    ground_truth: GroundTruth
    agent_sees: AgentSees
    pre_fix_tests: list[str]
    post_fix_tests: list[str]


class Commands(BaseModel):
    build: str
    start: str
    stop: str
    restart: str
    test: str


class AppManifest(BaseModel):
    name: str
    language: str
    source_root: str
    test_root: str | None = None
    commands: Commands
    signals: dict
    endpoints: list = []


def load_incident(incident_path: Path) -> IncidentSpec:
    with open(incident_path) as f:
        return IncidentSpec.model_validate(yaml.safe_load(f))


def load_manifest(app_dir: Path) -> AppManifest:
    with open(app_dir / "srebench.yaml") as f:
        return AppManifest.model_validate(yaml.safe_load(f))
