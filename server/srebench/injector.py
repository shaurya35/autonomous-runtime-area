import asyncio
import re
from pathlib import Path
from srebench.schema import IncidentSpec, AppManifest
from sentinel.tools.patch import _apply_unified_diff


class Injector:
    def __init__(self, manifest: AppManifest, repo_root: Path):
        self.manifest = manifest
        self.repo_root = repo_root.resolve()
        self._original_env_files: dict[Path, str | None] = {}

    @property
    def _app_dir(self) -> Path:
        # source_root is e.g. "apps/rust/src" — app dir is its parent
        return (self.repo_root / self.manifest.source_root).parent

    async def inject(self, incident: IncidentSpec) -> bool:
        needs_restart = False
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
                needs_restart = True
            elif step.type == "runtime_fault" and step.command:
                await self._run(step.command)
        if needs_restart:
            await self._restart_app(incident.app)
        return True

    async def reset(self, incident: IncidentSpec):
        """Restore injected files via git checkout."""
        for step in incident.inject:
            if step.type == "code_change" and step.file:
                target = self._app_dir / step.file
                rel = target.resolve().relative_to(self.repo_root)
                proc = await asyncio.create_subprocess_exec(
                    "git", "checkout", "HEAD", "--", str(rel),
                    cwd=str(self.repo_root),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                _stdout, stderr = await proc.communicate()
                if proc.returncode != 0:
                    raise RuntimeError(
                        f"git restore failed for {rel}: {stderr.decode(errors='replace')}"
                    )
            elif step.type == "config_change" and step.env_var:
                env_path = self._env_path()
                original = self._original_env_files.get(env_path)
                if original is None:
                    if env_path.exists():
                        env_path.unlink()
                else:
                    env_path.write_text(original)

    async def _set_env(self, key: str, value: str):
        env_path = self._env_path()
        if env_path not in self._original_env_files:
            self._original_env_files[env_path] = env_path.read_text() if env_path.exists() else None
        content = env_path.read_text() if env_path.exists() else ""
        pattern = re.compile(rf"^{re.escape(key)}=.*$", re.MULTILINE)
        content = (pattern.sub(f"{key}={value}", content)
                   if pattern.search(content) else content + f"\n{key}={value}\n")
        env_path.write_text(content)

    def _env_path(self) -> Path:
        return self._app_dir / ".env"

    async def _restart_app(self, service: str):
        """Restart the docker-compose service so it picks up injected config changes."""
        await self._run(f"docker compose restart {service}")
        await asyncio.sleep(3)  # brief pause for service to come up on new config

    async def _run(self, cmd: str):
        proc = await asyncio.create_subprocess_shell(cmd, cwd=str(self.repo_root))
        await proc.wait()
