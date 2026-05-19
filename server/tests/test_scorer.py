import pytest
from srebench.scorer import Scorer, IncidentResult


@pytest.fixture
def s(): return Scorer()


def test_perfect(s):
    r = IncidentResult(run_id="x", incident_id="T", detected=True, diagnosed=True, fixed=True, mttr_s=60)
    assert s.score(r) == 1.0


def test_detect_only(s):
    r = IncidentResult(run_id="x", incident_id="T", detected=True, mttr_s=0)
    assert s.score(r) == pytest.approx(0.2)


def test_detect_diagnose(s):
    r = IncidentResult(run_id="x", incident_id="T", detected=True, diagnosed=True, mttr_s=0)
    assert s.score(r) == pytest.approx(0.5)


def test_nothing(s):
    r = IncidentResult(run_id="x", incident_id="T", mttr_s=0)
    assert s.score(r) == 0.0


def test_mttr_penalty(s):
    r = IncidentResult(run_id="x", incident_id="T", detected=True, diagnosed=True, fixed=True, mttr_s=900)
    assert s.score(r) == pytest.approx(1.0 - 0.10, abs=0.001)


def test_never_negative(s):
    r = IncidentResult(run_id="x", incident_id="T", mttr_s=999999)
    assert s.score(r) >= 0.0
