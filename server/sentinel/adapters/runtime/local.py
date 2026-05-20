import asyncio
import subprocess
from pathlib import Path
from sentinel.adapters.runtime.base import Runtime
from sentinel.models import CommandResult, PatchResult


class LocalRuntime(Runtime):
    def __init__(self, app_dir: Path):
        self.app_dir = str(app_dir)

    async def start(self) -> CommandResult:
        return CommandResult(returncode=0, stdout="app managed externally", stderr="")

    async def stop(self) -> CommandResult:
        return CommandResult(returncode=0, stdout="app managed externally", stderr="")

    async def restart(self) -> CommandResult:
        return CommandResult(returncode=0, stdout="app managed externally", stderr="")

    async def exec(self, cmd: str, timeout: int = 30) -> CommandResult:
        try:
            proc = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.app_dir,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            return CommandResult(
                returncode=proc.returncode or 0,
                stdout=stdout.decode(errors="replace"),
                stderr=stderr.decode(errors="replace"),
            )
        except asyncio.TimeoutError:
            return CommandResult(returncode=-1, stdout="", stderr="timeout", timed_out=True)
        except Exception as e:
            return CommandResult(returncode=-1, stdout="", stderr=str(e))

    async def apply_patch(self, file_path: str, diff_text: str) -> PatchResult:
        import tempfile, os
        with tempfile.NamedTemporaryFile(mode="w", suffix=".patch", delete=False) as f:
            f.write(diff_text)
            patch_file = f.name
        try:
            result = await self.exec(f"patch -p1 < {patch_file}", timeout=30)
            return PatchResult(success=result.returncode == 0,
                               error=result.stderr if result.returncode != 0 else None)
        finally:
            os.unlink(patch_file)
