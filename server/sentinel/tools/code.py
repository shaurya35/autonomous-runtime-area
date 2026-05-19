from pathlib import Path

MAX_FILES, MAX_LINES, MAX_MATCHES = 100, 300, 50


class CodeTools:
    def __init__(self, source_root: Path):
        self._root = source_root.resolve()

    def definitions(self) -> list[dict]:
        return [
            {
                "name": "list_files",
                "description": "List files in a directory relative to the app source root.",
                "input_schema": {
                    "type": "object",
                    "properties": {"directory": {"type": "string", "default": "."}},
                    "required": [],
                },
            },
            {
                "name": "read_file",
                "description": "Read a source file. Specify line range to focus on specific sections. Always read before patching.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "start_line": {"type": "integer", "default": 1},
                        "end_line": {"type": "integer"},
                    },
                    "required": ["path"],
                },
            },
            {
                "name": "search_code",
                "description": "Search for a pattern across source files. Returns file:line matches.",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "pattern": {"type": "string", "description": "Case-insensitive text to find"},
                        "glob": {"type": "string", "default": "**/*"},
                    },
                    "required": ["pattern"],
                },
            },
        ]

    def _safe(self, rel: str) -> Path | None:
        p = (self._root / rel).resolve()
        return p if str(p).startswith(str(self._root)) else None

    async def execute(self, name: str, inputs: dict) -> dict:
        if name == "list_files":
            t = self._safe(inputs.get("directory", "."))
            if t is None: return {"error": "path escapes source root"}
            if not t.exists(): return {"files": [], "error": f"not found: {inputs.get('directory')}"}
            files = [str(p.relative_to(self._root)) for p in t.rglob("*") if p.is_file()]
            return {"files": files[:MAX_FILES], "truncated": len(files) > MAX_FILES}

        elif name == "read_file":
            p = self._safe(inputs.get("path", ""))
            if p is None: return {"error": "path escapes source root"}
            if not p.exists(): return {"error": f"file not found: {inputs.get('path')}"}
            lines = p.read_text(errors="replace").splitlines()
            total = len(lines)
            start = max(0, inputs.get("start_line", 1) - 1)
            end = min(inputs.get("end_line", start + MAX_LINES), start + MAX_LINES, total)
            content = "\n".join(f"{i+start+1}: {l}" for i, l in enumerate(lines[start:end]))
            return {"content": content, "total_lines": total, "showing": f"{start+1}-{end}"}

        elif name == "search_code":
            pattern = inputs.get("pattern", "").lower()
            matches = []
            for p in self._root.glob(inputs.get("glob", "**/*")):
                if not p.is_file(): continue
                try:
                    for i, line in enumerate(p.read_text(errors="replace").splitlines(), 1):
                        if pattern in line.lower():
                            matches.append({"file": str(p.relative_to(self._root)), "line": i, "content": line.strip()})
                            if len(matches) >= MAX_MATCHES: return {"matches": matches, "truncated": True}
                except Exception: continue
            return {"matches": matches}
        return {"error": f"unknown: {name}"}
