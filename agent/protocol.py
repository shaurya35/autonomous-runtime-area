"""Wire protocol message types between the Sentinel agent and server.

All messages are JSON objects with a required "kind" field.

agent → server:
  hello          Initial handshake. Carries api_key.
  heartbeat      Periodic health + vitals snapshot (every 10s).
  tool_response  Result of a server-issued tool_call.
  event          Mirrors a sentinel.channel.ChannelEvent payload.

server → agent:
  tool_call      Ask the agent to execute a tool and send back tool_response.
  apply_patch    Agent should write a previously-negotiated diff and restart.
  write_file     Agent should write previously-approved full file content and restart.
  restart        Agent should restart the target service.
  pong           Response to a heartbeat (used to measure latency).
"""
from __future__ import annotations

from typing import Any


def hello(api_key: str, hostname: str, agent_version: str = "0.1.0") -> dict:
    return {"kind": "hello", "api_key": api_key, "hostname": hostname, "agent_version": agent_version}


def heartbeat(health: dict, vitals: dict) -> dict:
    return {"kind": "heartbeat", "health": health, "vitals": vitals}


def tool_response(req_id: str, result: Any = None, error: str | None = None) -> dict:
    msg: dict = {"kind": "tool_response", "req_id": req_id}
    if error is not None:
        msg["error"] = error
    else:
        msg["result"] = result
    return msg


def event(phase: str, type: str, payload: dict) -> dict:
    return {"kind": "event", "phase": phase, "type": type, "payload": payload}


# server → agent
def tool_call(req_id: str, tool_name: str, args: dict) -> dict:
    return {"kind": "tool_call", "req_id": req_id, "tool_name": tool_name, "args": args}


def apply_patch(diff_id: str, file: str, diff: str) -> dict:
    return {"kind": "apply_patch", "diff_id": diff_id, "file": file, "diff": diff}


def write_file(diff_id: str, file: str, content: str) -> dict:
    return {"kind": "write_file", "diff_id": diff_id, "file": file, "content": content}


def restart() -> dict:
    return {"kind": "restart"}
