from pathlib import Path


class PatchTools:
    def __init__(self, runtime, source_root: Path):
        self._runtime = runtime
        self._root = source_root.resolve()

    def definitions(self) -> list[dict]:
        return [{
            "name": "propose_patch",
            "description": "Apply a unified diff patch to a source file, then restart the app. Always read the file first.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "file": {"type": "string", "description": "File path relative to source root"},
                    "unified_diff": {"type": "string", "description": "Unified diff to apply"},
                },
                "required": ["file", "unified_diff"],
            },
        }]

    async def execute(self, name: str, inputs: dict) -> dict:
        if name == "propose_patch":
            resolved = (self._root / inputs.get("file", "")).resolve()
            if not str(resolved).startswith(str(self._root)):
                return {"success": False, "error": "path escapes source root"}
            result = await self._runtime.apply_patch(str(resolved), inputs.get("unified_diff", ""))
            return result.model_dump()
        return {"error": f"unknown: {name}"}
