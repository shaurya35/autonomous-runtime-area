from abc import ABC, abstractmethod
from sentinel.models import HealthStatus


class HealthProbe(ABC):
    @abstractmethod
    async def check(self) -> HealthStatus: ...
