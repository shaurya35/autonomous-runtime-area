import asyncio
import tempfile
from sentinel.adapters.runtime.base import Runtime
from sentinel.models import CommandResult, PatchResult


class DockerComposeRuntime(Runtime):
    def __init__(self, service: str, compose_file: str = "docker-compose.yml", project_dir: str = "."):
        self.service = service
        self.compose_file = compose_file
        self.project_dir = project_dir

    async def start(self) -> CommandResult:
        return await self._run(f"docker compose -f {self.compose_file} up -d {self.service}")

    async def stop(self) -> CommandResult:
        return await self._run(f"docker compose -f {self.compose_file} stop {self.service}")

    async def restart(self) -> CommandResult:
        return await self._run(f"docker compose -f {self.compose_file} restart {self.service}")

    async def exec(self, cmd: str, timeout: int = 30) -> CommandResult:
        return await self._run(
            f"docker compose -f {self.compose_file} exec -T {self.service} sh -c '{cmd}'",
            timeout=timeout)

    async def apply_patch(self, file_path: str, diff_text: str) -> PatchResult:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".patch", delete=False) as f:
            f.write(diff_text)
            patch_file = f.name
        result = await self._run(f"patch -p1 {file_path} < {patch_file}")
        if result.returncode != 0:
            return PatchResult(success=False, error=result.stderr)
        restart = await self.restart()
        return PatchResult(success=True, restarted=(restart.returncode == 0))

    async def _run(self, cmd: str, timeout: int = 60) -> CommandResult:
        try:
            proc = await asyncio.create_subprocess_shell(
                cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                cwd=self.project_dir)
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            return CommandResult(returncode=proc.returncode or 0,
                                  stdout=stdout.decode(errors="replace"),
                                  stderr=stderr.decode(errors="replace"))
        except asyncio.TimeoutError:
            return CommandResult(returncode=-1, stdout="", stderr="timeout", timed_out=True)
        except Exception as e:
            return CommandResult(returncode=-1, stdout="", stderr=str(e))
