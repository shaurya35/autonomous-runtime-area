import asyncio
from sentinel.adapters.logs.base import LogSource
from sentinel.models import LogLine


class DockerLogSource(LogSource):
    def __init__(self, service: str):
        self.service = service

    async def tail(self, since_seconds: int = 60, grep: str | None = None) -> list[LogLine]:
        try:
            proc = await asyncio.create_subprocess_exec(
                "docker", "logs", self.service, "--since", f"{since_seconds}s", "--timestamps",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
            lines = stdout.decode(errors="replace").splitlines()
        except Exception as e:
            return [LogLine(ts="", level="ERROR", message=f"docker logs failed: {e}")]
        return [_parse_line(l) for l in lines if not grep or grep.lower() in l.lower()]


def _parse_line(raw: str) -> LogLine:
    parts = raw.split(" ", 1)
    ts = parts[0] if len(parts) > 1 else ""
    text = parts[1] if len(parts) > 1 else raw
    # Detect level from the entire raw line so lines without timestamps work too
    upper = raw.upper()
    level = "ERROR" if any(k in upper for k in ("ERROR", "PANIC", "FATAL")) else \
            "WARN" if "WARN" in upper else \
            "DEBUG" if any(k in upper for k in ("DEBUG", "TRACE")) else "INFO"
    return LogLine(ts=ts, level=level, message=text.strip())
