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

# Related Work

This section surveys prior benchmarks for software-failure resolution and root-cause analysis. The SREBench design is informed by gaps and patterns identified in these works.

## Comparative Survey of Existing Benchmarks

| Benchmark | Cases | Closes the loop (auto-fix)? | Fault categories | Source of failures | Year |
|---|---|---|---|---|---|
| Defects4J [1] | 357 (v1.0) | ❌ (test gen only) | Java code defects | Real OSS bug history | 2014 |
| Cloud Bug Study [2] | 3,655 vital issues | ❌ (taxonomy only) | 6 cloud systems (Hadoop, HDFS, HBase, Cassandra, ZooKeeper, Flume) | Real issue trackers | 2014 |
| SWE-bench [3] | 2,294 (full) / 500 (Lite) | ✅ (patch + test gate) | Code only (Python OSS) | Real GitHub issue + PR pairs | 2024 |
| RCAEval [4] | 735 failure cases | ❌ (RCA only) | 11 fault types (network, resource, code) across 3 microservice systems | Semi-synthetic (controlled injection on real systems) | 2025 |
| OpenRCA [5] | 335 failures, 68 GB telemetry | ❌ (RCA only) | Multi-source telemetry (logs, metrics, traces) | Enterprise system records | 2025 |
| **SREBench (this work)** | 30+ (target) | ✅ (autonomous patch + signal-clear) | 5 categories × ~25 subtypes incl. integration faults | Synthetic on a controlled patient app, derived from public postmortems | 2026 |

## What SREBench Adopts from Prior Work

- **From SWE-bench [3]:** patch-based fix submission, unit tests as the verification oracle, container-based isolation. SWE-bench established that pass/fail tests are a robust automated grading signal — we reuse this `pre_fix_tests` / `post_fix_tests` pattern verbatim.
- **From Defects4J [1]:** the buggy/fixed version pair structure, with the reverse patch acting as the fault injection.
- **From RCAEval [4]:** the fault taxonomy. Pham et al. enumerate 11 fault types across network, resource, and code-level categories on three microservice testbeds. SREBench adopts the *categories* but adds a fifth (integration) for third-party API failure modes that microservice-only benchmarks tend to under-represent.
- **From OpenRCA [5]:** representing root cause as a structured triple rather than free text. Xu et al. evaluate LLMs on three-element root cause output (which service, which component, which event type), making automated grading of *diagnosis* (not just *fix*) tractable.
- **From the Cloud Bug Study [2]:** the empirical observation that misconfiguration, resource leaks, and cross-service dependency failures dominate real cloud incidents — informing the weight given to those categories in our spec.
- **From Google SRE practice [6]:** severity tiers (SEV1–SEV4) and the postmortem fields (timeline, blast radius, root cause, action items) that structure each spec's `ground_truth` block.
- **From chaos engineering [7] [8] [9]:** runtime fault-injection primitives (network latency, packet loss, resource pressure) for the subset of incidents that cannot be expressed as a code patch.

## Identified Gap

