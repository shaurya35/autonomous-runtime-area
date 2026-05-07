# Incident Spec — Plain English Version

## What is an "incident"?

An incident = **something broke in production**.

Real examples:
- Users can't log in (someone shipped a typo)
- Website is slow (database running out of memory)
- Payments are failing (third-party API is down)

Your AI agent's job: **find what broke and fix it.**

---

## What is an "incident spec"?

A structured description of one broken scenario. It answers 4 questions:

1. **What's broken?**
2. **How do I break it on purpose?**
3. **What clues does the agent get?**
4. **How do I know if the agent fixed it?**

That's the whole idea. Everything below is just the format.

---

## The Basic Format

```yaml
id: 1
title: "Login is broken because of a typo"

# 1. What's broken
broken:
  service: auth
  symptom: "Users get 500 error when logging in"

# 2. How to break it on purpose
inject:
  type: code_change
  file: src/auth.js
  change: "Rename variable 'password' to 'passsword'"

# 3. What the agent gets to see (NOT the answer above)
agent_sees:
  log: "TypeError: cannot read property 'passsword' of undefined"
  failing_endpoint: POST /login
  status_code: 500

# 4. How we check if the agent fixed it
check_fix:
  command: "npm test -- login.test.js"
  expect: pass
```

**Important rule:** The agent only sees the `agent_sees` section. It does NOT see how we broke it. It has to figure that out itself — that's the whole point of the test.

---

## Research: How real benchmarks structure this

I looked at how the established benchmarks do it. Each one solves a different piece of the problem. Sentinel borrows the best parts of each.

### SWE-bench (Princeton, ICLR 2024)
The standard for "can an AI fix a bug" benchmarks. **500 real GitHub issues**, each isolated in a Docker container. The agent's fix is applied as a **patch file**, then **unit tests** decide pass/fail. Variants: SWE-bench Lite, Verified, Multimodal, Pro.

→ **What we steal:** patch-based fixes, unit tests as the source of truth, Docker isolation.

### RCAEval (ACM Web Conference 2025)
Closest thing to what we're building. **735 failure cases** across microservice systems, covering **11 fault types** in 3 buckets:
- **Network faults** — delay, packet loss
- **Resource faults** — CPU hog, memory leak
- **Code-level faults** — missing parameters, exception handling

→ **What we steal:** the fault taxonomy. We adopt these categories.

### OpenRCA (ICLR 2025)
**1,753 failure records** with full telemetry. Input = natural language query + telemetry. Output = structured JSON identifying root cause across three dimensions: *which service*, *which metric*, *which event type*.

→ **What we steal:** root cause as a structured triple, not free text. Easier to score.

### LitmusChaos / Chaos Mesh (CNCF)
Production chaos engineering. Splits the spec into 3 Kubernetes resources:
- `ChaosExperiment` — what fault to inject (the "weapon")
- `ChaosEngine` — where to inject it (target selectors)
- `ChaosResult` — what happened

→ **What we steal:** separating *what's broken* from *what's targeted* from *what's observed*.

### Google SRE Postmortem
Not a benchmark, but the canonical incident format. Fields: timeline, detection method, blast radius, severity (SEV1–4), action items, lessons learned.

→ **What we steal:** severity tiers, blast radius, timeline.

---

## Updated Format (incorporates the research)

```yaml
# ─── Identity ──────────────────────────────────────────
id: SRE-0001
title: "Login broken after auth service deploy"
severity: SEV2          # SEV1=outage, SEV2=major, SEV3=degraded, SEV4=minor
difficulty: easy        # easy | medium | hard

# ─── Fault Type (from RCAEval taxonomy) ────────────────
fault_type: code        # code | config | resource | network | integration
fault_subtype: typo     # typo, null_deref, race, memory_leak, cpu_hog,
                        # network_delay, packet_loss, missing_param,
                        # bad_env_var, expired_secret, rate_limit, etc.

# ─── Target (from LitmusChaos pattern) ─────────────────
target:
  app: sample-app
  service: auth
  endpoint: POST /login
  base_commit: a3f9c1b   # healthy starting state

# ─── Injection ─────────────────────────────────────────
inject:
  type: code_change       # code_change | config_change | runtime_fault
  file: src/auth.js
  patch: ./patches/SRE-0001.diff   # or inline change
  apply_at: t+0s

# ─── Detection Signals (the agent's input) ─────────────
agent_sees:
  logs:
    - "TypeError: cannot read property 'passsword' of undefined"
  metrics:
    - "http.errors on /login spiked from 0 to 100% at 14:32"
  traces:                 # optional, for distributed scenarios
    - "auth-service span fails with status_code=500"
  health_checks:
    - endpoint: /healthz
      status: 503

# ─── Ground Truth (hidden from agent, scorer only) ─────
ground_truth:
  # Structured triple (OpenRCA pattern)
  root_cause:
    service: auth
    component: src/auth.js
    cause: "variable rename typo: password → passsword"
  fix_patch: ./fixes/SRE-0001.diff
  blast_radius: "All login attempts fail; ~100% of active users blocked"

# ─── Validation (SWE-bench pattern) ────────────────────
check_fix:
  pre_fix_tests:                  # confirm bug is real
    - cmd: "npm test -- login.test.js"
      expect: fail
  post_fix_tests:                 # agent's exam
    - cmd: "npm test -- login.test.js"
      expect: pass
    - cmd: "npm test"             # full regression
      expect: pass
  signals_clear:                  # symptoms gone
    - "http.errors on /login < 1% for 60s"

# ─── Scoring ───────────────────────────────────────────
scoring:
  max_mttr_seconds: 600
  partial_credit:
    detected: 0.2     # noticed something is wrong
    diagnosed: 0.3    # named the right service + cause
    fixed: 0.5        # patch passes validation
```

