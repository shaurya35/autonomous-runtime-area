import asyncio
import time
import httpx


class LoadTester:
    def __init__(self, manifest_dict: dict, base_url: str, concurrency: int = 10, duration_s: int = 30):
        self.endpoints = manifest_dict.get("endpoints", [])
        self.base_url = base_url.rstrip("/")
        self.concurrency = concurrency
        self.duration_s = duration_s

    async def run(self) -> dict:
        if not self.endpoints:
            return {"error": "no endpoints in manifest"}
        latencies: list[float] = []
        success = 0
        total = 0
        deadline = time.monotonic() + self.duration_s

        async def worker():
            nonlocal success, total
            i = 0
            async with httpx.AsyncClient(timeout=5.0) as client:
                while time.monotonic() < deadline:
                    ep = self.endpoints[i % len(self.endpoints)]
                    i += 1
                    url = self.base_url + ep["path"]
                    t0 = time.monotonic()
                    try:
                        resp = await (client.post(url, content=ep.get("sample_body"),
                                                   headers={"content-type": "application/json"})
                                      if ep.get("method", "GET").upper() == "POST"
                                      else client.get(url))
                        if resp.status_code < 500:
                            success += 1
                    except Exception:
                        pass
                    latencies.append((time.monotonic() - t0) * 1000)
                    total += 1

        await asyncio.gather(*[worker() for _ in range(self.concurrency)])
        latencies.sort()
        return {
            "total_requests": total,
            "success_rate": round(success / max(total, 1), 4),
            "p50_ms": round(latencies[len(latencies) // 2], 2) if latencies else 0,
            "p99_ms": round(latencies[int(len(latencies) * 0.99)], 2) if latencies else 0,
        }
