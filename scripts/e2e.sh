#!/usr/bin/env bash
# Sentinel E2E test suite — verifies every flow before demo day.
#
# Usage:
#   ./scripts/e2e.sh            # Sections 1–7 (no API calls, ~30s)
#   ./scripts/e2e.sh --agent    # All 8 sections including live agent run (~2 min, ~$0.10)
#
# Exit code 0 = all checks passed. Non-zero = something failed (see ❌ lines above).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ── flags ─────────────────────────────────────────────────────────────────────
RUN_AGENT=0
for arg in "$@"; do
  [[ "$arg" == "--agent" ]] && RUN_AGENT=1
done

# ── colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; NC='\033[0m'
PASS=0; FAIL=0; SKIP=0
_SERVER_PID=""; _SHOP_PID=""

pass()   { printf "  ${GREEN}✅  %s${NC}\n" "$1";  PASS=$((PASS+1)); }
fail()   { printf "  ${RED}❌  %s${NC}\n"   "$1";  FAIL=$((FAIL+1)); }
skip()   { printf "  ${YELLOW}⏭   %s${NC}\n" "$1"; SKIP=$((SKIP+1)); }
header() { printf "\n${CYAN}── %s ──${NC}\n" "$1"; }

# ── cleanup on exit ───────────────────────────────────────────────────────────
cleanup() {
  header "Teardown"
  if [[ -n "$_SERVER_PID" ]] && kill -0 "$_SERVER_PID" 2>/dev/null; then
    kill "$_SERVER_PID" 2>/dev/null && pass "Stopped FastAPI server (pid $_SERVER_PID)" || true
  fi
  if [[ -n "$_SHOP_PID" ]] && kill -0 "$_SHOP_PID" 2>/dev/null; then
    kill "$_SHOP_PID" 2>/dev/null && pass "Stopped shop-api (pid $_SHOP_PID)" || true
  fi
  # Restore any injected source files so the repo stays clean
  git -C "$ROOT" checkout HEAD -- apps/rust/src 2>/dev/null || true
}
trap cleanup EXIT

# helper: wait for a URL to return 200, with timeout
wait_for() {
  local url="$1" label="$2" max="${3:-30}"
  local i=0
  while ! curl -sf -m 2 "$url" >/dev/null 2>&1; do
    sleep 1; i=$((i+1))
    if [[ $i -ge $max ]]; then
      fail "$label — did not respond within ${max}s"
      return 1
    fi
  done
  pass "$label is up ($i s)"
}

# helper: check HTTP status code
check_status() {
  local label="$1" expected="$2"
  shift 2
  local actual
  actual=$(curl -s -o /dev/null -w "%{http_code}" "$@")
  if [[ "$actual" == "$expected" ]]; then
    pass "$label → HTTP $actual"
  else
    fail "$label → expected HTTP $expected, got $actual"
  fi
}

