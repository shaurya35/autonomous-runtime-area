# Architecture

## Overview

SREBench is an **app-agnostic SRE benchmark platform**. Drop any containerised app into `./apps/<name>/` with a `srebench.yaml` manifest, and the platform can inject faults, run an AI agent to diagnose and fix them, and score the result. No platform code changes required per new app.

```
┌──────────────────────────────────────────────────────────────────────┐
│                       docker compose stack                            │
│                                                                       │
│   ./apps/<any>/             ┌──────────────────────────────────────┐ │
│   ┌──────────────┐  signals │   server/  (sentinel platform)       │ │
│   │ patient app  │ ────────▶│                                       │ │
│   │ any language │          │   ingest layer                        │ │
│   │ srebench.yaml│          │   LogSource / MetricSource / Health   │ │
│   └──────┬───────┘          │          │                            │ │
│          ▲                  │          ▼                            │ │
│          │ patches          │   SentinelAgent (ReAct loop)          │ │
│          │ restarts         │   claude-sonnet-4-6                   │ │
│          │                  │   9 tools, phase-tagged               │ │
│          │                  │          │                            │ │
│          └──────────────────│   IncidentChannel                     │ │
│            runtime adapter  │   evidence/<id>.jsonl + SSE fan-out  │ │
│                             │          │                            │ │
│                             │   Scorer (0.2D + 0.3Dx + 0.5F)       │ │
│                             │   results/<id>.json                   │ │
│                             └────────────────┬─────────────────────┘ │
│                                              │ SSE                   │
│                                              ▼                       │
│                             ┌────────────────────────────────────┐  │
│                             │   client/ (Next.js dashboard)      │  │
│                             │   live phase timeline + scoreboard │  │
│                             └────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

## Components

### `server/sentinel/` — The platform

| Module | Responsibility |
|---|---|
| `manifest.py` | Load and validate `srebench.yaml`; `discover_apps()` scans `./apps/*/` |
| `agent.py` | ReAct loop: calls Claude, extracts `<phase>` tags, dispatches tool calls |
| `channel.py` | `IncidentChannel` — append-only JSONL + asyncio queue for SSE |
| `tools/` | 9 curated tools bound to an `AppManifest` at runtime |
| `adapters/` | Pluggable signal backends (docker logs, Prometheus, HTTP health) |
| `policy.py` | Tool call allow-list (stub; returns True for all in MVP) |
| `prompts/` | System prompt and phase-tag few-shot examples |

### `server/srebench/` — Eval harness

| Module | Responsibility |
|---|---|
| `schema.py` | Pydantic models for `IncidentSpec`, `ChannelEvent`, `Phase` |
| `runner.py` | Typer CLI: `srebench run`, `inject`, `score`, `load-test` |
| `injector.py` | Applies the `inject` stanza from an incident YAML |
| `scorer.py` | `0.2·detect + 0.3·diagnose + 0.5·fix` minus MTTR penalty |
| `load_test.py` | Synthetic traffic against `endpoints` from the manifest |

### `client/` — Dashboard

Next.js 16 App Router. All components are app-agnostic — they render whatever comes out of `IncidentChannel`.

| Route | Purpose |
|---|---|
| `/` | Apps list + recent incidents |
| `/apps/[name]` | Per-app health, logs, metrics |
| `/incidents/[id]` | Live SSE phase timeline + evidence panel |
| `/leaderboard` | Score grid across all apps and incidents |

## Data flow for a single incident run

1. `POST /incidents/start {app, incident_id}` — server returns `run_id`
2. Background task: loads manifest + incident YAML, creates `IncidentChannel`
3. Agent loop begins: receives alert brief, calls tools, emits phase-tagged events
4. Each tool call → `IncidentChannel.emit()` → appends to `evidence/<run_id>.jsonl` + pushes to SSE queue
5. Dashboard subscribes to `GET /incidents/<run_id>/stream` (SSE) and renders events into phase lanes
6. Agent emits `propose_patch` → `PatchTools` applies unified diff to `source_root`, calls `commands.restart`
7. Agent calls `run_tests` → `ExecTools` runs `commands.test`, returns pass/fail
8. Loop exits when tests pass or max turns reached
9. Scorer reads `phases_reached` from channel events → writes `results/<run_id>.json`

## App-agnosticism guarantee

The agent's 9 tools take **no service name parameter** — they are bound to one `AppManifest` at incident-start time. The agent never knows it's operating on Rust vs Python vs Go. All language-specific behaviour is in the manifest's `commands` and `signals` fields, authored by the app owner.

Adding a new app = write `apps/<name>/srebench.yaml`. Zero platform code changes.

## Evidence format

`evidence/<run_id>.jsonl` — one JSON object per line:

```json
{"ts": "2026-05-14T10:00:01Z", "phase": "detecting", "type": "tool_call", "payload": {"tool": "read_logs", "inputs": {"since_seconds": 60}}}
{"ts": "2026-05-14T10:00:02Z", "phase": "detecting", "type": "tool_result", "payload": {"logs": [...]}}
{"ts": "2026-05-14T10:00:10Z", "phase": "diagnosing", "type": "tool_call", "payload": {"tool": "read_file", "inputs": {"path": "src/routes/auth.rs"}}}
```

This file is the audit trail, SSE source, postmortem doc, and future training data.
