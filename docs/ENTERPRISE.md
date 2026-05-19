# Enterprise Integration — From `./apps/` to Production

> How Sentinel onboards into a real enterprise stack. Same manifest contract, different signal sources.

---

## TL;DR

Customer writes **one YAML file** per service, points an alert webhook at us, grants scoped read tokens. Done. **No code changes to their app. No SDK. No instrumentation.** Time to first value: ~1 day.

---

## Module 1 · The Integration Surface

The `srebench.yaml` manifest is the only contract. In the demo it points at docker-compose + local logs. In production it points at whatever the customer already runs.

```yaml
name: checkout-service
language: java
source_root: github://acme/checkout-service@main   # git, not local fs
runtime: kubernetes                                 # not docker-compose

commands:
  restart: kubectl rollout restart deploy/checkout -n prod
  test:    kubectl exec deploy/checkout -n prod -- mvn test

signals:
  logs:    { type: datadog,    query: 'service:checkout env:prod status:error' }
  metrics: { type: prometheus, url: https://prom.acme.internal/api/v1/query }
  health:  { type: http,       url: https://api.acme.com/checkout/healthz }
  alerts:  { type: pagerduty,  service_id: PXXXXX }   # incoming webhook

policy:
  read_only: false
  approval_required_above_risk: medium               # human gate
  allowed_repos: [acme/checkout-service]
```

The platform code doesn't change — **adapters do**. The `server/sentinel/adapters/{logs,metrics,health,runtime}/base.py` abstract base classes are already designed for this.

### Adapters to ship for enterprise

| Layer | Demo (today) | Enterprise (v1) |
|---|---|---|
| Logs | `docker logs` | Datadog, Splunk, CloudWatch, ELK, Sentry, Loki |
| Metrics | Prometheus scrape | Datadog Metrics, New Relic, Grafana Cloud |
| Health | HTTP GET | same — no change needed |
| Runtime | `docker compose` | `kubectl`, AWS ECS, GKE, ArgoCD, Spinnaker |
| Code | local filesystem | GitHub / GitLab API @ deploy SHA |
| Patch apply | `git checkout` + restart | Open PR via GitHub API |
| Alert source | none (manual) | PagerDuty, Opsgenie, Grafana OnCall |

Each adapter is ~50 LOC implementing the existing ABC.

---

## Module 2 · Deployment Topologies

Three modes, customer picks based on data-sensitivity:

| Mode | Customer keeps | Sentinel keeps | Best fit |
|---|---|---|---|
| **SaaS** | source code (read via API) | agent runs + logs + scores | Small teams, fast onboarding |
| **VPC-peered agent** | everything except agent reasoning | structured event traces only | Mid-market, data-sensitive |
| **Self-hosted (Helm)** | everything | nothing — they run it all | Regulated (finance, healthcare) |

In all three modes the customer's app stays untouched — Sentinel only ever reads signals + opens PRs.

---

## Module 3 · The Real-World Loop

```
1.  PagerDuty fires alert: "p99 > 2s on checkout-service"
        ↓
2.  Sentinel webhook receives the page
        ↓
3.  Loads checkout-service manifest, spawns agent run
        ↓
4.  Agent uses Datadog API (logs), Prom (metrics), GitHub API (source @ deploy SHA)
        ↓
5.  Diagnoses bug → opens PR on acme/checkout-service
        ↓
6.  CI runs tests → all pass
        ↓
7.  Slack: "Found bug at OrderService.java:107 — PR #4521 — tests passing. Approve?"
        ↓
8.  [Human ✓] → ArgoCD picks up merge → deploys → Sentinel verifies → done
        ↓
9.  Sentinel writes postmortem from JSONL audit trail
```

Score for that incident gets logged. Customer sees MTTR + recovery_rate trend on their dashboard.

---

## Module 4 · Onboarding (Customer's First Day)

### Step 1 — Install (15 min)
Pick deployment mode:
- **SaaS**: sign up at sentinel.dev, get API key
- **VPC agent**: `helm install sentinel-agent` (runs inside their cluster)
- **Self-host**: `helm install sentinel` (everything in their infra)

