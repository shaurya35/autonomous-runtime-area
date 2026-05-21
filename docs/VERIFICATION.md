# Sentinel — End-to-End Verification Plan

## Context

The Phase 1–6 implementation just landed in the working tree (uncommitted, applied from `~/Downloads/sentinelpatch.diff`). The whole point of the last cycle was to make `make dev` work first try — to eliminate the 20-iteration loop. So before we commit, we need to *systematically* verify the system works at every layer.

The strategy is **layered checks**: each layer isolates one category of failure. When something breaks, we know exactly which layer to debug. We never run a 90-second E2E test to discover the actual problem was a missing dependency.

Verification order (cheapest first, run them in this order):

```
Layer 0  Environment       make doctor                            ~5s
Layer 1  Static/imports    python -c, tsc --noEmit                ~30s
Layer 2  Unit tests        make test-server                       ~10s
Layer 3  Demo path (auto)  pytest -m e2e   (if key + shop-api up) ~90s
Layer 3  Demo path (UI)    /demo → click inject SRE-0001          ~90s
Layer 4  Auth + workspace  manual via /signup → /onboard          ~5min
Layer 5  Agent WS handshake docker run agent → server logs        ~3min
Layer 6  Auto-detect + approve  stop shop-api → watch incident    ~3min
Layer 7  Failure visibility   stop agent mid-run, bad key, etc.   ~2min
```

If a layer fails, **stop and fix it before moving on**. Don't try to debug Layer 5 when Layer 1 is red.

---

## Layer 0 — Environment preflight

**Command:** `make doctor`

**What it checks** (`scripts/doctor.sh`):
1. `ANTHROPIC_API_KEY` set in `.env` or shell, not the placeholder `sk-ant-...`
2. Docker daemon reachable (`docker info` succeeds)
3. `server/.venv/bin/python` exists
4. `client/node_modules` exists
5. `apps/rust` working tree clean (so `injector.reset()` can restore via `git checkout`)
6. `evidence/` and `results/` writable
7. `cargo` installed
8. (warn-only) `shop-api` on `:8080`

**Pass criterion:** "X pass, 0 fail, ≤1 warn" — the only acceptable warn is #8 if shop-api isn't running yet.

**Common failures + remedy:**
- `ANTHROPIC_API_KEY missing` → `cp .env.example .env`, paste your key
- `docker daemon not reachable` → open Docker Desktop
- `server/.venv missing` → `make setup`
- `apps/rust has uncommitted changes` → `git checkout HEAD -- apps/rust`

**Gotcha:** `.env.example` does **not** include `ALLOWED_EMAILS=`. You must add it before Layer 4 or signup will be unintentionally open. Add this line to `.env`:
```
ALLOWED_EMAILS=you@example.com,other@example.com
```

---

## Layer 1 — Static: imports + types

The patch added ~20 new Python modules and ~10 new React pages. A single broken import will crash server boot. Catch this without running the full app.

**Python — does the server boot at all?**
```
cd server
SENTINEL_SKIP_PREFLIGHT=1 .venv/bin/python -c "from main import app; print('boot ok')"
```
Pass: prints `boot ok`. Any `ImportError`, `ModuleNotFoundError`, or `SyntaxError` = patch dependency drift.

**Likely failures:**
- `bcrypt`, `python-jose`, `websockets` not installed → `cd server && .venv/bin/uv pip install -e ".[dev]"` (the patch should have added them to `pyproject.toml`; if not, install manually)
- `from sentinel.routes.auth import …` fails → check `server/sentinel/routes/__init__.py` exists

**TypeScript — do client pages compile?**
```
cd client && bunx tsc --noEmit
```
Pass: no errors. Common failures: missing `Link` import, wrong path to `@/lib/auth`, type mismatch in new page props.

---

## Layer 2 — Unit tests (regressions)

```
make test-server
```

`conftest.py` sets `SENTINEL_SKIP_PREFLIGHT=1` so unit tests don't need an API key. Every test that passed on `main` (`630b0df`) must still pass. A **new** failure here = the patch broke an existing contract.

Expected pass list: `test_main.py`, `test_adapters.py`, `test_tools.py`, `test_channel.py`, `test_scorer.py`, `test_vitals.py`, `test_fixture.py`, `test_leaderboard.py`. The new `test_e2e.py` will be **collected** but skipped (no key / no shop-api running yet) — that's correct.

---

## Layer 3 — Demo path (the original regression check)

The bundled `shop-api` + SRE-0001 flow was working before this patch. It must still work. This is the single most important check.

**Setup (two terminals):**
```
# terminal 1
cd apps/rust && cargo run               # shop-api on :8080

# terminal 2
make dev                                # server :8000 + client :3000
```

