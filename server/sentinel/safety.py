import shlex
from pathlib import Path


SHELL_CONTROL_TOKENS = {
    ";", "&&", "||", "|", ">", ">>", "<", "$(", "`", "\n", "\r",
}


def safe_join(root: Path, rel: str) -> Path | None:
    """Resolve rel under root, rejecting sibling-prefix path escapes."""
    root_resolved = root.resolve()
    try:
        candidate = (root_resolved / rel).resolve()
        candidate.relative_to(root_resolved)
        return candidate
    except Exception:
        return None


def validate_agent_command(cmd: str, allowed: set[str]) -> tuple[bool, str, list[str]]:
    """Validate an LLM-supplied command before any shell receives it."""
    stripped = cmd.strip()
    if not stripped:
        return False, "empty command", []
    if any(token in stripped for token in SHELL_CONTROL_TOKENS):
        return False, "shell control operators are not allowed", []
    try:
        parts = shlex.split(stripped)
    except ValueError as e:
        return False, f"invalid command quoting: {e}", []
    if not parts:
        return False, "empty command", []
    executable = parts[0].lower()
    if executable not in allowed:
        return False, f"command not allowed: '{executable}'", parts
    if executable == "git" and len(parts) > 1 and parts[1] not in {"status", "log", "diff", "show"}:
        return False, "only read-only git commands are allowed", parts
    return True, "", parts
