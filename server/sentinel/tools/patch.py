import re
from pathlib import Path
from sentinel.safety import safe_join


class PatchTools:
    def __init__(self, runtime, source_root: Path):
        self._runtime = runtime
        self._root = source_root.resolve()

    def definitions(self) -> list[dict]:
        return [
            {
                "name": "propose_patch",
                "description": (
                    "Apply a unified diff patch to a source file. "
                    "Always read_file first. File path is relative to source root."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "file": {"type": "string", "description": "File path relative to source root"},
                        "unified_diff": {"type": "string", "description": "Unified diff to apply"},
                    },
                    "required": ["file", "unified_diff"],
                },
            },
            {
                "name": "write_file",
                "description": (
                    "Overwrite a source file with new content. "
                    "Use when a patch is too complex. Always read_file first."
                ),
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "file": {"type": "string", "description": "File path relative to source root"},
                        "content": {"type": "string", "description": "Full new content of the file"},
                    },
                    "required": ["file", "content"],
                },
            },
        ]

    async def execute(self, name: str, inputs: dict) -> dict:
        if name == "propose_patch":
            result = self._apply_patch(inputs.get("file", ""), inputs.get("unified_diff", ""))
        elif name == "write_file":
            result = self._write_file(inputs.get("file", ""), inputs.get("content", ""))
        else:
            return {"error": f"unknown: {name}"}
        if result.get("success") and self._runtime is not None:
            try:
                restart = await self._runtime.restart()
                result["restarted"] = restart.returncode == 0
                if restart.returncode != 0:
                    result["restart_stderr"] = restart.stderr[:300]
            except Exception as e:
                result["restart_error"] = str(e)
        return result

    def _resolve(self, rel: str) -> Path | None:
        return safe_join(self._root, rel)

    def _write_file(self, file: str, content: str) -> dict:
        target = self._resolve(file)
        if target is None:
            return {"success": False, "error": "path escapes source root"}
        if not target.exists():
            return {"success": False, "error": f"file not found: {file}"}
        original = target.read_text()
        try:
            target.write_text(content)
        except Exception as e:
            target.write_text(original)
            return {"success": False, "error": f"write failed: {e}"}
        return {"success": True, "file": file}

    def _apply_patch(self, file: str, diff_text: str) -> dict:
        target = self._resolve(file)
        if target is None:
            return {"success": False, "error": "path escapes source root"}
        if not target.exists():
            return {"success": False, "error": f"file not found: {file}"}

        original = target.read_text()
        try:
            patched = _apply_unified_diff(original, diff_text)
        except Exception as e:
            return {"success": False, "error": f"patch failed: {e}"}

        try:
            target.write_text(patched)
        except Exception as e:
            target.write_text(original)
            return {"success": False, "error": f"write failed: {e}"}
        return {"success": True, "file": file}


def _apply_unified_diff(original: str, diff_text: str) -> str:
    """Apply a unified diff to source text. Handles git-style a/b prefixes."""
    orig_lines = original.splitlines(keepends=True)
    result = list(orig_lines)

    hunks = _parse_hunks(diff_text)
    if not hunks:
        raise ValueError("No hunks found in diff")

    offset = 0
    for hunk_start, removes, adds in hunks:
        # hunk_start is 1-based original line number
        start = hunk_start - 1 + offset

        # Find the hunk in result (fuzzy: allow ±3 lines drift)
        actual_start = _find_hunk(result, start, removes)
        if actual_start is None:
            raise ValueError(f"Cannot find hunk context near line {hunk_start}")

        result[actual_start:actual_start + len(removes)] = adds
        offset += len(adds) - len(removes)

    return "".join(result)


def _parse_hunks(diff_text: str):
    hunks = []
    current_start = None
    removes: list[str] = []
    adds: list[str] = []

    for line in diff_text.splitlines(keepends=True):
        m = re.match(r'^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@', line)
        if m:
            if current_start is not None:
                hunks.append((current_start, removes, adds))
            current_start = int(m.group(1))
            removes = []
            adds = []
        elif line.startswith('---') or line.startswith('+++'):
            continue
        elif line.startswith('-') and current_start is not None:
            removes.append(line[1:])
        elif line.startswith('+') and current_start is not None:
            adds.append(line[1:])
        elif line.startswith(' ') and current_start is not None:
            removes.append(line[1:])
            adds.append(line[1:])

    if current_start is not None:
        hunks.append((current_start, removes, adds))
    return hunks


def _find_hunk(lines: list[str], expected_start: int, removes: list[str]) -> int | None:
    if not removes:
        return expected_start
    # Try near expected_start first, then scan the whole file
    candidates = list(range(max(0, expected_start - 30), min(len(lines), expected_start + 30)))
    candidates += [i for i in range(len(lines)) if i not in set(candidates)]
    for pos in candidates:
        if pos + len(removes) > len(lines):
            continue
        if all(_line_eq(lines[pos + i], removes[i]) for i in range(len(removes))):
            return pos
    return None


def _line_eq(a: str, b: str) -> bool:
    return a.rstrip('\n') == b.rstrip('\n')
