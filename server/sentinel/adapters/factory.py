import shutil
import subprocess
from pathlib import Path
from sentinel.adapters.logs.base import LogSource
from sentinel.adapters.logs.docker import DockerLogSource
from sentinel.adapters.logs.file import FileLogSource
from sentinel.adapters.logs.process import ProcessLogSource
from sentinel.adapters.metrics.base import MetricSource
from sentinel.adapters.metrics.prometheus import PrometheusMetricSource
from sentinel.adapters.health.base import HealthProbe
from sentinel.adapters.health.http import HttpHealthProbe
from sentinel.adapters.runtime.base import Runtime
from sentinel.adapters.runtime.docker_compose import DockerComposeRuntime
from sentinel.adapters.runtime.local import LocalRuntime


def _docker_available() -> bool:
    if shutil.which("docker") is None:
        return False
    try:
        return subprocess.run(
            ["docker", "info"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=3,
            check=False,
        ).returncode == 0
    except Exception:
        return False


def make_log_source(signals: dict) -> LogSource:
    logs = signals.get("logs", {})
    if logs.get("type") == "file":
        return FileLogSource(path=logs["path"])
    if logs.get("type") == "docker" and _docker_available():
        return DockerLogSource(service=logs.get("service", "app"))
    health_url = signals.get("health", {}).get("url")
    return ProcessLogSource(health_url=health_url)


def make_metric_source(signals: dict) -> MetricSource:
    return PrometheusMetricSource(url=signals["metrics"]["url"])


def make_health_probe(signals: dict) -> HealthProbe:
    h = signals.get("health", {})
    return HttpHealthProbe(url=h["url"], expect_status=h.get("expect_status", 200))


def make_runtime(manifest: dict, repo_root: Path) -> Runtime:
    if _docker_available():
        service = manifest.get("signals", {}).get("logs", {}).get("service", "app")
        return DockerComposeRuntime(service=service, project_dir=str(repo_root))
    source_root = repo_root / manifest.get("source_root", ".")
    app_dir = source_root.parent if source_root.name == "src" else source_root
    return LocalRuntime(app_dir=app_dir)