### Step 2 — Write the manifest (30 min per service)
One `srebench.yaml` per service onboarded. Points at:
- Their existing logs (Datadog / Splunk / etc)
- Their existing metrics (Prom / New Relic / etc)
- Their existing health endpoint
- Restart + test commands they already run (`kubectl …`)
- Policy: `read_only`? Approval threshold?

### Step 3 — Connect alert source (5 min)
Add Sentinel webhook URL to PagerDuty (or Opsgenie / Grafana OnCall). Sentinel now receives the same pages humans receive.

### Step 4 — Grant scoped permissions (15 min)
- **Read**: source repo (GitHub / GitLab token, scoped to allowed_repos)
- **Read**: observability APIs (Datadog / Splunk tokens, read-only)
- **Write**: open PRs (token scoped to `allowed_repos` in manifest)
- **Optional**: restart pods (kubectl Role, scoped to one namespace)

All scopes are least-privilege. Sentinel cannot access anything outside the manifest's declared surface.

### Step 5 — Shadow mode (1–2 weeks)
- Agent runs on every alert but **proposes only** — no auto-merge
- Customer reviews PRs in Slack
- Sentinel learns their patterns, customer builds trust
- Score every shadow run against the eventual human fix → calibrates confidence

### Step 6 — Graduate to auto-fix
- Flip policy: `easy`/`medium` incidents auto-merge if tests pass
- `hard` incidents still require human ✓
- Track `recovery_rate` + `MTTR` vs human baseline → ROI dashboard for the customer

**Total time-to-first-value: ~1 day** for the first service. ~30 min per additional service after that.

---

## Module 5 · Security Posture (the obvious enterprise question)

| Concern | Answer |
|---|---|
| What can Sentinel read? | Only the source repo and observability tokens declared in the manifest. |
| What can it write? | Only PRs against `allowed_repos`. Restart only if `commands.restart` is provided. |
| Can it ship to prod without a human? | Only if `read_only: false` AND `approval_required_above_risk: high`. Conservative defaults block this. |
| What if the LLM goes rogue? | All actions go through `policy.py` gate. Patches that fail post-fix-tests aren't marked solved — the PR stays closed. |
| Audit trail? | Every action JSONL-logged in `evidence/<run_id>.jsonl`. Customers can ship those logs to their SIEM. |
| Data residency? | VPC-peered or self-host mode keeps everything in customer's network. SaaS sends only structured event traces. |
| Where does the LLM run? | Anthropic API by default. Self-host customers can swap to AWS Bedrock or Azure OpenAI or a local model. |

---

## Module 6 · Pricing Lever (for the startup arc)

Charge per **resolved incident**, not per seat. Aligns incentives — if Sentinel doesn't fix it, customer doesn't pay.

| Tier | What | Price model |
|---|---|---|
| Starter | First 50 incidents/mo on 3 services | $499/mo flat |
| Team | Unlimited services, 500 incidents/mo | $25/incident over 100 |
| Enterprise | Self-hosted + custom adapters + SLA | Annual contract |

Compare: human SRE oncall costs ~$50k–$120k base + on-call premium. One agent license replaces ~30% of that workload after shadow mode graduation.

---

## Module 7 · The Pitch Slide

One slide for the panel titled **"From `./apps/` to production"**:

```
┌────────────────────────────────────────────────────┐
│  Same manifest. Different signal types.            │
├────────────────────────────────────────────────────┤
│                                                     │
│   DEMO (today)              PRODUCTION (v1)         │
│   ─────────────             ──────────────          │
│   docker logs        ───►   Datadog / Splunk        │
│   prometheus scrape  ───►   New Relic / Grafana     │
│   docker compose     ───►   Kubernetes / ECS        │
│   local fs           ───►   GitHub / GitLab API     │
│   git checkout       ───►   Open PR + CI gate       │
│   (manual trigger)   ───►   PagerDuty webhook       │
│                                                     │
│   Platform code: unchanged.                         │
│   Adapter: ~50 LOC per integration.                 │
│                                                     │
└────────────────────────────────────────────────────┘
```

The line that lands the room:

> *"You don't rewire your stack to use us. You write a 30-line manifest pointing at what you already have."*