No existing benchmark closes the full loop **autonomous detection → diagnosis → repair → verification** for SRE-class incidents. SWE-bench [3] closes it for code defects from issue trackers, but not for production incidents driven by deploys, configs, or runtime faults. RCAEval [4] and OpenRCA [5] evaluate diagnosis only — they stop before fix generation. SREBench targets this gap: a single-loop benchmark grading agents on detection, diagnosis, and verified fix in unison, with severity-weighted MTTR as the primary metric (per [6]'s incident-management practice).

---

# Methodology

## Why these 5 fault categories

The five top-level categories (`code`, `config`, `resource`, `network`, `integration`) follow the structure established by:
- Pham et al. [4] for the first three (code, resource, network),
- Gunawi et al. [2] for the empirical observation that **misconfiguration is among the leading bug categories** in cloud systems (motivating `config` as a top-level rather than nested category),
- Industry chaos-engineering taxonomies [7] for the runtime-vs-deploy axis.

We add `integration` (third-party API failures, rate limits, webhook failures) explicitly because microservice-internal benchmarks like RCAEval [4] do not cover external dependencies, yet public postmortems consistently cite third-party outages as a major incident class.

## Why severity tiers

The SEV1–SEV4 scheme is the de-facto industry convention popularized by the Google SRE book [6] and adopted across most incident-management tooling. We use it because (a) it maps to commonly published `max_mttr_seconds` targets and (b) allows severity-weighted aggregate scoring.

## Why partial credit

Pure pass/fail scoring (à la SWE-bench [3]) penalizes early-stage agents that correctly *diagnose* but cannot yet *fix*. OpenRCA [5] shows that even strong LLMs solve only 11.34% of failure cases end-to-end with current tooling — meaning a binary score would yield uninformative near-zero results. We adopt the OpenRCA pattern of grading the structured root-cause triple separately from the fix, with the weights `0.2 detected + 0.3 diagnosed + 0.5 fixed` reflecting the relative difficulty observed in [5].

## Why the agent must not see the injection block

The hidden-injection rule is borrowed from Defects4J's [1] separation between the buggy version (visible to the tool) and the developer fix (held out as oracle). Without this isolation, the benchmark would test compliance, not diagnosis.

---

# The Spec Format (Updated, Research-Aligned)

```yaml
# ─── Identity ──────────────────────────────────────────
id: SRE-0001
title: "Login broken after auth service deploy"
severity: SEV2          # SEV1=outage, SEV2=major, SEV3=degraded, SEV4=minor    [6]
difficulty: easy        # easy | medium | hard

# ─── Fault Type (RCAEval taxonomy + extensions) ────────
fault_type: code        # code | config | resource | network | integration   [2,4]
fault_subtype: typo     # see "Fault Taxonomy" section

# ─── Target (LitmusChaos pattern: target-vs-fault separation) ──
target:                 # [7]
  app: sample-app
  service: auth
  endpoint: POST /login
  base_commit: a3f9c1b

# ─── Injection ─────────────────────────────────────────
inject:
  type: code_change       # code_change | config_change | runtime_fault
  file: src/auth.js
  patch: ./patches/SRE-0001.diff   # buggy/fixed pair pattern from [1]
  apply_at: t+0s

# ─── Detection Signals (the agent's input) ─────────────
agent_sees:             # multi-modal telemetry per [5]
  logs:
    - "TypeError: cannot read property 'passsword' of undefined"
  metrics:
    - "http.errors on /login spiked from 0 to 100% at 14:32"
  traces:
    - "auth-service span fails with status_code=500"
  health_checks:
    - endpoint: /healthz
      status: 503

# ─── Ground Truth (hidden from agent, scorer only) ─────
ground_truth:
  root_cause:                              # structured triple per [5]
    service: auth
    component: src/auth.js
    cause: "variable rename typo: password → passsword"
  fix_patch: ./fixes/SRE-0001.diff          # gold patch per [3]
  blast_radius: "All login attempts fail; ~100% of active users blocked"  # [6]

# ─── Validation (SWE-bench pattern) ────────────────────
check_fix:
  pre_fix_tests:                  # confirm bug is real (per [3])
    - cmd: "npm test -- login.test.js"
      expect: fail
  post_fix_tests:                 # agent's exam (per [3])
    - cmd: "npm test -- login.test.js"
      expect: pass
    - cmd: "npm test"             # full regression
      expect: pass
  signals_clear:                  # symptom-clear check, novel to SREBench
    - "http.errors on /login < 1% for 60s"

# ─── Scoring ───────────────────────────────────────────
scoring:
  max_mttr_seconds: 600           # severity-weighted, per [6]
  partial_credit:                 # weights informed by [5]'s observation
    detected: 0.2                 # of 11.34% E2E success — full pass/fail
    diagnosed: 0.3                # would be uninformative
    fixed: 0.5
```

---

## Severity Tiers (Google SRE convention [6])

| Severity | Meaning | Example | MTTR target |
|---|---|---|---|
| **SEV1** | Total outage, all users affected | Site is down, payments offline | < 15 min |
| **SEV2** | Major feature broken, many users | Login fails, checkout broken | < 1 hour |
| **SEV3** | Degraded experience, some users | Slow page loads, retries needed | < 4 hours |
| **SEV4** | Minor issue, isolated impact | One report failing for one user | < 24 hours |

## Fault Taxonomy

Categories follow Pham et al. [4] (code, resource, network); the `config` category is elevated based on Gunawi et al. [2]'s finding that misconfiguration is a dominant bug class in cloud systems; the `integration` category is added as a contribution of this work.

### 1. Code faults [4]
Typo / variable rename · null/undefined dereference (or `unwrap()` panic in Rust) · off-by-one · race condition · infinite loop · missing parameter · wrong operator · uncaught exception

### 2. Config faults [2]
Wrong env variable · missing secret · bad CORS origin · wrong port · expired API key · misformatted JSON/YAML · wrong feature flag value

### 3. Resource faults [4]
Memory leak · CPU hog · connection pool exhausted · disk full · file descriptor leak · thread starvation

### 4. Network faults (chaos-style runtime injection) [4] [7] [8]
High latency · packet loss · DNS failure · connection refused · TLS cert expired

### 5. Integration faults *(this work, motivated by [2])*
Third-party API down · third-party API slow (timeout) · rate limit hit · webhook delivery failure · database deadlock · schema mismatch

Target distribution: ~3 incidents per subtype × 5 categories ≈ 30–40 total. RCAEval's [4] 735 cases is a multi-year team effort; 30+ is a respectable starting size for a single-author benchmark.

---

## Three Injection Shapes

| Shape | Used for | Inspired by |
|---|---|---|
| **A. Bad commit** (apply a `.diff`) | Code faults | [1] Defects4J's buggy/fixed pair |
| **B. Runtime fault** (chaos tool) | Network, resource faults | [7] [8] Chaos Mesh / LitmusChaos primitives |
| **C. Config drift** (env or file mutation) | Config faults | [2] Gunawi et al. on misconfig prevalence |

---

## Visibility Rule

| Block | Agent sees? | Why |
|---|---|---|
| `agent_sees` | ✅ Yes | The input — realistic SRE signals per [5] |
| `target.service`, `target.endpoint` | ✅ Yes | What to monitor |
| `inject.*` | ❌ No | Hiding the injection enforces *diagnosis*, not compliance — pattern from [1] |
| `ground_truth.*` | ❌ No | Scorer only |
| `check_fix.post_fix_tests` | ❌ No | Otherwise the agent gates against the answer (anti-pattern flagged in [3]) |

---

## Scoring Formula

```
score = 0.2 · detected + 0.3 · diagnosed + 0.5 · fixed

if mttr > max_mttr_seconds:
    score = score × 0.5
```

Reportable benchmark metrics (paper-ready):
- **Resolution rate** — % fully fixed (comparable to SWE-bench resolution rate [3])
- **Diagnosis accuracy** — % with correct root-cause triple (comparable to OpenRCA [5])
- **Median MTTR** — primary SRE metric per [6]
- **Per-category breakdown** — slicing by fault type per [4]

---

# References

[1] **R. Just, D. Jalali, and M. D. Ernst.** "Defects4J: A Database of Existing Faults to Enable Controlled Testing Studies for Java Programs." In *Proceedings of the International Symposium on Software Testing and Analysis (ISSTA)*, pp. 437–440, San Jose, CA, USA, July 2014. DOI: [10.1145/2610384.2628055](https://doi.org/10.1145/2610384.2628055)

[2] **H. S. Gunawi, M. Hao, T. Leesatapornwongsa, T. Patana-anake, T. Do, J. Adityatama, K. J. Eliazar, A. Laksono, J. F. Lukman, V. Martin, and A. D. Satria.** "What Bugs Live in the Cloud? A Study of 3000+ Issues in Cloud Systems." In *Proceedings of the ACM Symposium on Cloud Computing (SoCC)*, Seattle, WA, USA, November 2014. DOI: [10.1145/2670979.2670986](https://doi.org/10.1145/2670979.2670986)

[3] **C. E. Jimenez, J. Yang, A. Wettig, S. Yao, K. Pei, O. Press, and K. R. Narasimhan.** "SWE-bench: Can Language Models Resolve Real-world GitHub Issues?" In *Proceedings of the Twelfth International Conference on Learning Representations (ICLR)*, Vienna, Austria, May 2024. URL: [https://openreview.net/forum?id=VTF8yNQM66](https://openreview.net/forum?id=VTF8yNQM66) · arXiv: [2310.06770](https://arxiv.org/abs/2310.06770)

[4] **L. Pham, H. Zhang, H. Ha, F. Salim, and X. Zhang.** "RCAEval: A Benchmark for Root Cause Analysis of Microservice Systems with Telemetry Data." In *Companion Proceedings of the ACM Web Conference (WWW Companion)*, Sydney, Australia, April–May 2025. DOI: [10.1145/3701716.3715290](https://doi.org/10.1145/3701716.3715290) · arXiv: [2412.17015](https://arxiv.org/abs/2412.17015) · Code: [phamquiluan/RCAEval](https://github.com/phamquiluan/RCAEval)

[5] **J. Xu, Q. Zhang, Z. Zhong, S. He, C. Zhang, Q. Lin, D. Pei, P. He, D. Zhang, and Q. Zhang.** "OpenRCA: Can Large Language Models Locate the Root Cause of Software Failures?" In *Proceedings of the Thirteenth International Conference on Learning Representations (ICLR)*, Singapore, April 2025. URL: [https://openreview.net/forum?id=M4qNIzQYpd](https://openreview.net/forum?id=M4qNIzQYpd) · Code: [microsoft/OpenRCA](https://github.com/microsoft/OpenRCA)

[6] **B. Beyer, C. Jones, J. Petoff, and N. R. Murphy (Editors).** *Site Reliability Engineering: How Google Runs Production Systems.* O'Reilly Media, 1st ed., 2016. ISBN: 978-1491929124. Online edition: [https://sre.google/sre-book/](https://sre.google/sre-book/)

[7] **A. Basiri, N. Behnam, R. de Rooij, L. Hochstein, L. Kosewski, J. Reynolds, and C. Rosenthal.** "Chaos Engineering." *IEEE Software*, vol. 33, no. 3, pp. 35–41, May–June 2016. DOI: [10.1109/MS.2016.60](https://doi.org/10.1109/MS.2016.60)

[8] **LitmusChaos Project (CNCF).** "Construct chaos experiment YAML." *LitmusChaos Documentation*, accessed 2026-05-10. URL: [https://docs.litmuschaos.io/docs/user-guides/construct-experiment](https://docs.litmuschaos.io/docs/user-guides/construct-experiment)

[9] **Chaos Mesh Project (CNCF).** "Chaos Mesh: A Powerful Chaos Engineering Platform for Kubernetes." Accessed 2026-05-10. URL: [https://chaos-mesh.org/](https://chaos-mesh.org/)

---

## Citations Index (for the Reviewer)

Every claim in the Related Work, Methodology, and Spec sections is annotated with `[N]` matching the entries above. Sections marked *(this work)* or unattributed are the author's contribution. References are formatted in IEEE / numeric style. A BibTeX file (`docs/references.bib`) will accompany the final paper submission.

## Open Questions (to resolve before final paper)

- **Real wall-clock vs simulated time** for MTTR measurement — both have precedent ([5] uses real, [3] uses simulated)
- **Multi-fault scenarios** (cascading failures) — reserved for v2 of the benchmark
- **Non-deterministic incidents** (race conditions) — require seeded randomness; document seed in spec
- **Cost tracking** — record the agent's LLM token spend per incident as a secondary axis (not done by [3], [4], [5])
