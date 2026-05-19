import math
import random
import time


class VitalSimulator:
    """Generates plausible vitals using sinusoidal baselines + Gaussian noise."""

    def __init__(self, app_name: str, seed: int | None = None):
        self.app_name = app_name
        self.rng = random.Random(seed or hash(app_name))
        self.baseline_rps    = self.rng.uniform(50, 200)
        self.baseline_p99    = self.rng.uniform(30, 80)
        self.baseline_err    = 0.0
        self.baseline_cpu    = self.rng.uniform(20, 50)
        self.injected = False

    def sample(self, ts: float) -> dict:
        period_s = 60.0
        phase = (ts % period_s) / period_s * 2 * math.pi
        rps_mod   = 1.0 + 0.2 * math.sin(phase)
        p99_mod   = 1.0 + 0.15 * math.sin(phase + 0.5)
        cpu_mod   = 1.0 + 0.1  * math.sin(phase + 1.0)

        noise = lambda: self.rng.gauss(0, 0.05)

        rps = max(0, self.baseline_rps * rps_mod * (1 + noise()))
        p99 = max(0, self.baseline_p99 * p99_mod * (1 + noise()))
        cpu = max(0, min(100, self.baseline_cpu * cpu_mod * (1 + noise())))
        err = max(0, self.baseline_err + noise() * 0.1)

        if self.injected:
            err = min(20.0, err + 5.0 + abs(noise()) * 10)
            p99 *= 3
            rps *= 0.3

        return {
            "ts": ts,
            "req_per_sec":    round(rps, 2),
            "p99_latency_ms": round(p99, 1),
            "error_rate_pct": round(err, 3),
            "cpu_pct":        round(cpu, 1),
        }
