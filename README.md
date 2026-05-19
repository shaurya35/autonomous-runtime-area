# SREBench

An app-agnostic SRE benchmark platform. Drop any containerised app into `./apps/<name>/` with a `srebench.yaml` manifest, inject a fault, and an AI agent (Claude Sonnet 4.6) diagnoses and fixes it — scored end-to-end.

```
apps/rust/          ← shop-api patient app (Axum + SQLite)
server/             ← Sentinel agent + eval harness (FastAPI + Python 3.13)
client/             ← Dashboard (Next.js 16 + React 19)
docs/               ← Architecture, incident spec, agent design
```

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| `uv` | any | installed by `make setup` |
| Python | 3.13 | installed by `make setup` via uv |
| `bun` | ≥ 1.0 | `curl -fsSL https://bun.sh/install \| bash` |
| `cargo` | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |

---

## Quickstart

### 1 — Clone and set up

```bash
git clone <repo>
cd autonomous-runtime-area

make setup          # installs uv, Python 3.13, server deps, bun deps (~2 min first run)
cp .env.example .env
```

Edit `.env` and set your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 2 — Start everything

```bash
make dev
```

This runs the backend and dashboard in parallel:

| Service | URL |
|---|---|
| Sentinel API | http://localhost:8000 |
| Dashboard | http://localhost:3000 |

> **Note:** `make dev` requires two terminal tabs if your shell doesn't support `make -j2`.  
> Run `make server` in one tab and `make client` in the other.

### 3 — Verify it's working

```bash
curl http://localhost:8000/health
# {"status":"ok","has_sentinel":true}

curl http://localhost:8000/apps
# [{"name":"shop-api",...}]
```

Open http://localhost:3000 — you'll see the `shop-api` listed.

---

## Running an incident

Start the shop-api Rust app first (it needs to be running for the agent to probe it):

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

---

## Available incidents

| ID | Difficulty | Title |
|---|---|---|
| SRE-0001 | easy | Login crashes on missing password (`unwrap()` panic) |
| SRE-0003 | easy | Wrong port number in config |
| SRE-0006 | easy | `/products` pagination off-by-one (skips first item) |
| SRE-0013 | medium | Connection pool exhausted under moderate load |
| SRE-0020 | hard | Async task starvation (blocking call inside `tokio::spawn`) |

Full assignments and spec format: [`docs/INCIDENT_ASSIGNMENT.md`](docs/INCIDENT_ASSIGNMENT.md), [`docs/INCIDENT_SPEC.md`](docs/INCIDENT_SPEC.md)

---

## Running tests

```bash
make test           # all suites

make test-server    # Python server tests (33 tests)
make test-rust      # Rust shop-api integration tests (5 tests)
```

---

## Project layout

```
.
├── .env.example            # copy to .env
├── Makefile                # all dev commands
├── docker-compose.yml      # production stack
│
├── apps/
│   └── rust/               # shop-api patient app
│       ├── src/            # Axum handlers, routes, auth, DB
│       ├── migrations/     # SQLite schema + seed data
│       ├── incidents/      # SRE-NNNN.yaml fault specs
│       ├── srebench.yaml   # platform manifest (signals, commands)
│       └── Cargo.toml
│
├── server/                 # Sentinel platform
│   ├── main.py             # FastAPI: /apps, /incidents, SSE stream
│   ├── sentinel/
│   │   ├── agent.py        # ReAct loop (Claude Sonnet 4.6)
│   │   ├── channel.py      # IncidentChannel — JSONL + SSE
│   │   ├── manifest.py     # srebench.yaml loader
│   │   ├── tools/          # 9 agent tools (logs, code, patch, tests)
│   │   ├── adapters/       # log/metrics/health/runtime backends
│   │   └── prompts/        # system prompt + phase examples
│   ├── srebench/
│   │   ├── schema.py       # IncidentSpec pydantic models
│   │   ├── scorer.py       # 0.2·detect + 0.3·diagnose + 0.5·fix
│   │   ├── runner.py       # CLI: srebench run / inject / score
│   │   └── injector.py     # applies inject patches from spec
│   └── tests/
│       ├── fixtures/sample-app/    # Flask fixture for platform CI
│       └── test_*.py
│
├── client/                 # Next.js 16 dashboard
│   └── src/
│       ├── app/            # routes: / /apps/[name] /incidents/[id] /leaderboard
│       ├── components/     # PhaseTimeline, EvidencePanel, IncidentScore, AppCard
│       └── lib/            # api.ts, sse.ts (EventSource hook)
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── AGENT_DESIGN.md
│   ├── APP_MANIFEST_SPEC.md    # how to register a new app
│   ├── INCIDENT_SPEC.md        # how to write a fault spec
│   └── INCIDENT_ASSIGNMENT.md  # team assignments
│
├── evidence/               # per-run JSONL audit trails (git-ignored)
└── results/                # per-run JSON scores (git-ignored)
```

---

## Adding a new app

1. Create `apps/<name>/srbench.yaml` — see [`docs/APP_MANIFEST_SPEC.md`](docs/APP_MANIFEST_SPEC.md)
2. Restart the backend (`make server`) — it auto-discovers `apps/*/srebench.yaml`
3. Write incident specs under `apps/<name>/incidents/SRE-NNNN.yaml`

No platform code changes required.

---

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full diagram. Short version:

```
patient app  →  adapters (logs/metrics/health)
                     ↓
             SentinelAgent (ReAct, Claude Sonnet 4.6)
             9 tools, phase-tagged emissions
                     ↓
             IncidentChannel (JSONL + SSE)
                     ↓
             Scorer (0.2·D + 0.3·Dx + 0.5·F − MTTR penalty)
                     ↓
             Dashboard (live phase timeline)
```

Scoring: **1.0** = agent detected, diagnosed, fixed, and verified in under 5 minutes.
