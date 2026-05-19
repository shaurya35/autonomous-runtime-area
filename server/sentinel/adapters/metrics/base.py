from abc import ABC, abstractmethod
from sentinel.models import MetricSeries


class MetricSource(ABC):
    @abstractmethod
    async def scrape(self) -> list[MetricSeries]: ...
