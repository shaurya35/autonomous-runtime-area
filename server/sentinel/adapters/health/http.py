import time
import httpx
from sentinel.adapters.health.base import HealthProbe
from sentinel.models import HealthStatus


class HttpHealthProbe(HealthProbe):
    def __init__(self, url: str, expect_status: int = 200, timeout: float = 5.0):
        self.url = url
        self.expect_status = expect_status
        self.timeout = timeout

    async def check(self) -> HealthStatus:
        start = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(self.url)
                latency = (time.monotonic() - start) * 1000
                try:
                    body = resp.json()
                except Exception:
                    body = None
                return HealthStatus(healthy=(resp.status_code == self.expect_status),
                                    status_code=resp.status_code, body=body,
                                    latency_ms=round(latency, 2))
        except Exception as e:
            latency = (time.monotonic() - start) * 1000
            return HealthStatus(healthy=False, status_code=0,
                                body={"error": str(e)}, latency_ms=round(latency, 2))