**Automated path (preferred):**
```
cd server && .venv/bin/pytest tests/test_e2e.py -v -m e2e
```
Asserts: status=`done`, score > 0, phases include `detecting` + `diagnosing`. Skipped if `ANTHROPIC_API_KEY` missing or shop-api unreachable.

**UI path:**
1. Open http://localhost:3000/demo (note: it's `/demo` now, not `/` — `/` is the landing page)
2. Find `shop-api` card → click `Inject SRE-0001`
3. Should navigate to `/incidents/<run_id>`
4. Watch `EventTimeline` populate; phases tick across `PhaseProgressBar`
5. Within ~60s, `OutcomeCard` appears in right rail with score 1.00

**Failure modes to expect:**
- "running" forever and no events → check `evidence/<run_id>.jsonl` exists; if it does, server is producing events but client SSE isn't connecting (CORS? wrong API URL?)
- Run instantly flips to `failed` with no error visible → check server stdout for the traceback. The patch's `_preflight()` adds error surfacing but Anthropic API errors still need to be inspected by hand.

---

## Layer 4 — Auth + workspaces (new surface)

1. Restart server (DB initializes on lifespan — creates `server/sentinel.db` with 4 tables).
2. `curl -i http://localhost:8000/auth/me` → expect `401`
3. Open `/signup`, try a non-allowlisted email → `403 "Email not on the access list"`
4. Sign up with allowlisted email → 200, `Set-Cookie: sentinel_session=…`
5. Reload `/dashboard` → should now load (cookie auth working)
6. Create a workspace via UI or `curl -X POST /workspaces -d '{"name":"smoke"}' --cookie sentinel_session=…` → response includes `api_key` starting with `wskey_`
7. `GET /workspaces` returns the workspace

**Verify DB state directly** (debugging aid):
```
sqlite3 server/sentinel.db ".tables"
# expect: pending_patches  users  workspace_apps  workspaces

sqlite3 server/sentinel.db "SELECT id,email,plan FROM users; SELECT id,name,api_key FROM workspaces;"
```

**Common failures:**
- `403` even on allowed email → `ALLOWED_EMAILS` not in `.env`, or comma/whitespace issue. Empty `ALLOWED_EMAILS` = open signup (intentional fallback).
- Cookie not set → check `samesite=lax` is acceptable for your browser; cross-origin during dev is the most likely culprit (server :8000, client :3000).

---

## Layer 5 — Agent WebSocket handshake

The agent code (`agent/main.py`) hasn't actually been built or run yet — Phase 3 needs a smoke test before anything depending on it (Layers 6, 7).

**Build the image:**
```
cd agent && docker build -t sentinel-agent .
```
Pass: image builds without error.

**Run the agent pointed at the existing demo shop-api:**
```
# Need the api_key from Layer 4
docker run --rm \
  -e SENTINEL_KEY=wskey_xxx \
  -e SENTINEL_API_URL=ws://host.docker.internal:8000 \
  -e HEALTH_URL=http://host.docker.internal:8080/healthz \
  -e METRICS_URL=http://host.docker.internal:8080/metrics \
  -e LOGS_SERVICE=shop-api \
  -e REPO_PATH=/workspace \
  -v $(pwd)/apps/rust:/workspace \
  sentinel-agent
```

**Verify on the server side:**
- Server log line: `agent connected workspace=N hostname=…`
- DB: `SELECT connected_at FROM workspace_apps WHERE workspace_id=N` → non-null
- `/onboard` step 4 ("Waiting for agent…") should flip to "✓ Connected" via the workspaces `/events` SSE

**Heartbeat verification:**
- Every 10s, agent logs `→ heartbeat (health.ok=true)`
- Server logs receive heartbeats; detector's `WorkspaceState.consec_fails` stays at 0 while healthy

**Common failures:**
- WS connection refused → `SENTINEL_API_URL=ws://host.docker.internal:8000` (NOT `localhost` — agent is inside Docker)
- `4001 missing or invalid api_key` → check `Bearer wskey_…` header format in `agent/main.py`
- `4003 api_key not found` → workspace's api_key doesn't match DB row

---

## Layer 6 — Auto-detect + approve-before-apply

Depends on Layer 5 being green.

