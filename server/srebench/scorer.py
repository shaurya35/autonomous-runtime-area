import asyncio
from pydantic import BaseModel


class IncidentResult(BaseModel):
    run_id: str
    incident_id: str
    detected: bool = False
    diagnosed: bool = False
    fixed: bool = False
    mttr_s: float = 0.0
    score: float = 0.0
    phases_reached: list[str] = []
    pre_tests_passed: bool | None = None
    post_tests_passed: bool | None = None


class Scorer:
    WEIGHTS = {"detected": 0.2, "diagnosed": 0.3, "fixed": 0.5}
    BASELINE_MINUTES = 5.0
    PENALTY_PER_MINUTE = 0.01

    def score(self, result: IncidentResult) -> float:
        raw = sum(self.WEIGHTS[k] * getattr(result, k) for k in self.WEIGHTS)
        extra = max(0.0, (result.mttr_s / 60) - self.BASELINE_MINUTES)
        return max(0.0, round(raw - extra * self.PENALTY_PER_MINUTE, 4))

    async def run_tests(self, cmds: list[str], timeout: int = 30) -> bool:
        for cmd in cmds:
            proc = await asyncio.create_subprocess_shell(
                cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            try:
                await asyncio.wait_for(proc.communicate(), timeout=timeout)
                if proc.returncode != 0:
                    return False
            except asyncio.TimeoutError:
                return False
        return True
