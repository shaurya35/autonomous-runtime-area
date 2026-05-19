from pathlib import Path
from sentinel.adapters.logs.base import LogSource
from sentinel.adapters.logs.docker import DockerLogSource
from sentinel.adapters.logs.file import FileLogSource
from sentinel.adapters.metrics.base import MetricSource
from sentinel.adapters.metrics.prometheus import PrometheusMetricSource
from sentinel.adapters.health.base import HealthProbe
from sentinel.adapters.health.http import HttpHealthProbe
from sentinel.adapters.runtime.base import Runtime
from sentinel.adapters.runtime.docker_compose import DockerComposeRuntime


def make_log_source(signals: dict) -> LogSource:
    logs = signals.get("logs", {})
    if logs.get("type") == "file":
        return FileLogSource(path=logs["path"])
    return DockerLogSource(service=logs.get("service", "app"))


def make_metric_source(signals: dict) -> MetricSource:
    return PrometheusMetricSource(url=signals["metrics"]["url"])


def make_health_probe(signals: dict) -> HealthProbe:
    h = signals.get("health", {})
    return HttpHealthProbe(url=h["url"], expect_status=h.get("expect_status", 200))


def make_runtime(manifest: dict, repo_root: Path) -> Runtime:
    service = manifest.get("signals", {}).get("logs", {}).get("service", "app")
    return DockerComposeRuntime(service=service, project_dir=str(repo_root))
