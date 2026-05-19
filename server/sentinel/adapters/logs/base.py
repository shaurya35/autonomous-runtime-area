from abc import ABC, abstractmethod
from sentinel.models import LogLine


class LogSource(ABC):
    @abstractmethod
    async def tail(self, since_seconds: int = 60, grep: str | None = None) -> list[LogLine]: ...
