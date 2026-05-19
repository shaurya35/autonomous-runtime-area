from pathlib import Path
from sentinel.adapters.logs.base import LogSource
from sentinel.adapters.logs.docker import _parse_line
from sentinel.models import LogLine


class FileLogSource(LogSource):
    def __init__(self, path: str, max_lines: int = 500):
        self.path = Path(path)
        self.max_lines = max_lines

    async def tail(self, since_seconds: int = 60, grep: str | None = None) -> list[LogLine]:
        if not self.path.exists():
            return [LogLine(ts="", level="ERROR", message=f"log file not found: {self.path}")]
        lines = self.path.read_text(errors="replace").splitlines()[-self.max_lines:]
        return [_parse_line(l) for l in lines if not grep or grep.lower() in l.lower()]
