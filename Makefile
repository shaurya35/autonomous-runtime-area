.PHONY: help setup install dev server client test test-server test-rust \
        up down logs run-incident inject score reset demo

# ── default ────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  SREBench — setup & run targets"
	@echo ""
	@echo "  Setup"
	@echo "    make setup          One-time install: uv + Python 3.13 + all deps"
	@echo ""
	@echo "  Local dev (no Docker)"
	@echo "    make dev            Start server (port 8000) + dashboard (port 3000)"
	@echo "    make server         Start backend only"
	@echo "    make client         Start frontend only"
	@echo ""
	@echo "  Tests"
	@echo "    make test           Run all test suites (server + rust)"
	@echo "    make test-server    Run Python server tests"
	@echo "    make test-rust      Run Rust shop-api integration tests"
	@echo ""
	@echo "  Incidents"
	@echo "    make run-incident APP=shop-api ID=SRE-0001"
	@echo "    make score RUN=<run_id>"
	@echo "    make reset          Clear evidence/ and results/"
	@echo ""
	@echo "  Docker"
	@echo "    make up             Build + start via docker compose"
	@echo "    make down           Stop docker compose stack"
	@echo "    make logs           Stream compose logs"
	@echo ""

# ── one-time setup ─────────────────────────────────────────────────────────────
setup:
	@echo "→ Installing uv..."
	@command -v uv >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh
	@echo "→ Installing Python 3.13..."
	@uv python install 3.13
	@echo "→ Creating server virtualenv and installing deps..."
	@cd server && uv venv --python 3.13 && uv pip install -e ".[dev]"
	@echo "→ Installing dashboard deps..."
	@cd client && bun install
	@echo "→ Creating .env from template..."
	@test -f .env || cp .env.example .env
	@echo ""
	@echo "  Done. Edit .env and set ANTHROPIC_API_KEY, then run: make dev"
	@echo ""

# ── local dev ──────────────────────────────────────────────────────────────────
dev:
	@$(MAKE) -j2 server client

server:
	@test -f .env && export $$(grep -v '^#' .env | xargs) || true
	cd server && \
	  export $$(grep -v '^#' ../.env | grep -v '^$$' | xargs) 2>/dev/null; \
	  APPS_DIR=../apps EVIDENCE_DIR=../evidence RESULTS_DIR=../results \
	  .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload

client:
	cd client && NEXT_PUBLIC_API_URL=http://localhost:8000 bun dev --port 3000

# ── tests ──────────────────────────────────────────────────────────────────────
test: test-server test-rust

test-server:
	@echo "→ Python server tests..."
	cd server && .venv/bin/pytest tests/ -v

test-rust:
	@echo "→ Rust shop-api integration tests..."
	cargo test --manifest-path apps/rust/Cargo.toml

# ── incidents ──────────────────────────────────────────────────────────────────
run-incident:
	@test -n "$(APP)" || (echo "Usage: make run-incident APP=<name> ID=<id>"; exit 1)
	@test -n "$(ID)"  || (echo "Usage: make run-incident APP=<name> ID=<id>"; exit 1)
	curl -s -X POST http://localhost:8000/incidents/start \
		-H "Content-Type: application/json" \
		-d '{"app":"$(APP)","incident_id":"$(ID)"}' | python3 -m json.tool

score:
	@test -n "$(RUN)" || (echo "Usage: make score RUN=<run_id>"; exit 1)
	cat results/$(RUN).json | python3 -m json.tool

reset:
	rm -rf evidence/* results/*
	mkdir -p evidence results
	@echo "Cleared evidence/ and results/."

# ── docker ─────────────────────────────────────────────────────────────────────
up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

demo: up
	@echo "Waiting for agent to start..."
	@until curl -sf http://localhost:8000/health >/dev/null 2>&1; do sleep 1; done
	$(MAKE) run-incident APP=shop-api ID=SRE-0001
	@echo "Dashboard: http://localhost:3000"