1. Confirm agent connected, heartbeat steady, dashboard shows green.
2. **Trigger an outage**: in another terminal, `pkill -f shop-api` (or `docker stop shop-api`)
3. Watch heartbeats: within ~30s, health flips to `ok=false`
4. After 3 consecutive fails (`CONSEC_FAIL_THRESHOLD=3`), `detector.py` creates an incident via `_create_incident()`
5. Dashboard shows new incident under the workspace; opens incident page
6. Claude runs through detection → diagnosis → proposes patch
7. In **approve** mode (default `fix_mode`): `PendingApprovalCard` renders inline in `EventTimeline` with the diff + Approve / Reject buttons
8. Click **Approve** → `POST /workspaces/{id}/incidents/{run_id}/approve` → server sends `apply_patch` over WS → agent writes the file in `/workspace` (visible in your local `apps/rust/` since it's mounted) → agent restarts shop-api
9. Restart shop-api manually if the agent's `RESTART_TARGET=shop-api` doesn't match your setup — note this env var defaults to `app` in the agent, which won't match `shop-api`
10. Health recovers → vitals green → run terminates with `OutcomeCard`

**Test reject path:** redo from step 1, click **Reject** → run terminates cleanly, no changes to `apps/rust/`, OutcomeCard shows the rejected state.

**Test auto mode:** `PATCH /workspaces/{id}` with `{"fix_mode": "auto"}` → repeat outage → fix applies without approval prompt.

**Common failures:**
- No incident created on 3 fails → check `detector.py`'s heartbeat handler is actually being called from `agent_hub.py` (search for `on_heartbeat`); also check `health.ok` is reaching it as `False` not the string "false"
- Detector fires but agent never receives `tool_call` → `RemoteToolRouter.execute()` future never resolves; likely `req_id` mismatch in `protocol.py`
- Patch shown in UI but Approve button does nothing → `POST .../approve` endpoint missing or 404; grep `pending_patch` in `routes/workspaces.py` to confirm wired

---

## Layer 7 — Failure visibility (the real proof of "no more 20 iterations")

The whole point of Phase 1 was: **when something breaks, the system tells you exactly what**. Verify by deliberately breaking things:

1. **Bad API key:** edit `.env`, set `ANTHROPIC_API_KEY=sk-ant-invalid`. Restart server. → server should still boot (preflight only checks presence, not validity), but the next incident should `failed` with `kind: fatal_error` visible in the timeline (not just a generic "failed" status). If the error is silent, the patch's `agent.py` error surfacing didn't land — check.
2. **Docker stopped:** `osascript -e 'quit app "Docker"'`. `make doctor` → must print `FAIL  docker daemon not reachable`.
3. **Agent killed mid-incident:** Layer 6 step 4, kill the agent container with `docker kill`. → server should mark the run failed with an `agent disconnected` event in the timeline, not silently spin.
4. **DB corrupted:** `rm server/sentinel.db`, restart server. → must boot cleanly (auto-recreates schema). Users + workspaces gone, but no crash.

---

## What is and isn't automated

| Layer | Has automated check? | Manual smoke required? |
|---|---|---|
| 0 Environment | ✅ `make doctor` | — |
| 1 Imports/types | ⚠️ partial (python `-c`, `tsc --noEmit`) | — |
| 2 Unit tests | ✅ `make test-server` | — |
| 3 Demo path | ✅ `pytest -m e2e` (needs key + shop-api) | ⚠️ UI verification still useful |
| 4 Auth | ❌ | ✅ |
| 5 Agent WS | ❌ | ✅ |
| 6 Detect + approve | ❌ | ✅ |
| 7 Failure modes | ❌ | ✅ |

**Recommendation for the next iteration**: add a `test_agent_ws.py` that spawns a fake agent WebSocket client and asserts the server hub registers it. That single test would cover Layer 5 deterministically. Anomaly-detector logic in `detector.py` is unit-testable too — feed it synthetic heartbeats. Both are reasonable follow-ups but **not blockers for shipping** what's in the working tree.

---

## Critical files to know during verification

- `scripts/doctor.sh` — modify to add new checks if a failure mode keeps biting
- `server/main.py:_preflight()` — server-side preflight; mirror any new check here
- `server/tests/conftest.py` — sets `SENTINEL_SKIP_PREFLIGHT=1` for unit tests
- `server/tests/test_e2e.py` — the one automated E2E; widen assertions if Claude becomes nondeterministic
- `server/sentinel/db.py` — schema; if you add tables, add to `_SCHEMA` list
- `server/sentinel/agent_hub.py:handle_agent_connection` — first place to add log lines when debugging WS handshake
- `server/sentinel/detector.py:on_heartbeat` — first place to add log lines when detection isn't firing
- `.env.example` — needs an `ALLOWED_EMAILS=` line added (currently missing)

## Out of scope for this verification

- Multi-tenant load testing
- Latency benchmarks for the WS protocol
- Security audit (cookie flags, CSRF, rate limiting on /auth)
- The `test-apps/` directory + onboarding a real third-party app (do this after the bundled flow is solid)
- Stripe integration / real billing (Phase 7)
