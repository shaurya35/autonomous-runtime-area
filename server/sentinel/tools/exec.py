ALLOWED = ["cargo", "pytest", "python", "curl", "ls", "cat", "grep", "find", "git diff", "git log", "docker"]


class ExecTools:
    def __init__(self, runtime, manifest_dict: dict):
        self._runtime = runtime
        self._test_cmd = manifest_dict.get("commands", {}).get("test", "pytest")

    def definitions(self) -> list[dict]:
        return [
            {
                "name": "run_command",
                "description": f"Run a whitelisted shell command in the app. Allowed prefixes: {ALLOWED}",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "cmd": {"type": "string"},
                        "timeout_seconds": {"type": "integer", "default": 30},
                    },
                    "required": ["cmd"],
                },
            },
            {
                "name": "run_tests",
                "description": "Run the app test suite. Optional test_name filters to a specific test.",
                "input_schema": {
                    "type": "object",
                    "properties": {"test_name": {"type": "string"}},
                    "required": [],
                },
            },
        ]

    async def execute(self, name: str, inputs: dict) -> dict:
        if name == "run_command":
            cmd = inputs.get("cmd", "")
            if not any(cmd.strip().lower().startswith(p) for p in ALLOWED):
                return {"error": f"command not allowed: '{cmd}'"}
            result = await self._runtime.exec(cmd, timeout=inputs.get("timeout_seconds", 30))
            return result.model_dump()
        elif name == "run_tests":
            test_name = inputs.get("test_name", "")
            cmd = self._test_cmd + (f" {test_name}" if test_name else "")
            result = await self._runtime.exec(cmd, timeout=120)
            return {**result.model_dump(), "passed": result.returncode == 0}
        return {"error": f"unknown: {name}"}
