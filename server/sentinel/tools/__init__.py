from pathlib import Path
from sentinel.tools.signals import SignalTools
from sentinel.tools.code import CodeTools
from sentinel.tools.exec import ExecTools
from sentinel.tools.patch import PatchTools


class ToolRegistry:
    def __init__(self, manifest_dict: dict, log_source, metric_source, health_probe, runtime, repo_root: Path):
        source_root = Path(manifest_dict.get("source_root", "."))
        self._signals = SignalTools(log_source, metric_source, health_probe)
        self._code = CodeTools(source_root)
        self._exec = ExecTools(runtime, manifest_dict)
        self._patch = PatchTools(runtime, source_root)
        self._all = [self._signals, self._code, self._exec, self._patch]

    def definitions(self) -> list[dict]:
        defs = []
        for group in self._all:
            defs.extend(group.definitions())
        return defs

    async def execute(self, name: str, inputs: dict) -> dict:
        dispatch = {}
        for group in self._all:
            for d in group.definitions():
                dispatch[d["name"]] = group
        handler = dispatch.get(name)
        if not handler:
            return {"error": f"unknown tool: {name}"}
        return await handler.execute(name, inputs)
