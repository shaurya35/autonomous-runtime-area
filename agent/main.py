"""Sentinel Agent sidecar.

Runs inside the user's docker-compose stack. Connects outbound to the
Sentinel server over WebSocket, authenticates with the workspace api_key,
then:
  - sends a heartbeat every 10s (health probe + vitals scrape)
  - listens for tool_call messages from the server and executes them locally
  - streams events back through the WebSocket

Required env:
  SENTINEL_KEY        workspace api_key (wskey_...)
  SENTINEL_API_URL    server base URL, e.g. ws://sentinel.sh (or ws://localhost:8000)

Optional env:
  HEALTH_URL          e.g. http://localhost:8080/healthz
  METRICS_URL         e.g. http://localhost:8080/metrics
  LOGS_SERVICE        docker-compose service name for log tailing
  REPO_PATH           where the user's code lives (default /workspace)
  RESTART_TARGET      docker-compose service to restart after a patch
"""
import asyncio
import json
import logging
import os
import socket
import sys
from pathlib import Path

import websockets

import protocol as proto

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [sentinel-agent] %(levelname)s %(message)s",
)
log = logging.getLogger(__name__)

SENTINEL_KEY = os.environ.get("SENTINEL_KEY", "")
SENTINEL_API_URL = os.environ.get("SENTINEL_API_URL", "ws://localhost:8000")
HEALTH_URL = os.environ.get("HEALTH_URL", "http://localhost:8080/healthz")
METRICS_URL = os.environ.get("METRICS_URL", "http://localhost:8080/metrics")
LOGS_SERVICE = os.environ.get("LOGS_SERVICE", "app")
REPO_PATH = Path(os.environ.get("REPO_PATH", "/workspace"))
RESTART_TARGET = os.environ.get("RESTART_TARGET", "app")

# normalise: http(s) → ws(s) so users can pass either
WS_URL = (
    SENTINEL_API_URL
    .replace("https://", "wss://")
    .replace("http://", "ws://")
    .rstrip("/")
) + "/agent/connect"


def _build_registry() -> object:
    """Build a ToolRegistry using the sentinel tool + adapter modules."""
    # The Dockerfile copies server/sentinel into /app/sentinel.
    # We construct a minimal manifest-like dict so the factory can create adapters.
    from sentinel.adapters.factory import (
        make_health_probe, make_log_source, make_metric_source, make_runtime,
    )
    from sentinel.tools import ToolRegistry

    signals = {
        "logs": {"type": "docker", "service": LOGS_SERVICE},
        "metrics": {"type": "prometheus", "url": METRICS_URL},
        "health": {"type": "http", "url": HEALTH_URL, "expect_status": 200},
    }
    manifest_dict = {
        "name": "agent-app",
        "language": "unknown",
        "source_root": str(REPO_PATH),
        "signals": signals,
        "commands": {"test": "echo no-test"},
    }
    log_source = make_log_source(signals)
    metric_source = make_metric_source(signals)
    health_probe = make_health_probe(signals)
    runtime = make_runtime(manifest_dict, REPO_PATH)
    return ToolRegistry(manifest_dict, log_source, metric_source, health_probe, runtime, REPO_PATH)


async def _heartbeat(ws, health_probe, metric_source) -> None:
    while True:
        try:
            health = await health_probe.check()
            metrics = await metric_source.scrape()
            vitals = {
                s.name: s.points[-1].value if s.points else None
                for s in metrics[:10]
            }
            msg = proto.heartbeat(
                health={"ok": health.healthy, "latency_ms": health.latency_ms},
                vitals=vitals,
            )
            await ws.send(json.dumps(msg))
        except Exception as e:
            log.warning("heartbeat error: %s", e)
        await asyncio.sleep(10)


