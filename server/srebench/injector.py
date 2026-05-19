import asyncio
import re
import tempfile
from pathlib import Path
from srebench.schema import IncidentSpec, AppManifest


class Injector:
    def __init__(self, manifest: AppManifest, repo_root: Path):
        self.manifest = manifest
        self.repo_root = repo_root

    async def inject(self, incident: IncidentSpec) -> bool:
        for step in incident.inject:
            if step.type == "code_change" and step.file and step.diff:
                await self._apply_diff(self.repo_root / step.file, step.diff)
            elif step.type == "config_change" and step.env_var:
                await self._set_env(step.env_var, step.value or "")
            elif step.type == "runtime_fault" and step.command:
                await self._run(step.command)
        return True

    async def reset(self, incident: IncidentSpec):
        for step in incident.inject:
            if step.type == "code_change" and step.file:
                await self._run(f"git checkout HEAD -- {self.repo_root / step.file}")

    async def _apply_diff(self, target: Path, diff: str):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".patch", delete=False) as f:
            f.write(diff)
            f.flush()
            proc = await asyncio.create_subprocess_shell(
                f"patch -p1 {target} < {f.name}",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            await proc.communicate()

    async def _set_env(self, key: str, value: str):
        env_path = Path(self.manifest.source_root) / ".env"
        content = env_path.read_text() if env_path.exists() else ""
        pattern = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
        content = pattern.sub(f"{key}={value}", content) if pattern.search(content) else content + f"\n{key}={value}\n"
        env_path.write_text(content)

    async def _run(self, cmd: str):
        proc = await asyncio.create_subprocess_shell(cmd)
        await proc.wait()
