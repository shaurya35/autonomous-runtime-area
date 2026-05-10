# Incident Assignments — Team Distribution

20 incidents distributed across the team. Each person owns **5 specs: 1 hard, 1 medium, 3 easy**, balanced across fault categories. The patient app is the Rust `shop-api` (Axum + Postgres + Stripe stub). Each owner is responsible for:

1. Writing the YAML spec (per `INCIDENT_SPEC.md`)
2. Writing the injection patch / config / fault
3. Writing the gold-truth fix patch
4. Writing the validation tests (`pre_fix_tests`, `post_fix_tests`)
5. Verifying the spec is reproducible end-to-end

---

## Master Table

| ID | Title | Category | Difficulty | Owner |
|---|---|---|---|---|
| SRE-0001 | Login crashes on missing password (`unwrap()` panic) | code | easy | Shaurya |
| SRE-0002 | Wrong CORS origin breaks frontend | config | easy | Shalini |
| SRE-0003 | Wrong port number in config | config | easy | Shaurya |
| SRE-0004 | Missing required env var, no default | config | easy | Faizan |
| SRE-0005 | `/healthz` returns 200 even when DB is down | code | easy | Shalini |
| SRE-0006 | `/products` pagination off-by-one (skips first item) | code | easy | Shaurya |
| SRE-0007 | Wrong status code on validation error (200 instead of 400) | code | easy | Faizan |
| SRE-0008 | Hardcoded JWT secret with wrong value | config | easy | Spandan |
| SRE-0009 | `cart/add` accepts negative quantity | code | easy | Faizan |
| SRE-0010 | JWT token expires after 1 second (wrong duration unit) | config | easy | Shalini |
| SRE-0011 | Logging level set to DEBUG in prod, errors hidden | config | easy | Spandan |
| SRE-0012 | Wrong database name in connection string | config | easy | Spandan |
| SRE-0013 | Connection pool exhausted under moderate load | resource | medium | Shaurya |
| SRE-0014 | Race condition in inventory decrement (oversells) | code | medium | Shalini |
| SRE-0015 | Stripe API slow, no timeout — checkout hangs | integration | medium | Faizan |
| SRE-0016 | Memory leak in session cache (no eviction) | resource | medium | Spandan |
| SRE-0017 | Deadlock between cart-lock and inventory-lock | resource | hard | Shalini |
| SRE-0018 | Partial schema migration causes intermittent 500s | integration | hard | Faizan |
| SRE-0019 | Cascading failure when Redis is down (no circuit breaker) | integration | hard | Spandan |
| SRE-0020 | Async task starvation (blocking call inside `tokio::spawn`) | resource | hard | Shaurya |

---

## Per-Person Assignments

### 👤 Shaurya — Code + Resource focus

| ID | Difficulty | Title | Touches |
|---|---|---|---|
| SRE-0001 | easy | Login crashes on missing password (`unwrap()` panic) | `routes/auth.rs` |
| SRE-0003 | easy | Wrong port number in config | `.env`, `main.rs` |
| SRE-0006 | easy | `/products` pagination off-by-one (skips first item) | `routes/products.rs` |
| SRE-0013 | medium | Connection pool exhausted under moderate load | `db.rs`, `Cargo.toml` (sqlx) |
| SRE-0020 | hard | Async task starvation (blocking call inside `tokio::spawn`) | any handler doing CPU/IO work |

**Rationale:** Shaurya is building the Rust patient app, so gets the specs that exercise the *foundational* layers (auth, routing, async runtime). The hard one (async starvation) is genuinely Rust-flavoured — a bug class that doesn't even exist in JS/Python.

---

### 👤 Shalini — Config + Concurrency focus

| ID | Difficulty | Title | Touches |
|---|---|---|---|
| SRE-0002 | easy | Wrong CORS origin breaks frontend | `.env`, CORS middleware |
| SRE-0005 | easy | `/healthz` returns 200 even when DB is down | `routes/health.rs` |
| SRE-0010 | easy | JWT token expires after 1 second (wrong duration unit) | `auth/jwt.rs` |
| SRE-0014 | medium | Race condition in inventory decrement (oversells) | `routes/checkout.rs` |
| SRE-0017 | hard | Deadlock between cart-lock and inventory-lock | `routes/cart.rs`, `routes/checkout.rs` |

