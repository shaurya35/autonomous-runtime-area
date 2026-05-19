# App Manifest Spec — `srebench.yaml`

Every patient app under `./apps/<name>/` must include a `srebench.yaml` at the app root. The platform reads this file once at startup and from then on operates the app entirely through it. **The platform never imports or executes any app-language-specific code** — only the commands and signal URLs declared here.

---

## Full schema

```yaml
# Required
name: shop-api            # unique slug used in API calls and incident IDs

# Informational (platform never switches on these)
language: rust            # rust | python | go | node | ...
runtime: docker-compose   # docker-compose | local-process | k8s (k8s is stub-only in MVP)

# Where the agent reads source code from (relative to repo root)
source_root: ./apps/rust/src
test_root: ./apps/rust/tests    # optional

# Shell commands the platform runs to operate the app
commands:
  build:   docker compose build shop-api
  start:   docker compose up -d shop-api
  stop:    docker compose stop shop-api
  restart: docker compose restart shop-api
  test:    docker compose exec shop-api cargo test    # used by run_tests tool

# Signal sources — how the agent observes the app
signals:
  logs:
    type: docker          # docker | file
    service: shop-api     # for type:docker — the compose service name
    # path: /var/log/shop-api/app.log   # for type:file

  metrics:
    type: prometheus
    url: http://shop-api:8080/metrics   # scrape target

  health:
    type: http
    url: http://shop-api:8080/healthz
    expect_status: 200

# Endpoints — used by load_test.py for synthetic traffic
endpoints:
  - method: GET
    path: /products
  - method: POST
    path: /auth/login
    sample_body: '{"email":"test@example.com","password":"test"}'
  - method: GET
    path: /healthz
```

---

## Field reference

| Field | Required | Description |
|---|---|---|
| `name` | yes | Unique slug. Used in `/apps/{name}`, incident YAML `app:`, and evidence paths. |
| `language` | no | Human-readable only. Platform never branches on this. |
| `runtime` | no | Informational. Only `docker-compose` is fully implemented in MVP. |
| `source_root` | yes | Relative path (from repo root) to source files. Agent's `list_files`/`read_file`/`search_code` tools are scoped to this directory. |
| `test_root` | no | Relative path to test files. If omitted, `source_root` is used. |
| `commands.build` | no | Shell command to build the app image. |
| `commands.start` | no | Shell command to start the app. |
| `commands.stop` | no | Shell command to stop the app. |
| `commands.restart` | yes | Shell command to restart (used by `propose_patch` after applying a fix). |
| `commands.test` | yes | Shell command to run tests (used by `run_tests` tool). |
| `signals.logs.type` | yes | `docker` or `file`. |
| `signals.logs.service` | if type=docker | Docker Compose service name. |
| `signals.logs.path` | if type=file | Absolute or relative path to log file. |
| `signals.metrics.url` | if metrics present | Prometheus scrape URL. |
| `signals.health.url` | if health present | HTTP URL to poll. |
| `signals.health.expect_status` | no | Expected HTTP status (default 200). |
| `endpoints` | no | Used by `load_test.py` to generate synthetic traffic during incident injection. |

---

## Where to place incidents

Incident specs live **with the app**, not in the platform:

```
apps/
  rust/
    srebench.yaml
    incidents/
      SRE-0001.yaml
      SRE-0003.yaml
      ...
```

The platform discovers incidents by scanning `apps/*/incidents/*.yaml`. See `docs/INCIDENT_SPEC.md` for the incident YAML schema.

---

## Minimal working example

A 3-line app serving `/healthz`:

```yaml
name: my-app
source_root: ./apps/my-app/src
commands:
  restart: docker compose restart my-app
  test: docker compose exec my-app python -m pytest
signals:
  logs:
    type: docker
    service: my-app
  health:
    type: http
    url: http://my-app:8080/healthz
```

The platform will start working with this immediately — the agent can read logs, check health, browse source code, and propose patches.
