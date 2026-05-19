from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field


class LogSignalConfig(BaseModel):
    type: str = "docker"
    service: str | None = None
    path: str | None = None


class MetricsSignalConfig(BaseModel):
    type: str = "prometheus"
    url: str


class HealthSignalConfig(BaseModel):
    type: str = "http"
    url: str
    expect_status: int = 200


class SignalsConfig(BaseModel):
    logs: LogSignalConfig = Field(default_factory=LogSignalConfig)
    metrics: MetricsSignalConfig | None = None
    health: HealthSignalConfig | None = None


class CommandsConfig(BaseModel):
    build: str | None = None
    start: str | None = None
    stop: str | None = None
    restart: str | None = None
    test: str | None = None


class EndpointConfig(BaseModel):
    method: str = "GET"
    path: str
    sample_body: str | None = None


class AppManifest(BaseModel):
    name: str
    language: str = "unknown"
    runtime: str = "docker-compose"
    source_root: str = "."
    test_root: str | None = None
    commands: CommandsConfig = Field(default_factory=CommandsConfig)
    signals: SignalsConfig = Field(default_factory=SignalsConfig)
    endpoints: list[EndpointConfig] = Field(default_factory=list)

    def model_dump(self, **kwargs) -> dict[str, Any]:
        return super().model_dump(**kwargs)


def load_manifest(path: Path) -> AppManifest:
    data = yaml.safe_load(path.read_text())
    return AppManifest.model_validate(data)


def discover_apps(apps_dir: Path) -> dict[str, AppManifest]:
    manifests: dict[str, AppManifest] = {}
    if not apps_dir.exists():
        return manifests
    for candidate in apps_dir.rglob("srebench.yaml"):
        try:
            m = load_manifest(candidate)
            manifests[m.name] = m
        except Exception:
            pass
    return manifests
