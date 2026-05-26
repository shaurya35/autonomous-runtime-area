import json
import re
import time
from pathlib import Path
from typing import Callable, Awaitable

from anthropic import Anthropic

from sentinel.channel import IncidentChannel, Phase
from sentinel.policy import Policy

# Truncate tool result strings to keep context manageable
_MAX_TOOL_RESULT_CHARS = 4000


def _trim(result: dict) -> str:
    s = json.dumps(result)
    if len(s) <= _MAX_TOOL_RESULT_CHARS:
        return s
    # For known large fields, trim the content
    if "content" in result and isinstance(result["content"], str):
        trimmed = dict(result)
        trimmed["content"] = result["content"][:_MAX_TOOL_RESULT_CHARS] + "\n... [truncated]"
        return json.dumps(trimmed)
    if "logs" in result and isinstance(result["logs"], list):
        trimmed = dict(result)
        trimmed["logs"] = result["logs"][-50:]  # keep last 50 log lines
        trimmed["_truncated"] = True
        return json.dumps(trimmed)
    return s[:_MAX_TOOL_RESULT_CHARS] + "... [truncated]"


class SentinelAgent:
    MAX_ITERATIONS = 25

    def __init__(self, tools: list[dict], channel: IncidentChannel, policy: Policy | None = None):
        self.client = Anthropic()
        self.tools = tools
        self.channel = channel
        self.policy = policy or Policy()
        prompts_dir = Path(__file__).parent / "prompts"
        self._system = (prompts_dir / "system.md").read_text()

    async def run(
        self,
        incident_brief: str,
        tool_executor: Callable[[str, dict], Awaitable[dict]],
    ) -> dict:
        messages = [{"role": "user", "content": incident_brief}]
        start_time = time.time()
        phases_reached: set[str] = set()
        current_phase: Phase = "detecting"

        # Cache the system prompt — stays static for the whole run
        system_with_cache = [
            {
                "type": "text",
                "text": self._system,
                "cache_control": {"type": "ephemeral"},
            }
        ]

        for iteration in range(self.MAX_ITERATIONS):
            # Cache the tools list on first call; cache the growing message history
            # by marking the last user message as ephemeral after turn 2
            extra_headers = {"anthropic-beta": "prompt-caching-2024-07-31"}

            try:
                response = self.client.messages.create(
                    model="claude-sonnet-4-6",
                    max_tokens=2048,
                    system=system_with_cache,
                    tools=self.tools,
                    messages=messages,
                    extra_headers=extra_headers,
                )
            except Exception as e:
                self.channel.emit("failed", "error", {
                    "text": f"anthropic request failed: {type(e).__name__}: {e}",
                    "recoverable": False,
                })
                return {
                    "status": "failed",
                    "error": "anthropic_request_failed",
                    "phases_reached": list(phases_reached),
                    "mttr_s": round(time.time() - start_time, 1),
                }

            messages.append({"role": "assistant", "content": response.content})

            for block in response.content:
                if hasattr(block, "text") and block.text.strip():
                    m = re.search(r"<phase>(detecting|diagnosing|fixing|verifying)</phase>", block.text)
                    if m:
                        current_phase = m.group(1)
                        phases_reached.add(current_phase)
                    self.channel.emit(current_phase, "thought", {"text": block.text})

            if response.stop_reason == "end_turn":
                mttr_s = round(time.time() - start_time, 1)
                self.channel.emit("done", "summary", {
                    "phases_reached": list(phases_reached),
                    "mttr_s": mttr_s,
                })
                return {
                    "status": "done",
                    "phases_reached": list(phases_reached),
                    "mttr_s": mttr_s,
                }

            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    if not self.policy.allow(block.name):
                        result = {"error": f"action '{block.name}' denied by policy"}
                    else:
                        self.channel.emit(current_phase, "tool_call",
                                          {"tool": block.name, "input": block.input})
                        try:
                            result = await tool_executor(block.name, block.input)
                        except Exception as e:
                            result = {
                                "error": f"{type(e).__name__}: {e}",
                                "recoverable": True,
                            }
                        self.channel.emit(current_phase, "tool_result",
                                          {"tool": block.name, "result": result})
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": _trim(result),
                    })

            if tool_results:
                messages.append({"role": "user", "content": tool_results})

        self.channel.emit("failed", "error", {
            "text": f"agent exceeded {self.MAX_ITERATIONS} iterations without finishing",
            "reason": "max_iterations_exceeded",
            "recoverable": False,
        })
        return {
            "status": "failed",
            "error": "max_iterations_exceeded",
            "phases_reached": list(phases_reached),
            "mttr_s": round(time.time() - start_time, 1),
        }
