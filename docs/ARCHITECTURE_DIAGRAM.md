# Sentinel Architecture Diagram

```mermaid
graph TB
    subgraph Browser["Browser (localhost:3000)"]
        UI_Demo["Demo Page\n/demo"]
        UI_Ward["Dashboard\n/dashboard"]
        UI_Incidents["Incident Timeline\n/incidents/[id]"]
        UI_Docs["Docs\n/docs"]
        UI_LB["Leaderboard\n/leaderboard"]
    end

    subgraph Client["Next.js Client"]
        SSE_Client["SSE listener\nsrc/lib/sse.ts"]
        API_Client["REST client\nsrc/lib/api.ts"]
    end

    subgraph Server["FastAPI Server (localhost:8000)"]
        REST["REST API\n/apps  /incidents  /runs"]
        SSE_Server["SSE stream\n/stream/{run_id}"]
        AgentHub["AgentHub\nagent_hub.py"]
        VitalCol["VitalCollector\nvitals.py"]
        Scorer["SREBench Scorer\nsrebench/"]
        ToolReg["Tool Registry\ntools/"]
        DB["In-memory state\n+ RESULTS_DIR/*.json"]
    end

    subgraph SentinelAgent["Sentinel Agent (ReAct loop)"]
        Claude["Claude Sonnet 4.6\nvia Anthropic API"]
        Loop["Observe → Think → Act"]
    end

    subgraph TargetApp["shop-api (Rust/Axum :8080)"]
        Routes["/healthz  /products\n/auth/login  /metrics"]
        SrcCode["Source\nshop-api/src/"]
    end

    subgraph DockerRuntime["Docker Runtime"]
        Container["shop-api container"]
        Rebuild["docker compose up --build"]
    end

    subgraph FileSystem["File System"]
        IncidentYAML["incidents/*.yaml\nfault definitions"]
        Evidence["evidence/{run_id}/*.jsonl\ntool call log"]
        Results["results/{run_id}.json\nfinal score"]
        GitRepo["shop-api repo\n(real source files)"]
    end

    subgraph AnthropicAPI["Anthropic API"]
        LLM["claude-sonnet-4-6"]
    end

    Browser --> Client
    Client --> REST
    Client --> SSE_Server

    REST --> AgentHub
    REST --> DB
    SSE_Server --> AgentHub

    AgentHub --> SentinelAgent
    AgentHub --> VitalCol
    AgentHub --> Scorer

    SentinelAgent --> ToolReg
    Claude <--> AnthropicAPI

    ToolReg -- "read_file / grep" --> GitRepo
    ToolReg -- "write_file / patch" --> GitRepo
    ToolReg -- "docker logs / exec" --> DockerRuntime
    ToolReg -- "run_tests" --> DockerRuntime

    DockerRuntime --> Container
    Container --> Routes
    Rebuild --> Container

    VitalCol -- "GET /products x6/s\nPOST /auth/login" --> Routes

    Scorer --> Results
    AgentHub --> Evidence

    SentinelAgent --> Loop
    Loop --> Claude

    IncidentYAML --> AgentHub
    Results --> DB
```

## Key Flows

### Fault Injection + Agent Dispatch
1. User clicks **Deploy Bug** on Demo page
2. `POST /apps/{app}/inject` applies a real git diff to `shop-api/src/`
3. Docker rebuilds the container (app is literally broken)
4. `POST /apps/{app}/runs` dispatches Sentinel: starts a Claude ReAct loop
5. SSE stream pushes live tool calls + agent reasoning to the browser

### Agent ReAct Loop
1. **Observe** - read Docker logs, grep source files, curl endpoints
2. **Think** - Claude reasons about the fault based on evidence
3. **Act** - write a patch, apply it via `git apply`, trigger rebuild
4. **Verify** - run the test suite; if green, mark resolved

### Vitals (Real Data)
- `VitalCollector` fires 6 parallel `GET /products` every second
- Also probes `POST /auth/login` (no password) to detect SRE-0001 panics
- Measurements stored with timestamps; sparklines reflect actual history

### Scoring
```
score = 0.2 * detect + 0.3 * diagnose + 0.5 * fix - time_penalty
solved if score >= 0.70
```
Result written to `results/{run_id}.json` and reloaded on server restart.
```
