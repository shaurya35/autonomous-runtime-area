#!/usr/bin/env bash
# Sentinel preflight — verifies the local environment is ready to run `make dev`.
# Each check prints PASS or FAIL with a short remedy. Exits non-zero on any FAIL.

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
WARN=0

c_pass()  { printf "  \033[32mPASS\033[0m  %s\n" "$1"; PASS=$((PASS+1)); }
c_fail()  { printf "  \033[31mFAIL\033[0m  %s\n        → %s\n" "$1" "$2"; FAIL=$((FAIL+1)); }
c_warn()  { printf "  \033[33mWARN\033[0m  %s\n        → %s\n" "$1" "$2"; WARN=$((WARN+1)); }
section() { printf "\n%s\n" "$1"; }

section "Sentinel doctor"

# 1. ANTHROPIC_API_KEY present and non-empty
KEY_FROM_ENV=""
if [ -f .env ]; then
  KEY_FROM_ENV="$(grep -E '^ANTHROPIC_API_KEY=' .env | head -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
KEY="${ANTHROPIC_API_KEY:-$KEY_FROM_ENV}"
if [ -n "$KEY" ] && [ "$KEY" != "sk-ant-..." ]; then
  c_pass "ANTHROPIC_API_KEY is set"
else
  c_fail "ANTHROPIC_API_KEY missing or placeholder" "edit .env and set a real key from console.anthropic.com"
fi

# 2. docker daemon reachable
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    c_pass "docker daemon reachable"
  else
    c_fail "docker installed but daemon not reachable" "start Docker Desktop / dockerd, then retry"
  fi
else
  c_fail "docker CLI not found" "install Docker Desktop (macOS/Windows) or docker-ce (Linux)"
fi

# 3. server/.venv
if [ -x server/.venv/bin/python ]; then
  c_pass "server/.venv exists"
else
  c_fail "server/.venv missing" "run: make setup"
fi

# 4. client/node_modules
if [ -d client/node_modules ]; then
  c_pass "client/node_modules exists"
else
  c_fail "client/node_modules missing" "run: cd client && bun install"
fi

# 5. apps/rust working tree clean (so injector.reset() can restore via git checkout)
if [ -d apps/rust ]; then
  DIRTY="$(git status --porcelain apps/rust 2>/dev/null | head -1)"
  if [ -z "$DIRTY" ]; then
    c_pass "apps/rust working tree clean"
  else
    c_fail "apps/rust has uncommitted changes" "commit, stash, or 'git checkout HEAD -- apps/rust' so injector.reset() can restore files"
  fi
else
  c_warn "apps/rust not present" "the bundled rust app is missing; demo flow will not work"
fi

# 6. evidence/ and results/ writable
mkdir -p evidence results 2>/dev/null
if [ -w evidence ] && [ -w results ]; then
  c_pass "evidence/ and results/ writable"
else
  c_fail "evidence/ or results/ not writable" "chmod u+w evidence results"
fi

# 7. cargo available (needed to run the bundled shop-api on :8080)
if command -v cargo >/dev/null 2>&1; then
  c_pass "cargo present"
else
  c_fail "cargo not found" "install Rust via https://rustup.rs (needed to start apps/rust for the demo)"
fi

# 8. (warning only) shop-api reachable on :8080
if curl -sf -m 1 http://localhost:8080/healthz >/dev/null 2>&1; then
  c_pass "shop-api responding on :8080"
else
  c_warn "shop-api not running on :8080" "in another tab: cd apps/rust && cargo run  (only needed for the demo flow)"
fi

# 9. Docker/compose files are internally consistent
if [ -f server/Dockerfile ] && [ -f client/Dockerfile ] && [ -f agent/Dockerfile ]; then
  c_pass "server, client, and agent Dockerfiles exist"
else
  c_fail "one or more Dockerfiles missing" "expected server/Dockerfile, client/Dockerfile, and agent/Dockerfile"
fi

if command -v docker >/dev/null 2>&1; then
  if docker compose config >/dev/null 2>&1; then
    c_pass "docker compose config is valid"
  else
    c_fail "docker compose config is invalid" "run: docker compose config"
  fi
fi

section "Summary: $PASS pass, $FAIL fail, $WARN warn"

if [ "$FAIL" -gt 0 ]; then
  echo "Fix the FAIL items above, then re-run: make doctor"
  exit 1
fi
echo "Ready. Next: make dev"
exit 0
