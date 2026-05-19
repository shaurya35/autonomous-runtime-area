from pydantic import BaseModel


class LogLine(BaseModel):
    ts: str
    level: str
    message: str
    extra: dict = {}


class MetricPoint(BaseModel):
    ts: float
    value: float


class MetricSeries(BaseModel):
    name: str
    labels: dict[str, str]
    points: list[MetricPoint]


class HealthStatus(BaseModel):
    healthy: bool
    status_code: int
    body: dict | None = None
    latency_ms: float = 0.0


class CommandResult(BaseModel):
    returncode: int
    stdout: str
    stderr: str
    timed_out: bool = False


class PatchResult(BaseModel):
    success: bool
    error: str | None = None
    restarted: bool = False
