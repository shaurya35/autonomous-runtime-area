# Demo Runbook

Use this as the current source of truth for the live demo. Older showcase docs are narrative references.

## Preflight

```bash
make doctor
cd server && SENTINEL_SKIP_PREFLIGHT=1 .venv/bin/python -c "from main import app; print('boot ok')"
cd client && bunx tsc --noEmit
```

For the live agent path, also confirm:

```bash
cd apps/rust && cargo run
curl http://localhost:8080/healthz
make dev
```

Expected URLs:

- Dashboard: http://localhost:3000/demo
- API: http://localhost:8000/health
- Rust app: http://localhost:8080/healthz

## Primary Live Path

1. Open `/demo`.
2. Confirm `shop-api` appears with vitals and incident selector.
3. Select `SRE-0001`.
4. Click `Inject`.
5. The app should navigate to `/incidents/<run_id>`.
6. Watch phases progress through detecting, diagnosing, fixing, verifying.
7. Finish on the outcome card and score.

Expected time: 60-90 seconds depending on Claude latency.

## Fallback Replay Path

Use this if Anthropic, Docker, or the Rust app is not ready.

1. Open `/demo`.
2. Click `Load demo replay`.
3. The app seeds a known-good SRE-0001 run and navigates to `/incidents/<run_id>?replay=1`.
4. The timeline replays a complete incident from stored evidence.

This path does not require Claude or the Rust app.

## Recovery Steps

- If `/demo` shows no apps, check the backend is running and `APPS_DIR` points at `./apps`.
- If live incident hangs with no events, check `evidence/<run_id>.jsonl`.
- If live incident fails immediately, inspect the error event in the timeline and server logs.
- If the sidecar dashboard says not connected, rerun the agent with the workspace `wskey_...`.
- If the live path is unstable during presentation, switch to `Load demo replay` immediately.
