import asyncio
import re
from pathlib import Path
from srebench.schema import IncidentSpec, AppManifest
from sentinel.tools.patch import _apply_unified_diff


class Injector:
    def __init__(self, manifest: AppManifest, repo_root: Path):
        self.manifest = manifest
        self.repo_root = repo_root

    @property
    def _app_dir(self) -> Path:
        # source_root is e.g. "apps/rust/src" — app dir is its parent
        return (self.repo_root / self.manifest.source_root).parent

    async def inject(self, incident: IncidentSpec) -> bool:
        for step in incident.inject:
            if step.type == "code_change" and step.file and step.diff:
                target = self._app_dir / step.file
                if not target.exists():
                    raise FileNotFoundError(f"inject target not found: {target}")
                original = target.read_text()
                patched = _apply_unified_diff(original, step.diff)
                target.write_text(patched)
            elif step.type == "config_change" and step.env_var:
                await self._set_env(step.env_var, step.value or "")
            elif step.type == "runtime_fault" and step.command:
                await self._run(step.command)
        return True

    async def reset(self, incident: IncidentSpec):
        """Restore injected files via git checkout."""
        for step in incident.inject:
            if step.type == "code_change" and step.file:
                target = self._app_dir / step.file
                proc = await asyncio.create_subprocess_shell(
                    f"git checkout HEAD -- {target}",
                    cwd=str(self.repo_root),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                await proc.communicate()

    async def _set_env(self, key: str, value: str):
        env_path = self.repo_root / self.manifest.source_root / ".env"
        content = env_path.read_text() if env_path.exists() else ""
        pattern = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
        content = (pattern.sub(f"{key}={value}", content)
                   if pattern.search(content) else content + f"\n{key}={value}\n")
        env_path.write_text(content)

    async def _run(self, cmd: str):
        proc = await asyncio.create_subprocess_shell(cmd, cwd=str(self.repo_root))
        await proc.wait()