---

## Severity Tiers (Google SRE Convention)

| Severity | Meaning | Example | MTTR target |
|---|---|---|---|
| **SEV1** | Total outage, all users affected | Site is down, payments offline | < 15 min |
| **SEV2** | Major feature broken, many users | Login fails, checkout broken | < 1 hour |
| **SEV3** | Degraded experience, some users | Slow page loads, retries needed | < 4 hours |
| **SEV4** | Minor issue, isolated impact | One report failing for one user | < 24 hours |

Your benchmark should mix all four.

---

## Fault Taxonomy (RCAEval-Inspired, Expanded)

### 1. Code faults
- Typo / variable rename
- Null / undefined dereference
- Off-by-one error
- Race condition
- Infinite loop
- Missing parameter
- Wrong operator (`==` vs `===`, `>` vs `>=`)
- Exception not caught

### 2. Config faults
- Wrong env variable
- Missing secret
- Bad CORS origin
- Wrong port number
- Expired API key
- Misformatted JSON/YAML
- Wrong feature flag value

### 3. Resource faults
- Memory leak
- CPU hog (infinite loop in background)
- Connection pool exhausted
- Disk full
- File descriptor leak
- Thread starvation

### 4. Network faults *(chaos-style, runtime injection)*
- High latency
- Packet loss
- DNS failure
- Connection refused
- TLS cert expired

### 5. Integration faults
- Third-party API down
- Third-party API slow (timeout)
- Rate limit hit
- Webhook delivery failure
- Database deadlock
- Schema mismatch (old client, new server)

Aim for **3 incidents per subtype** across 5 categories. Roughly **30–40 incidents total** is a respectable benchmark size — RCAEval has 735 but that's a multi-year team effort.

---

## Three Incident "Shapes" (How They're Injected)

Different fault types need different injection mechanisms. Be aware which shape each spec uses.

### Shape A: Bad commit (SWE-bench style)
A code change is committed that introduces a bug. Used for: code faults, some config faults.
```yaml
inject:
  type: code_change
  patch: ./patches/SRE-0001.diff
```

### Shape B: Runtime fault injection (chaos style)
The code is fine — the *environment* is broken. Used for: network faults, resource faults.
```yaml
inject:
  type: runtime_fault
  tool: tc                     # linux traffic control, or chaos-mesh
  action: "add 500ms latency to all /api/* requests"
```

### Shape C: Config drift
An env var or config file is mutated. Used for: config faults, some integration faults.
```yaml
inject:
  type: config_change
  file: .env.production
  change: "ALLOWED_ORIGINS=https://exmaple.com"   # typo
```

---

## What the Agent Gets vs. What's Hidden

This is the most important rule and worth restating:

| Block | Agent sees? | Why |
|---|---|---|
| `agent_sees` (logs, metrics, traces, health) | ✅ Yes | This is the input. Realistic SRE signals. |
| `target.service`, `target.endpoint` | ✅ Yes | The agent knows what to monitor. |
| `inject.*` | ❌ No | Knowing the answer defeats the test. |
| `ground_truth.*` | ❌ No | Used only by scorer. |
| `check_fix.post_fix_tests` | ❌ No | Otherwise the agent can game the tests. |

The agent is given: a running broken app + observability signals + the source code. It must **deduce** the rest.

---

## Scoring Model (Adapted from OpenRCA + SWE-bench)

For each incident, the agent gets a score 0.0 → 1.0:

```
score = 0.2 * detected      (noticed something is wrong)
      + 0.3 * diagnosed     (correctly named root cause triple:
                              service + component + cause)
      + 0.5 * fixed         (patch passes post_fix_tests)

if mttr > max_mttr_seconds:
    score = score * 0.5     (time penalty)
```

Aggregate benchmark score = average across all incidents, optionally weighted by severity.

Report these numbers in your paper:
- **Resolution rate** — % of incidents fully fixed
- **Diagnosis accuracy** — % where root cause was correctly identified
- **Median MTTR** — time to fix
- **Per-category breakdown** — which fault types is your agent good/bad at?

---

## How You'll Use This

1. Write **~30 specs** across the 5 fault categories
2. Build a **runner** that reads a spec, breaks the app, hands signals to the agent
3. Build a **scorer** that runs `check_fix` and computes the score
4. Run your agent over all specs → publish numbers

That's the project's measurable result.

---

## Sources

- [SWE-bench (GitHub)](https://github.com/SWE-bench/SWE-bench)
- [SWE-bench paper (ICLR 2024)](https://arxiv.org/pdf/2310.06770)
- [RCAEval (ACM Web Conference 2025)](https://dl.acm.org/doi/10.1145/3701716.3715290)
- [OpenRCA (ICLR 2025)](https://openreview.net/pdf?id=M4qNIzQYpd)
- [LitmusChaos experiment construction](https://docs.litmuschaos.io/docs/user-guides/construct-experiment)
- [Google SRE Postmortem template](https://sre.google/sre-book/example-postmortem/)
- [Google SRE Postmortem culture](https://sre.google/workbook/postmortem-culture/)
- [LO2: Microservice anomaly dataset](https://arxiv.org/html/2504.12067v1)
- [Awesome LLM-AIOps](https://github.com/Jun-jie-Huang/awesome-LLM-AIOps)
