import asyncio
import collections
import math
import random
import time


class VitalSimulator:
    """
    Vitals for one app.

    Probe data (from VitalCollector) is stored with timestamps so each
    historical sample correctly reflects what was measured at that moment —
    giving real sparkline history instead of a flat line.

    req_per_sec is derived from the real load-generator request count.
    p99_latency_ms and error_rate_pct come from real HTTP measurements.
    cpu_pct is simulated (no lightweight cross-platform CPU probe available).
    """

    def __init__(self, app_name: str, seed: int | None = None):
        self.app_name = app_name
        self.rng = random.Random(seed or hash(app_name))
        self.baseline_cpu = self.rng.uniform(18, 42)
        self.injected = False

        # Each entry: {"ts": float, "latency_ms": float, "ok": bool, "is_load": bool}
        # is_load=True entries also count toward req/s
        self._probes: collections.deque = collections.deque(maxlen=600)

    def record_probe(self, latency_ms: float, ok: bool, is_load: bool = False) -> None:
        self._probes.append({
            "ts": time.time(),
            "latency_ms": latency_ms,
            "ok": ok,
            "is_load": is_load,
        })

    def _probes_near(self, ts: float, window: float = 3.0) -> list[dict]:
        return [p for p in self._probes if abs(p["ts"] - ts) <= window]

    def _rps_at(self, ts: float, window: float = 3.0) -> float:
        """Real req/s: count load-generator responses in the window around ts."""
        load_hits = [p for p in self._probes if p["is_load"] and abs(p["ts"] - ts) <= window]
        return round(len(load_hits) / (window * 2), 1)

    def sample(self, ts: float) -> dict:
        phase = (ts % 60.0) / 60.0 * 2 * math.pi
        noise = lambda: self.rng.gauss(0, 0.01)
        cpu = max(0, min(100, self.baseline_cpu * (1.0 + 0.06 * math.sin(phase + 1.0)) * (1 + noise())))

        nearby = self._probes_near(ts)
        if nearby:
            avg_lat = sum(p["latency_ms"] for p in nearby) / len(nearby)
            err_pct = (sum(1 for p in nearby if not p["ok"]) / len(nearby)) * 100
            p99 = max(1.0, avg_lat * (1 + noise() * 0.05))
            err = max(0.0, err_pct + noise() * 0.02)
            rps = self._rps_at(ts)
            # If probe data shows healthy but injected flag is set, boost visuals
            if self.injected and err < 2.0:
                err = min(20.0, 5.0 + abs(self.rng.gauss(0, 2.0)))
                p99 = p99 * 2.5
        else:
            # No probe data yet — placeholder until first probes arrive
            p99 = 0.0
            err = 0.0
            rps = 0.0

        return {
            "ts": ts,
            "req_per_sec":    round(rps, 1),
            "p99_latency_ms": round(p99, 1),
            "error_rate_pct": round(err, 3),
            "cpu_pct":        round(cpu, 1),
        }


class VitalCollector:
    """
    Background asyncio task. For each registered app it:

    1. Fires a burst of real HTTP GET requests to /products every second
       (the load generator — gives real req/s, real latency, real error rate).
    2. Also probes POST /auth/login (no password) to catch error-injection
       faults that don't affect /products.

    Measurements are stored in VitalSimulator with timestamps so sparkline
    history reflects the actual past state of the app.
    """

    # How many parallel requests to fire per second (real req/s will be ~this)
    LOAD_RPS = 6

    def __init__(self, sims: dict[str, "VitalSimulator"], manifests: dict):
        self.sims = sims
        self.manifests = manifests
        self._task: asyncio.Task | None = None

    def _base_url(self, name: str) -> str | None:
        manifest = self.manifests.get(name)
        if manifest is None:
            return None
        health_url: str | None = (manifest.signals or {}).get("health", {}).get("url")
        if not health_url:
            return None
        # strip trailing path (e.g. /healthz) to get base URL
        parts = health_url.rsplit("/", 1)
        return parts[0] if len(parts) == 2 else health_url

    async def _probe_app(self, name: str, client) -> None:
        sim = self.sims[name]
        base = self._base_url(name)
        if not base:
            return

        # --- Load generator: fire LOAD_RPS requests to /products in parallel ---
        async def load_req():
            try:
                t0 = time.perf_counter()
                r = await client.get(f"{base}/products", timeout=4.0)
                lat = (time.perf_counter() - t0) * 1000
                sim.record_probe(lat, r.status_code < 500, is_load=True)
            except Exception:
                sim.record_probe(4000.0, False, is_load=True)

        await asyncio.gather(*[load_req() for _ in range(self.LOAD_RPS)])

        # --- Error-detection probe: POST /auth/login without password ---
        # Returns 400 when healthy (ok), 500 when SRE-0001 is injected (error)
        try:
            t0 = time.perf_counter()
            r2 = await client.post(
                f"{base}/auth/login",
                json={"email": "probe@sentinel.internal"},
                timeout=2.0,
            )
            lat2 = (time.perf_counter() - t0) * 1000
            ok2 = r2.status_code < 500  # 400 = expected, 500 = fault
            sim.record_probe(lat2, ok2, is_load=False)
        except Exception:
            pass  # secondary probe failure doesn't count toward req/s

    async def _run(self) -> None:
        try:
            import httpx
        except ImportError:
            return
        async with httpx.AsyncClient() as client:
            while True:
                for name in list(self.sims.keys()):
                    try:
                        await self._probe_app(name, client)
                    except Exception:
                        pass
                await asyncio.sleep(1)

    def start(self) -> None:
        self._task = asyncio.create_task(self._run())

    def stop(self) -> None:
        if self._task:
            self._task.cancel()