**Rationale:** Concurrency theme — the medium+hard pair both involve shared mutable state (Mutex/RwLock). Easy specs touch boundaries (env, JWT, health) so Shalini learns the codebase before tackling the concurrency hard.

---

### 👤 Faizan — Validation + Integration focus

| ID | Difficulty | Title | Touches |
|---|---|---|---|
| SRE-0004 | easy | Missing required env var, no default | `config.rs` |
| SRE-0007 | easy | Wrong status code on validation error (200 instead of 400) | `routes/auth.rs` or `cart.rs` |
| SRE-0009 | easy | `cart/add` accepts negative quantity | `routes/cart.rs` |
| SRE-0015 | medium | Stripe API slow, no timeout — checkout hangs | `integrations/stripe.rs` |
| SRE-0018 | hard | Partial schema migration causes intermittent 500s | `migrations/`, `db.rs` |

**Rationale:** Validation + external dependencies. The hard spec (partial migration) is realistic — a bug we'd actually hit at a real startup mid-deploy. Forces Faizan to think about deploy safety.

---

### 👤 Spandan — Config + Integration resilience focus

| ID | Difficulty | Title | Touches |
|---|---|---|---|
| SRE-0008 | easy | Hardcoded JWT secret with wrong value | `auth/jwt.rs`, `.env` |
| SRE-0011 | easy | Logging level set to DEBUG in prod, errors hidden | `main.rs` (tracing init) |
| SRE-0012 | easy | Wrong database name in connection string | `.env`, `db.rs` |
| SRE-0016 | medium | Memory leak in session cache (no eviction) | `cache.rs`, `routes/auth.rs` |
| SRE-0019 | hard | Cascading failure when Redis is down (no circuit breaker) | `cache.rs`, `routes/products.rs` |

**Rationale:** Resilience theme. The hard spec (cascading failure) requires understanding circuit breakers — a real SRE concept. Spandan learns it through the easies first (config drift) before resilience patterns.

---

## Category Coverage Matrix

Each row = a person, each column = a fault category from the taxonomy in `INCIDENT_SPEC.md`. Numbers = how many specs that person owns in that category.

|  | code | config | resource | network | integration | total |
|---|---|---|---|---|---|---|
| Shaurya | 2 | 1 | 2 | 0 | 0 | 5 |
| Shalini | 2 | 2 | 1 | 0 | 0 | 5 |
| Faizan | 2 | 1 | 0 | 0 | 2 | 5 |
| Spandan | 0 | 3 | 1 | 0 | 1 | 5 |
| **Total** | **6** | **7** | **4** | **0** | **3** | **20** |

**Gap:** zero `network` faults — those need chaos-style runtime injection (`tc qdisc`, packet loss) which depends on infrastructure not yet in the patient app. Defer `network` to v2 of the benchmark, or add 4 specs later when the chaos sidecar exists.

---

## Difficulty Distribution

| Difficulty | Count | %  |
|---|---|---|
| Easy | 12 | 60% |
| Medium | 4 | 20% |
| Hard | 4 | 20% |

Roughly matches RCAEval's [4] difficulty distribution (most cases are tractable, a long tail is hard).

---

## Working Convention

1. Each owner creates `incidents/SRE-NNNN.yaml` following the `INCIDENT_SPEC.md` schema.
2. Patches go in `incidents/patches/SRE-NNNN.diff` (the breakage) and `incidents/fixes/SRE-NNNN.diff` (the gold fix).
3. Owner self-tests: with the patch applied, `pre_fix_tests` must fail. With the gold fix applied, `post_fix_tests` must pass.
4. PR title: `[incident] SRE-NNNN: <short title>`. Branch: `incidents/SRE-NNNN-<owner>`.
5. Two-person review: incidents are reviewed by another team member who hasn't seen the spec to confirm `agent_sees` is enough to diagnose without reading `inject` or `ground_truth`.

---

## Suggested Sprint Plan

| Week | Goal |
|---|---|
| Week 1 | Each person ships their **3 easy** specs (= 12 total) |
| Week 2 | Each person ships their **medium** spec (= 4 total) |
| Week 3 | Each person ships their **hard** spec (= 4 total) |
| Week 4 | Cross-review, fix repro issues, merge into `main` benchmark |
