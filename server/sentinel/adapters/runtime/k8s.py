from sentinel.adapters.runtime.base import Runtime
from sentinel.models import CommandResult, PatchResult


class K8sRuntime(Runtime):
    """Stub — K8s runtime not yet implemented. Target: v2."""
    def _nyi(self): raise NotImplementedError("K8s runtime not yet implemented — target v2")
    async def start(self) -> CommandResult: self._nyi()
    async def stop(self) -> CommandResult: self._nyi()
    async def restart(self) -> CommandResult: self._nyi()
    async def exec(self, cmd: str, timeout: int = 30) -> CommandResult: self._nyi()
    async def apply_patch(self, file_path: str, diff_text: str) -> PatchResult: self._nyi()
