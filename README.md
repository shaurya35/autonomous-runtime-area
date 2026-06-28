# SREBench

An app agnostic SRE benchmark platform. Drop any containerised app into
`apps/<name>/` with a `srebench.yaml` manifest, inject a fault, and an AI agent
(Claude Sonnet 4.6) detects, diagnoses, and fixes it. The whole run is scored
from start to finish.

```
apps/rust/     shop-api patient app (Axum + SQLite)
server/        Sentinel agent and eval harness (FastAPI + Python 3.13)
client/        Dashboard (Next.js 16 + React 19)
docs/          Architecture, incident spec, and agent design
```

## How it works

1. A patient app runs with a known fault injected into it.
2. Adapters collect signals from the app (logs, metrics, health).
3. The Sentinel agent runs a ReAct loop with 9 tools to read logs, inspect
   code, write a patch, and run tests.
4. Every step is tagged by phase and streamed live over SSE.
5. The scorer grades the run and the dashboard shows the timeline.

```
patient app  ->  adapters (logs / metrics / health)
                      |
              Sentinel agent (ReAct, Claude Sonnet 4.6)
              9 tools, phase tagged output
                      |
              IncidentChannel (JSONL + SSE)
                      |
              Scorer (0.2 detect + 0.3 diagnose + 0.5 fix, minus MTTR penalty)
                      |
              Dashboard (live phase timeline)
```

A score of 1.0 means the agent detected, diagnosed, fixed, and verified the
fault in under 5 minutes.

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| `uv` | any | installed by `make setup` |
| Python | 3.13 | installed by `make setup` via uv |
| `bun` | 1.0 or newer | `curl -fsSL https://bun.sh/install \| bash` |
| `cargo` | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |

## Quickstart

### 1. Clone and set up

```bash
git clone <repo>
cd autonomous-runtime-area

make setup          # installs uv, Python 3.13, server deps, and bun deps
cp .env.example .env
```

Open `.env` and set your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Start everything

```bash
make dev
```

This runs the backend and dashboard together:

| Service | URL |
|---|---|
| Sentinel API | http://localhost:8000 |
| Dashboard | http://localhost:3000 |

If your shell does not support `make -j2`, run `make server` in one tab and
`make client` in another.

### 3. Check it is working

```bash
curl http://localhost:8000/health
# {"status":"ok","has_sentinel":true}

curl http://localhost:8000/apps
# [{"name":"shop-api",...}]
```

Open http://localhost:3000 and you should see `shop-api` listed.

## Running an incident

Start the shop-api app first. It needs to be running so the agent can probe it:

```bash
cd apps/rust
cp .env.example .env   # edit if needed
cargo run
# listening on 0.0.0.0:8080
```

Then trigger an incident from the repo root:

```bash
make run-incident APP=shop-api ID=SRE-0001
# returns: {"run_id":"abc12345","stream_url":"/incidents/abc12345/stream",...}
```

Watch the agent work live at `http://localhost:3000/incidents/abc12345`.

Score the result:

```bash
make score RUN=abc12345
```

## Available incidents

| ID | Difficulty | Title |
|---|---|---|
| SRE-0001 | easy | Login crashes on missing password (`unwrap()` panic) |
| SRE-0003 | easy | Wrong port number in config |
| SRE-0006 | easy | `/products` pagination off by one (skips first item) |
| SRE-0013 | medium | Connection pool exhausted under moderate load |
| SRE-0020 | hard | Async task starvation (blocking call inside `tokio::spawn`) |

See [`docs/INCIDENT_ASSIGNMENT.md`](docs/INCIDENT_ASSIGNMENT.md) and
[`docs/INCIDENT_SPEC.md`](docs/INCIDENT_SPEC.md) for the full list and the spec
format.

## Running tests

```bash
make test           # all suites

make test-server    # Python server tests
make test-rust      # Rust shop-api integration tests
```

## Adding a new app

1. Create `apps/<name>/srebench.yaml`. See
   [`docs/APP_MANIFEST_SPEC.md`](docs/APP_MANIFEST_SPEC.md).
2. Restart the backend with `make server`. It finds every
   `apps/*/srebench.yaml` on its own.
3. Add incident specs under `apps/<name>/incidents/SRE-NNNN.yaml`.

No platform code changes are needed.

## Project layout

```
.
├── .env.example            copy to .env
├── Makefile                all dev commands
├── docker-compose.yml      production stack
│
├── apps/
│   └── rust/               shop-api patient app
│       ├── src/            Axum handlers, routes, auth, DB
│       ├── migrations/     SQLite schema and seed data
│       ├── incidents/      SRE-NNNN.yaml fault specs
│       ├── srebench.yaml   platform manifest (signals, commands)
│       └── Cargo.toml
│
├── server/                 Sentinel platform
│   ├── main.py             FastAPI: /apps, /incidents, SSE stream
│   ├── sentinel/
│   │   ├── agent.py        ReAct loop (Claude Sonnet 4.6)
│   │   ├── channel.py      IncidentChannel (JSONL + SSE)
│   │   ├── manifest.py     srebench.yaml loader
│   │   ├── tools/          9 agent tools (logs, code, patch, tests)
│   │   ├── adapters/       log / metrics / health / runtime backends
│   │   └── prompts/        system prompt and phase examples
│   ├── srebench/
│   │   ├── schema.py       IncidentSpec pydantic models
│   │   ├── scorer.py       0.2 detect + 0.3 diagnose + 0.5 fix
│   │   ├── runner.py       CLI: srebench run / inject / score
│   │   └── injector.py     applies inject patches from spec
│   └── tests/
│
├── client/                 Next.js 16 dashboard
│   └── src/
│       ├── app/            routes: / /apps/[name] /incidents/[id] /leaderboard
│       ├── components/     PhaseTimeline, EvidencePanel, IncidentScore, AppCard
│       └── lib/            api.ts, sse.ts (EventSource hook)
│
├── docs/                   architecture and spec docs
├── evidence/               per run JSONL audit trails (git ignored)
└── results/                per run JSON scores (git ignored)
```

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full diagram.

## License

MIT. See [LICENSE](LICENSE).