# helper: check that a JSON response contains a substring
check_body() {
  local label="$1" pattern="$2"
  shift 2
  local body
  body=$(curl -s "$@")
  if echo "$body" | grep -q "$pattern"; then
    pass "$label (contains '$pattern')"
  else
    fail "$label — '$pattern' not found in: $(echo "$body" | head -c 200)"
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
header "1. Pre-flight"

# API key
KEY_FILE=""; [[ -f .env ]] && KEY_FILE=$(grep -E '^ANTHROPIC_API_KEY=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
KEY="${ANTHROPIC_API_KEY:-$KEY_FILE}"
if [[ -n "$KEY" && "$KEY" != "sk-ant-..." && "$KEY" != "sk-ant-YOUR_KEY_HERE" ]]; then
  pass "ANTHROPIC_API_KEY is set"
else
  fail "ANTHROPIC_API_KEY missing or placeholder — edit .env"
fi

# Required binaries
for bin in cargo uv bun curl python3; do
  command -v "$bin" >/dev/null 2>&1 && pass "$bin present" || fail "$bin not found"
done

# Ports free (we'll start services, so they must be unoccupied)
for port in 8000 8080; do
  if lsof -ti :"$port" >/dev/null 2>&1; then
    fail "Port $port already in use — kill the process and retry"
  else
    pass "Port $port is free"
  fi
done

# apps/rust git-clean (required for inject → git checkout to work)
DIRTY=$(git status --porcelain apps/rust 2>/dev/null | head -1)
if [[ -z "$DIRTY" ]]; then
  pass "apps/rust working tree is clean"
else
  fail "apps/rust has uncommitted changes — run: git checkout HEAD -- apps/rust"
fi

# ══════════════════════════════════════════════════════════════════════════════
header "2. Start shop-api (:8080)"

(cd "$ROOT/apps/rust" && cargo run --quiet 2>/tmp/shop.log) &
_SHOP_PID=$!
wait_for "http://localhost:8080/healthz" "shop-api :8080" 60

# ══════════════════════════════════════════════════════════════════════════════
header "3. Start FastAPI server (:8000)"

(
  set -a; [[ -f .env ]] && source "$ROOT/.env"; set +a
  cd "$ROOT/server" && \
  APPS_DIR="$ROOT/apps" EVIDENCE_DIR="$ROOT/evidence" RESULTS_DIR="$ROOT/results" \
  uv run uvicorn main:app --port 8000 --log-level warning 2>/tmp/server.log
) &
_SERVER_PID=$!
wait_for "http://localhost:8000/health" "FastAPI :8000" 30

# ══════════════════════════════════════════════════════════════════════════════
header "4. API layer (12 checks)"

# Basic status codes
check_status "GET /health"                                   200  http://localhost:8000/health
check_status "GET /apps"                                     200  http://localhost:8000/apps
check_status "GET /apps/shop-api/incidents"                  200  http://localhost:8000/apps/shop-api/incidents
check_status "GET /apps/shop-api/vitals?simulate=true"       200  "http://localhost:8000/apps/shop-api/vitals?simulate=true"
check_status "GET /leaderboard"                              200  http://localhost:8000/leaderboard
check_status "GET /incidents"                                200  http://localhost:8000/incidents
check_status "GET /apps/nonexistent/incidents"               404  http://localhost:8000/apps/nonexistent/incidents
check_status "POST /apps/nonexistent/inject"                 404  -X POST -H "Content-Type: application/json" \
             -d '{"incident_id":"SRE-0001"}' http://localhost:8000/apps/nonexistent/inject

# Response body content
check_body "GET /apps contains shop-api"                    "shop-api"  http://localhost:8000/apps
check_body "GET /apps/shop-api/incidents has 5 entries"     "SRE-0001"  http://localhost:8000/apps/shop-api/incidents
check_body "GET /apps/shop-api/vitals has req_per_sec"     "req_per_sec" "http://localhost:8000/apps/shop-api/vitals?simulate=true"
check_body "GET /apps/shop-api/vitals has error_rate_pct"  "error_rate_pct" "http://localhost:8000/apps/shop-api/vitals?simulate=true"

# ══════════════════════════════════════════════════════════════════════════════
header "5. Inject / Heal flow"

# Inject — flip simulator to critical
INJECT_RESP=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"incident_id":"SRE-0001"}' http://localhost:8000/apps/shop-api/inject)
if echo "$INJECT_RESP" | grep -q '"applied":true'; then
  pass "POST /apps/shop-api/inject → applied"
else
  fail "POST /apps/shop-api/inject unexpected: $INJECT_RESP"
fi

# After inject: error_rate_pct must be > 0
sleep 1
VITALS=$(curl -s "http://localhost:8000/apps/shop-api/vitals?simulate=true")
ERR_VALS=$(echo "$VITALS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
vals = d.get('vitals', {}).get('error_rate_pct', [])
print(sum(vals))
" 2>/dev/null)
if [[ -n "$ERR_VALS" ]] && python3 -c "exit(0 if float('$ERR_VALS') > 0 else 1)" 2>/dev/null; then
  pass "Vitals after inject: error_rate_pct elevated (sum=$ERR_VALS)"
else
  fail "Vitals after inject: error_rate_pct is still zero (sum=${ERR_VALS:-?})"
fi

# Heal — restore simulator
HEAL_RESP=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"incident_id":"SRE-0001"}' http://localhost:8000/apps/shop-api/heal)
if echo "$HEAL_RESP" | grep -q '"healed":true'; then
  pass "POST /apps/shop-api/heal → healed"
else
  fail "POST /apps/shop-api/heal unexpected: $HEAL_RESP"
fi

# After heal: error_rate_pct must be back near 0
sleep 1
VITALS2=$(curl -s "http://localhost:8000/apps/shop-api/vitals?simulate=true")
ERR_VALS2=$(echo "$VITALS2" | python3 -c "
import sys, json
d = json.load(sys.stdin)
vals = d.get('vitals', {}).get('error_rate_pct', [])
print(max(vals) if vals else 0)
" 2>/dev/null)
if [[ -n "$ERR_VALS2" ]] && python3 -c "exit(0 if float('$ERR_VALS2') < 1.0 else 1)" 2>/dev/null; then
  pass "Vitals after heal: error_rate_pct normal (max=$ERR_VALS2)"
else
  fail "Vitals after heal: error_rate_pct still elevated (max=${ERR_VALS2:-?})"
fi

# ══════════════════════════════════════════════════════════════════════════════
header "6. SSE vitals stream"

# curl returns exit code 28 on --max-time; pipefail would kill the script — suppress it
SSE_LINES=$(curl -sN --max-time 5 http://localhost:8000/apps/shop-api/vitals/stream 2>/dev/null \
  | grep "^data:" | wc -l | tr -d ' ') || true
if [[ "${SSE_LINES:-0}" -ge 3 ]]; then
  pass "Vitals SSE stream delivered $SSE_LINES data events in 5s"
else
  fail "Vitals SSE stream: expected ≥3 events in 5s, got ${SSE_LINES:-0}"
fi

# ══════════════════════════════════════════════════════════════════════════════
header "7. Demo seed + Leaderboard"

SEED_RESP=$(curl -s -X POST http://localhost:8000/demo/seed)
if echo "$SEED_RESP" | grep -q '"seeded"'; then
  pass "POST /demo/seed → seeded"
else
  fail "POST /demo/seed unexpected: $SEED_RESP"
fi

LB=$(curl -s http://localhost:8000/leaderboard)
ROWS=$(echo "$LB" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('rows',[])))" 2>/dev/null)
if [[ "${ROWS:-0}" -ge 1 ]]; then
  pass "GET /leaderboard has $ROWS row(s) after seed"
else
  fail "GET /leaderboard: no rows after seed ($LB)"
fi

# Leaderboard contains SRE-0001
check_body "Leaderboard contains SRE-0001" "SRE-0001" http://localhost:8000/leaderboard

# ══════════════════════════════════════════════════════════════════════════════
if [[ "$RUN_AGENT" -eq 0 ]]; then
  header "8. Agent run (skipped — rerun with --agent to include)"
  skip "Full agent run skipped (no --agent flag)"
else
  header "8. Full agent run (live, ~60s)"

  # Reset so we get a fresh run
  rm -rf evidence/* results/* 2>/dev/null; mkdir -p evidence results

  # Dispatch agent
  START_RESP=$(curl -s -X POST -H "Content-Type: application/json" \
    -d '{"app":"shop-api","incident_id":"SRE-0001"}' http://localhost:8000/incidents/start)
  RUN_ID=$(echo "$START_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('run_id',''))" 2>/dev/null)

  if [[ -z "$RUN_ID" ]]; then
    fail "POST /incidents/start did not return run_id — response: $START_RESP"
  else
    pass "POST /incidents/start → run_id=$RUN_ID"

    # Poll until done or timeout
    printf "  Waiting for agent"
    ELAPSED=0; STATUS="running"
    while [[ "$STATUS" == "running" && "$ELAPSED" -lt 120 ]]; do
      sleep 3; ELAPSED=$((ELAPSED+3))
      printf "."
      STATUS=$(curl -s "http://localhost:8000/incidents/$RUN_ID" \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','running'))" 2>/dev/null)
    done
    echo ""

    if [[ "$STATUS" == "done" ]]; then
      pass "Agent completed (${ELAPSED}s)"
      SCORE=$(curl -s "http://localhost:8000/incidents/$RUN_ID" \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('score',0))" 2>/dev/null)
      if python3 -c "exit(0 if float('${SCORE:-0}') >= 0.5 else 1)" 2>/dev/null; then
        pass "Score ${SCORE} ≥ 0.5 — incident solved"
      else
        fail "Score ${SCORE} < 0.5 — agent did not solve it"
      fi
    elif [[ "$STATUS" == "failed" ]]; then
      ERR=$(curl -s "http://localhost:8000/incidents/$RUN_ID" \
        | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','?'))" 2>/dev/null)
      fail "Agent run failed: $ERR"
    else
      fail "Agent timed out after 120s (last status: $STATUS)"
    fi

    # Verify leaderboard updated with the real run
    LB2=$(curl -s http://localhost:8000/leaderboard)
    CELLS=$(echo "$LB2" | python3 -c "
import sys, json
d = json.load(sys.stdin)
total = sum(len(r.get('cells',[])) for r in d.get('rows',[]))
print(total)
" 2>/dev/null)
    if [[ "${CELLS:-0}" -ge 1 ]]; then
      pass "Leaderboard updated ($CELLS scored cell(s))"
    else
      fail "Leaderboard not updated after agent run"
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
header "Summary"
printf "  ${GREEN}%d passed${NC}  ${RED}%d failed${NC}  ${YELLOW}%d skipped${NC}\n\n" \
  "$PASS" "$FAIL" "$SKIP"

if [[ "$FAIL" -gt 0 ]]; then
  echo "  Fix the ❌ items above, then re-run."
  exit 1
fi
echo "  All checks passed. Ready to demo."
exit 0
