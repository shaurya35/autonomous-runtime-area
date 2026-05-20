import asyncio
from sentinel.adapters.logs.base import LogSource
from sentinel.adapters.logs.docker import _parse_line
from sentinel.models import LogLine


class ProcessLogSource(LogSource):
    """Captures logs by running the app's log-emit command or via journald/stdout pipe."""

    def __init__(self, health_url: str | None = None):
        self.health_url = health_url

    async def tail(self, since_seconds: int = 60, grep: str | None = None) -> list[LogLine]:
        try:
            proc = await asyncio.create_subprocess_shell(
                f"log show --predicate 'processImagePath contains \"shop-api\"' --last {since_seconds}s 2>/dev/null | tail -200",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
            lines = stdout.decode(errors="replace").splitlines()
            if lines:
                parsed = [_parse_line(l) for l in lines if l.strip()]
                if grep:
                    parsed = [l for l in parsed if grep.lower() in l.message.lower()]
                return parsed
        except Exception:
            pass
        return [LogLine(ts="", level="INFO", message="Log capture not available for native process. Use read_file and search_code to inspect source.")]
