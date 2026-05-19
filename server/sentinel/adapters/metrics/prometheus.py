import time
import httpx
from sentinel.adapters.metrics.base import MetricSource
from sentinel.models import MetricSeries, MetricPoint


class PrometheusMetricSource(MetricSource):
    def __init__(self, url: str, timeout: float = 5.0):
        self.url = url
        self.timeout = timeout

    async def scrape(self) -> list[MetricSeries]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(self.url)
                resp.raise_for_status()
                return _parse_text(resp.text)
        except Exception:
            return []


def _parse_text(text: str) -> list[MetricSeries]:
    now = time.time()
    series = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            if "{" in line:
                name, rest = line.split("{", 1)
                labels_str, rest2 = rest.split("}", 1)
                labels = {k.strip(): v.strip().strip('"') for part in labels_str.split(",")
                          for k, v in [part.split("=", 1)] if "=" in part}
                parts = rest2.strip().split()
                value = float(parts[0])
            else:
                parts = line.split()
                name = parts[0]
                labels = {}
                value = float(parts[1]) if len(parts) > 1 else 0.0
            series.append(MetricSeries(name=name.strip(), labels=labels,
                                        points=[MetricPoint(ts=now, value=value)]))
        except Exception:
            continue
    return series