async def _tool_loop(ws, registry) -> None:
    async for raw in ws:
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            continue

        kind = msg.get("kind")

        if kind == "tool_call":
            req_id = msg["req_id"]
            tool_name = msg["tool_name"]
            args = msg.get("args", {})
            log.info("executing tool: %s %s", tool_name, args)
            try:
                result = await registry.execute(tool_name, args)
                response = proto.tool_response(req_id, result=result)
            except Exception as e:
                log.exception("tool %s raised", tool_name)
                response = proto.tool_response(req_id, error=f"{type(e).__name__}: {e}")
            await ws.send(json.dumps(response))

        elif kind == "apply_patch":
            req_id = msg.get("req_id") or msg["diff_id"]
            diff_id = msg["diff_id"]
            file = msg["file"]
            diff = msg["diff"]
            log.info("applying patch to %s (diff_id=%s)", file, diff_id)
            try:
                from sentinel.tools.patch import PatchTools
                pt = PatchTools(None, REPO_PATH)
                result = pt._apply_patch(file, diff)
                if result.get("success"):
                    # restart the target service
                    from sentinel.adapters.runtime.docker_compose import DockerComposeRuntime
                    rt = DockerComposeRuntime(service=RESTART_TARGET, project_dir="/workspace")
                    restart = await rt.restart()
                    result["restarted"] = restart.returncode == 0
                    if restart.returncode != 0:
                        result["success"] = False
                        result["restart_error"] = restart.stderr
                response = proto.tool_response(req_id, result=result)
            except Exception as e:
                log.exception("apply_patch failed")
                response = proto.tool_response(req_id, error=str(e))
            await ws.send(json.dumps(response))

        elif kind == "write_file":
            req_id = msg.get("req_id") or msg["diff_id"]
            diff_id = msg["diff_id"]
            file = msg["file"]
            content = msg["content"]
            log.info("writing file %s (diff_id=%s)", file, diff_id)
            try:
                from sentinel.tools.patch import PatchTools
                pt = PatchTools(None, REPO_PATH)
                result = pt._write_file(file, content)
                if result.get("success"):
                    from sentinel.adapters.runtime.docker_compose import DockerComposeRuntime
                    rt = DockerComposeRuntime(service=RESTART_TARGET, project_dir="/workspace")
                    restart = await rt.restart()
                    result["restarted"] = restart.returncode == 0
                    if restart.returncode != 0:
                        result["restart_error"] = restart.stderr
                response = proto.tool_response(req_id, result=result)
            except Exception as e:
                log.exception("write_file failed")
                response = proto.tool_response(req_id, error=str(e))
            await ws.send(json.dumps(response))

        elif kind == "restart":
            log.info("restart requested")
            try:
                from sentinel.adapters.runtime.docker_compose import DockerComposeRuntime
                rt = DockerComposeRuntime(service=RESTART_TARGET, project_dir="/workspace")
                await rt.restart()
                await ws.send(json.dumps(proto.tool_response("restart", result={"ok": True})))
            except Exception as e:
                await ws.send(json.dumps(proto.tool_response("restart", error=str(e))))

        elif kind == "pong":
            pass


async def run() -> None:
    if not SENTINEL_KEY:
        log.error("SENTINEL_KEY is not set. Set it to your workspace api_key (wskey_...).")
        sys.exit(1)

    registry = _build_registry()
    from sentinel.adapters.factory import make_health_probe, make_metric_source
    signals = {
        "logs": {"type": "docker", "service": LOGS_SERVICE},
        "metrics": {"type": "prometheus", "url": METRICS_URL},
        "health": {"type": "http", "url": HEALTH_URL, "expect_status": 200},
    }
    health_probe = make_health_probe(signals)
    metric_source = make_metric_source(signals)

    backoff = 1
    while True:
        try:
            log.info("connecting to %s", WS_URL)
            async with websockets.connect(
                WS_URL,
                additional_headers={"Authorization": f"Bearer {SENTINEL_KEY}"},
                ping_interval=20,
                ping_timeout=10,
            ) as ws:
                log.info("connected — sending hello")
                await ws.send(json.dumps(proto.hello(
                    api_key=SENTINEL_KEY,
                    hostname=socket.gethostname(),
                )))
                backoff = 1
                await asyncio.gather(
                    _heartbeat(ws, health_probe, metric_source),
                    _tool_loop(ws, registry),
                )
        except Exception as e:
            log.warning("disconnected: %s — reconnecting in %ds", e, backoff)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60)


if __name__ == "__main__":
    asyncio.run(run())
