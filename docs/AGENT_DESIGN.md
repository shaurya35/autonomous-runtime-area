# Agent Design

## Architecture decision: monolithic ReAct loop

The agent is a **single Claude Sonnet 4.6 ReAct loop**. The dashboard renders it as four "specialist phases" (detecting → diagnosing → fixing → verifying), but this is a pure UI affordance — there is one model, one context window, one tool dispatch loop.

**Why not four separate agents?**

- Multi-agent requires explicit handoffs. The agent often needs to revisit earlier phases (e.g. re-read logs after applying a patch). A shared context window makes this free.
- Four separate calls quadruple latency and cost for simple incidents.
- The scoring formula already captures phases: whether the agent *reached* a phase is inferred from which tools it called, not from which "agent" ran.
- This architecture is straightforward to upgrade to multi-agent later if needed — the `IncidentChannel` event stream is already the natural boundary.

## Phase tagging

The agent prepends `<phase>X</phase>` to its reasoning before every tool call. The server strips this tag and attaches `phase` to the `ChannelEvent`. The agent is instructed (via `prompts/system.md`) that phases must progress monotonically:

```
detecting → diagnosing → fixing → verifying
```

Re-entering an earlier phase is allowed for one level back (e.g. fixing→diagnosing after a failed patch), but the agent should not loop.

## Tool contracts (locked surface)

All 9 tools take no `service` or `app` parameter — they are bound to a single `AppManifest` at incident-start time.

| Tool | Phase typically used | Side effects |
|---|---|---|
| `read_logs(since_seconds, grep)` | detecting | none |
| `get_metric(name, window_seconds)` | detecting | none |
| `check_health()` | detecting / verifying | none |
| `list_files(directory)` | diagnosing | none |
| `read_file(path, start_line, end_line)` | diagnosing | none |
| `search_code(pattern, glob)` | diagnosing | none |
| `run_command(cmd, timeout_seconds)` | any | yes — runs shell cmd |
| `run_tests(test_name)` | verifying | yes — runs test suite |
| `propose_patch(file, unified_diff)` | fixing | yes — writes file + restarts app |

`run_command` is policy-gated (allow-list in `policy.py`). In MVP the policy stubs to True; a real deployment would restrict to safe commands.

## Stop condition

The loop exits when:
1. `run_tests` returns all-passing **and** `check_health` returns healthy, OR
2. `propose_patch` has been called ≥3 times without reaching passing tests (max-fix guard), OR
3. Total tool calls exceed 40 (safety cap).

## Scoring

```
score = 0.2 × (detecting ∈ phases_reached)
      + 0.3 × (diagnosing ∈ phases_reached)
      + 0.5 × (verifying ∈ phases_reached)
      - 0.01 × max(0, mttr_minutes - 5)
```

- **0.5 weight on verifying** — the agent must not just propose a patch but confirm it works.
- **MTTR penalty** — 1% per minute over 5-minute baseline, minimum score 0.0.
- A score of 1.0 means the agent detected, diagnosed, fixed, and verified in under 5 minutes.

## Prompt structure

`prompts/system.md` contains:
1. Role: "You are Sentinel, an autonomous SRE agent."
2. Tool use instructions (ReAct format).
3. Phase tag instruction with progression rules.
4. Stop condition.
5. Output format: plain text reasoning + tool call. No markdown headers in reasoning.

`prompts/phase_examples.md` contains few-shot examples of each phase transition with the `<phase>` tag in the right position.
