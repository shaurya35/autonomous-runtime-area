import json
import re
import time
from pathlib import Path
from typing import Callable, Awaitable

from anthropic import Anthropic

from sentinel.channel import IncidentChannel, Phase
from sentinel.policy import Policy


class SentinelAgent:
    MAX_ITERATIONS = 30

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

        for _ in range(self.MAX_ITERATIONS):
            response = self.client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=4096,
                system=self._system,
                tools=self.tools,
                messages=messages,
            )

            messages.append({"role": "assistant", "content": response.content})

            for block in response.content:
                if hasattr(block, "text") and block.text.strip():
                    m = re.search(r"<phase>(detecting|diagnosing|fixing|verifying)</phase>", block.text)
                    if m:
                        current_phase = m.group(1)
                        phases_reached.add(current_phase)
                    self.channel.emit(current_phase, "thought", {"text": block.text})

            if response.stop_reason == "end_turn":
                self.channel.emit("done", "summary", {
                    "phases_reached": list(phases_reached),
                    "mttr_s": time.time() - start_time,
                })
                break

            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    if not self.policy.allow(block.name):
                        result = {"error": f"action '{block.name}' denied by policy"}
                    else:
                        self.channel.emit(current_phase, "tool_call",
                                          {"tool": block.name, "input": block.input})
                        result = await tool_executor(block.name, block.input)
                        self.channel.emit(current_phase, "tool_result",
                                          {"tool": block.name, "result": result})
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result),
                    })

            if tool_results:
                messages.append({"role": "user", "content": tool_results})

        return {"phases_reached": list(phases_reached), "mttr_s": time.time() - start_time}
