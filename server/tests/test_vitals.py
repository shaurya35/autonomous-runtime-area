import time

from sentinel.vitals import VitalSimulator


def test_baseline_stable():
    s1 = VitalSimulator("test-app", seed=42)
    s2 = VitalSimulator("test-app", seed=42)
    ts = time.time()
    assert s1.sample(ts) == s2.sample(ts)


def test_inject_raises_errors():
    sim = VitalSimulator("test", seed=1)
    sim.injected = True
    samples = [sim.sample(time.time() + i) for i in range(10)]
    assert all(s["error_rate_pct"] >= 1.0 for s in samples)


def test_heal_restores():
    sim = VitalSimulator("test", seed=2)
    sim.injected = True
    sim.injected = False
    samples = [sim.sample(time.time() + i) for i in range(10)]
    assert all(s["error_rate_pct"] < 5.0 for s in samples)


def test_within_bounds():
    sim = VitalSimulator("test", seed=3)
    for i in range(100):
        s = sim.sample(time.time() + i)
        assert s["req_per_sec"] >= 0
        assert s["p99_latency_ms"] >= 0
        assert 0 <= s["cpu_pct"] <= 100
        assert s["error_rate_pct"] >= 0
