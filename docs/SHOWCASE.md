# SREBench Showcase — Final Implementation Plan ("Hospital Ward")

> **This is the source of truth.** No further plans should be needed. When approved, an implementor (human or AI) reads modules in order and executes each ticket with zero ambiguity.

---

## Module 00 · Operating Manual

### How to use this document
- Modules are **numbered and self-contained**. Open one, do the work in it, close it.
- Module 09 is the **15-day execution order**. Every other module is reference.
- Anything in `code blocks` is a literal contract — file paths, function signatures, props, response shapes. Do not paraphrase them in code.
- Conventions:
  - `client/` = Next.js 16 dashboard (Bun, Tailwind 4, React 19)
  - `server/` = FastAPI sentinel platform (Python 3.13, uv)
  - `apps/rust/` = `shop-api` patient app (Axum, SQLite, port 8080)
  - All paths are repo-relative unless prefixed with `/`.
- **Read `client/AGENTS.md` before writing any Next.js code.** Next.js 16 has breaking changes vs training data — `params` is a Promise; check `node_modules/next/dist/docs/` if unsure.

### Glossary
- **Patient app**: any service under `./apps/<name>/` with a `srebench.yaml` manifest
- **Incident**: a YAML spec (`apps/<name>/incidents/SRE-NNNN.yaml`) declaring inject + ground-truth + tests
- **Run**: one execution of the agent against one incident; identified by `run_id`
- **Phase**: one of `detecting | diagnosing | fixing | verifying` — emitted by the LLM via `<phase>X</phase>` tags
- **Vitals**: live time-series of `req/s`, `p99 latency`, `error %`, `cpu %` per patient
- **Ward / OR / Chart / Scoreboard**: the four dashboard pages (see Module 04)

### Snapshot of current state
- MVP complete and verified end-to-end: server + dashboard boot, `shop-api` discovered, 33 Python + 5 Rust tests pass
- Current dashboard: dark zinc, mono, plain — needs full visual reskin
- Existing components: `AppCard`, `EvidencePanel`, `IncidentScore`, `PhaseTimeline` (`client/src/components/`)
- Existing lib: `api.ts`, `sse.ts` (`client/src/lib/`)
- Existing routes: `/`, `/apps/[name]`, `/incidents/[id]`, `/leaderboard` (scaffolded)
- 5 incident specs ready: `apps/rust/incidents/SRE-{0001,0003,0006,0013,0020}.yaml`
- Schemas (`IncidentSpec`, `AppManifest`): `server/srebench/schema.py`
- Channel event shape (`ChannelEvent`): `server/sentinel/channel.py`

---

## Module 01 · State & North Star

### What we have (don't rebuild)
| Layer | Path | Status |
|---|---|---|
| FastAPI server | `server/main.py` | working — `/health`, `/apps`, `/incidents/start`, SSE stream |
| Sentinel agent | `server/sentinel/agent.py` | ReAct loop, Claude Sonnet 4.6 |
| 9 tools | `server/sentinel/tools/` | logs/code/exec/patch |
| Adapters | `server/sentinel/adapters/` | docker logs, prometheus, http health |
| Scorer | `server/srebench/scorer.py` | `0.2D + 0.3Dx + 0.5F − MTTR` |
| Rust shop-api | `apps/rust/src/**` | Axum + SQLite, 5 incident-touched points |
| Dashboard scaffold | `client/src/**` | minimal, plain |

### What we're building
A demo-grade showcase: the dashboard becomes a **Hospital Ward** where patient apps live, vitals tick, the AI doctor (Sentinel) handles emergencies. Target: **8–12 min live demo to a panel of teachers**, with a **2–3 week polish sprint**.

### North-star metrics (how we know we're done)
| # | Metric | Target |
|---|---|---|
| N1 | First-time viewer understands metaphor without explanation | ≤ 30 seconds |
| N2 | Live demo wall-clock | ≤ 9:30 (with 30s slack) |
| N3 | Live agent solves SRE-0001 end-to-end | score ≥ 0.85 in ≤ 30s, 4/5 attempts |
| N4 | Dashboard time-to-interactive | ≤ 1.5s on demo laptop |
| N5 | SSE event → DOM update latency | ≤ 200ms |
| N6 | Zero JS console errors during demo flow | 0 |
| N7 | Backup replay video plays correctly | 100% |
| N8 | Q&A canned answers internalized | 6/6 |

### Anti-goals (explicitly out of scope)
- Multi-tenancy, authentication, user accounts
- K8s runtime adapter (interface only, no impl)
- Real chaos sidecar (`tc qdisc`, packet loss) — `network` faults deferred
- Per-customer memory / runbook learning
- Mobile-responsive layout (we're demoing on a 27" monitor)
- Internationalization
- Real Stripe integration (stub stays)
- Net-new incident specs beyond the 5 already shipped

---

## Module 02 · Narrative System

### Metaphor table (commit fully)

| Real concept | Surface | Visual cue |
|---|---|---|
| Patient app | **Patient** | Card with language emoji avatar |
| Logs | **Symptoms** | Auto-scrolling stream, red on error |
| Metric `req_per_sec` | **Heart rate** | bpm-driven heartbeat icon + sparkline |
| Metric `p99_latency_ms` | **Blood pressure** | sparkline, warns above 200ms |
| Metric `error_rate_pct` | **Temperature** | sparkline, warns above 1% |
| Metric `cpu_pct` | **Respiration** | sparkline |
| Health probe | **Pulse check** | green/red dot pulses every probe interval |
| Sentinel agent | **The doctor** | Avatar (blue, stethoscope icon), slides in |
| Incident run | **Emergency / case** | New "case file" opens, gets case number |
| Phase: detecting | 🔍 **Detecting** | Magnifying glass, blue glow |
| Phase: diagnosing | 🩺 **Diagnosing** | Stethoscope, amber glow |
| Phase: fixing | 🛠️ **Treating** | Scalpel/wrench, orange glow |
| Phase: verifying | ✅ **Verifying** | Clipboard check, green glow |
| Score | **Recovery rate** | 0.00–1.00 with big green digits |
| MTTR | **Time to discharge** | mm:ss countdown timer |
| Evidence JSONL | **Patient chart / case notes** | downloadable "chart" |
| `srebench.yaml` | **Admission form** | mentioned in onboarding copy |
| Leaderboard | **Hospital scoreboard** | grid view |

**Rule:** the engineering primitive names (Detecting, Diagnosing, Fixing, Verifying; MTTR; score) stay technical. The metaphor decorates visuals + storytelling beats, never replaces vocabulary the teacher should learn.

### The hook (3 candidates — pick freshest)

| # | Year | Incident | Numbers |
|---|---|---|---|
| H1 | 2021 | Fastly CDN outage | 1 hr offline, ~$200M commerce impact, single config bug |
| H2 | 2021 | Facebook BGP outage | 6 hrs dark, engineers couldn't badge into building to recover |
| H3 | 2024 | Roblox DNS outage | 73 hrs degraded, postmortem author: "we needed something to diagnose this without us" |

**Pivot line (memorize):** *"Every one of these took human engineers 30+ minutes just to **identify** the cause. I'll show you an AI agent that does it in 14 seconds."*

### Story arc (Freytag-style)
1. **Exposition** (0:00–1:45) — Outages cost money. Humans are slow. Existing tools detect but don't fix.
2. **Inciting incident** (1:45–2:30) — Meet the Ward. Patients are healthy. *For now.*
3. **Rising action** (2:30–4:00) — Inject SRE-0001. Patient destabilizes. Tension peaks.
4. **Climax** (4:00–6:00) — Agent arrives, works through 4 phases, applies patch.
5. **Falling action** (6:00–6:30) — Vitals recover. Tests pass. Score reveals.
6. **Resolution** (6:30–10:00) — Architecture explanation, benchmark, startup arc, close.

### Presenter persona
- **Tone**: confident-not-arrogant, technical-but-accessible, slightly theatrical at the climax
- **Pacing**: 140 wpm avg, slow to 90 wpm at the dramatic pause (Module 11, beat 4)
- **Eye contact**: laptop during clicks, panel during narration; never read the dashboard out loud — they can read
- **Hands**: gesture toward screen during reveals, not at the audience

---

## Module 03 · Design System

### Color tokens (Tailwind 4 — add to `client/src/app/globals.css`)

```css
@theme {
  /* Surfaces */
  --color-bg-primary:   #0a1226;  /* deep navy — page bg */
  --color-bg-panel:     #131b30;  /* default panel */
  --color-bg-elevated:  #1c2540;  /* raised panel (cards, modals) */
  --color-bg-subtle:    #0f1729;  /* alt rows */

  /* Borders */
  --color-border-soft:   #2a3553;
  --color-border-strong: #3d4a6e;

  /* Text */
  --color-text-primary:   #ffffff;
  --color-text-secondary: #b4bdd4;
  --color-text-muted:     #6f7a98;
  --color-text-dim:       #4a536d;

  /* Semantic / status */
  --color-healthy:   #10b981;  /* emerald — patient OK */
  --color-watch:     #f59e0b;  /* amber — degraded */
  --color-critical:  #ef4444;  /* rose — crashed */
  --color-recovery:  #34d399;  /* lighter green — recovering */
  --color-doctor:    #3b82f6;  /* doctor-blue — agent */

  /* Phase accents */
  --color-phase-detect:   #60a5fa;
  --color-phase-diagnose: #fbbf24;
  --color-phase-treat:    #fb923c;
  --color-phase-verify:   #34d399;
}
```

### Typography

| Token | Family | Weight | Use |
|---|---|---|---|
| `--font-display` | Inter Tight | 600–700 | h1, h2, big numbers |
| `--font-body` | Inter | 400–500 | paragraphs, labels |
| `--font-mono` | JetBrains Mono | 400 | logs, code, diffs, IDs |

Load via `next/font/google` in `client/src/app/layout.tsx`. Remove existing Geist.

Sizes (Tailwind defaults are fine, just use consistently): `text-xs 11px`, `text-sm 13px`, `text-base 15px`, `text-lg 18px`, `text-xl 24px`, `text-2xl 32px`, `text-3xl 48px`, `text-4xl 60px` (score reveal only).

### Motion language

| Motion | Duration | Easing | Use |
|---|---|---|---|
| Hover micro | 150ms | `ease` | buttons, links, card hover |
| Status transition | 600ms | `cubic-bezier(0.4, 0, 0.2, 1)` | healthy → watch → critical |
| Page transition | 400ms | `ease-out` | route changes |
| Sparkline update | 300ms | `ease-out` | new data point |
| Heartbeat pulse | `60/bpm`s | `ease-in-out infinite` | rate varies with status |
| Flatline (one-shot) | 2000ms | `linear` | when status hits critical |
| Discharge reveal | 800ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring) | full-screen card |
| Confetti burst | 1500ms | `canvas-confetti` default | on score ≥ 0.80 |
| Thought stream item | 400ms | `ease-out` | fade + slide-down from top |

**Heartbeat rate table** (drives pulse speed of `<HeartbeatIcon>`):
- Healthy: 60 bpm (1.0s period)
- Watch: 100 bpm (0.6s period)
- Critical: 180 bpm (0.33s period), then flatline after 3s
- Discharged/Recovering: 70 bpm

### Iconography (`lucide-react` — MIT, ~7KB tree-shaken)

| Concept | Icon name |
|---|---|
| Patient (generic) | `Heart` |
| Detecting | `Search` |
| Diagnosing | `Stethoscope` |
| Treating | `Wrench` |
| Verifying | `ClipboardCheck` |
| Doctor avatar | `Activity` (or custom SVG, see Module 05) |
| Healthy status | `CheckCircle2` |
| Watch status | `AlertTriangle` |
| Critical status | `AlertOctagon` |
| Inject button | `Syringe` |
| Discharge | `BadgeCheck` |

Language emoji map (for `<PatientCard>` avatar):
```ts
const LANG_EMOJI: Record<string, string> = {
  rust:   "🦀",
  python: "🐍",
  go:     "🐹",
  node:   "🟢",
  java:   "☕",
  ruby:   "💎",
};
```

### Sound design (off by default; presenter-mode toggle in nav)

| Event | Sample | Volume |
|---|---|---|
| Healthy heartbeat (looped) | subtle ECG beep, 80ms blip | 0.05 |
| Status → critical | low alarm wail, 1.5s | 0.15 |
| Phase change | soft chime, 200ms | 0.10 |
| Discharge | ascending 3-note ding, 800ms | 0.20 |

Use `<audio>` elements with `preload="auto"`. Files in `client/public/sounds/`. Source from a CC0 sound pack (e.g. freesound.org). If sourcing is risky, drop sounds entirely — visual + narration carries the demo.

### Copy voice
- Headings: terse, declarative ("Sentinel Ward", "Patient Chart", "Operating Theater")
- Empty states: encouraging ("No patients yet. Admit one with `srebench.yaml` under `apps/`.")
- Errors: human ("Couldn't reach the ward — check the agent server.")
- Numbers: always with units (`14s`, `0.95`, `127 req/s`, `45ms`)
- Never: emojis in body text (only in icons/status); exclamation marks; "awesome"/"super"

---

## Module 04 · Information Architecture

### Route map

| Route | Page | Module 05 components |
|---|---|---|
| `/` | Ward Overview | `WardHeader`, `PatientCard×N`, `AdmissionsTable` |
| `/apps/[name]` | Patient Chart | `PatientHeader`, `VitalsPanel`, `ConditionList`, `TreatmentHistory` |
| `/incidents/[id]` | Operating Theater | `OrHeader`, `ThoughtStream`, `PhaseLane×4`, `PatchView`, `LiveVitals`, `DischargeCard` |
| `/leaderboard` | Hospital Scoreboard | `ScoreboardGrid`, `ScoreboardStats`, `HardestUnsolved` |
| `/incidents/[id]?replay=true&speed=2x` | OR (replay mode) | same as OR but streams from JSONL |
| `/?demo=1` | Ward (demo-mode) | guarantees a pre-seeded happy path |

### Page contracts (data needs)

```ts
// Ward — page.tsx
const data = await Promise.all([
  getApps(),                       // GET /apps
  getIncidents(),                  // GET /incidents (recent runs)
]);
// Live: subscribe to /apps/vitals/stream (new SSE — see Module 06)

// Patient Chart — apps/[name]/page.tsx
const data = await Promise.all([
  getApp(name),                    // GET /apps/{name}
  getAppIncidents(name),           // GET /apps/{name}/incidents (new)
  getAppVitals(name, { since: 300 }), // GET /apps/{name}/vitals (new)
  getRunsByApp(name),              // GET /incidents?app=<name> (filter existing)
]);

// Operating Theater — incidents/[id]/page.tsx
const run = await getIncident(id); // GET /incidents/{id}
// Live: subscribe to /incidents/{id}/stream

// Scoreboard — leaderboard/page.tsx
const data = await getLeaderboard(); // GET /leaderboard (new)
```

### State machines

**Patient health** (per app):
```
       inject               run_tests pass
  HEALTHY ─────► CRITICAL ──────────────► RECOVERING ──► HEALTHY
     ▲              │                                       │
     │              │ vitals partially OK                    │
     │              ▼                                        │
     └───── WATCH ◄─┴────────────────────────────────────────┘
```

Transitions:
- HEALTHY → WATCH: `error_rate_pct ≥ 0.5%` or `p99_latency_ms ≥ 200`
- WATCH → CRITICAL: `error_rate_pct ≥ 5%` or `healthz != 200` for 3s
- CRITICAL → RECOVERING: post-fix tests pass
- RECOVERING → HEALTHY: vitals stable for 5s

Implementation: derive client-side from latest vitals sample.

**Incident phases** (per run):
```
   START → DETECTING ─► DIAGNOSING ─► FIXING ─► VERIFYING ─► DONE
              ▲             ▲            │           │
              └─────────────┴────────────┘           │
              (agent can revisit one phase back)      │
                                                      ▼
                                                   FAILED
```

Already implemented via `<phase>` tag emission. UI just observes.

---

## Module 05 · Component Catalog

Every component has: **path**, **props**, **states**, **behavior**, **notes**.

### Primitives (no domain knowledge)

#### `<StatusPill>` — `client/src/components/StatusPill.tsx`

```ts
type Status = "healthy" | "watch" | "critical" | "recovering" | "discharged";

interface Props {
  status: Status;
  size?: "sm" | "md" | "lg";       // default "md"
  pulse?: boolean;                  // default true on "critical"
  label?: string;                   // override default label
}
```

- Visual: rounded full pill (`px-2.5 py-0.5`), icon (lucide) + text
- Colors: `bg-{status}/10 text-{status} border-{status}/30`
- `pulse=true` adds `animate-pulse` (Tailwind built-in)
- Sizes: `sm` = `text-xs`, `md` = `text-sm`, `lg` = `text-base`
- DoD: storybook-style test page renders all 5 statuses × 3 sizes

#### `<Sparkline>` — `client/src/components/Sparkline.tsx`

```ts
interface Props {
  data: number[];                   // most recent value last
  width?: number;                   // default 80
  height?: number;                  // default 24
  color?: string;                   // CSS color or var
  fill?: boolean;                   // gradient fill below line
  thresholds?: { warn?: number; crit?: number };
  ariaLabel?: string;
}
```

- Pure SVG, no chart library
- Normalize data to viewport: `y = height - (val - min) / (max - min) * height`
- If `thresholds.crit` exceeded by any point, line turns critical color in that segment
- Animate new data point in: stroke-dasharray trick or just `transition: d 300ms`
- `data` empty → render 1px dashed gray line
- ~50 LOC

#### `<HeartbeatIcon>` — `client/src/components/HeartbeatIcon.tsx`

```ts
interface Props {
  bpm: number;                     // 0 = flatline
  size?: number;                   // default 14
  color?: string;
  flatline?: boolean;              // one-shot flatline animation
}
```

- SVG heart shape with `@keyframes heartbeat` pulse
- `animation-duration: ${60/bpm}s`
- When `flatline=true`: play `@keyframes ecg-flatline` (an ECG line that flatlines left-to-right, 2s)
- When `bpm === 0`: static, no animation

#### `<Tag>` — `client/src/components/Tag.tsx`

```ts
interface Props {
  children: ReactNode;
  tone?: "neutral" | "info" | "warn" | "critical";
  size?: "sm" | "md";
}
```

- Small inline label (for difficulty: easy/medium/hard, category: code/config/etc.)
- Used in `<ConditionList>`, `<TreatmentHistory>`

### Domain components

#### `<PatientCard>` — `client/src/components/PatientCard.tsx` (replaces `AppCard.tsx`)

```ts
interface Props {
  app: AppSummary;                 // from /apps
  vitals: VitalSigns;              // from /apps/{name}/vitals
  status: Status;                  // derived from vitals
  activeIncidentId?: string;       // if there's a live run, show "View OR" link
  knownIncidents: IncidentMeta[];  // from /apps/{name}/incidents — for dropdown
  onInject: (incidentId: string) => Promise<void>;
}
```

Wireframe:
```
┌─────────────────────────────────────┐
│ 🦀  shop-api               🟢 Healthy│  <- avatar, name, StatusPill
│     Rust                            │
├─────────────────────────────────────┤
│ ♥ 127 bpm   ▅▆▇▆▅▄▃▄▅▆▇  (req/s)   │  <- HeartbeatIcon + Sparkline
│ 🩺 45 ms    ▂▂▃▃▂▂▃▃▂▂   (p99)     │
│ 🌡 0.0%     ▁▁▁▁▁▁▁▁▁▁    (err %)  │
├─────────────────────────────────────┤
│ Inject: [SRE-0001 ▾]    [💉 Inject] │  <- dropdown + button
│ source: apps/rust/src/              │  <- text-xs muted
└─────────────────────────────────────┘
```

- Whole card link to `/apps/{name}` *except* the inject controls (use `e.stopPropagation()`)
- Hover: subtle border glow, slight elevation
- States: status drives top-right pill + heartbeat rate + sparkline colors
- DoD: renders correctly for all 5 status states; inject dropdown shows all known incidents

#### `<VitalsPanel>` — `client/src/components/VitalsPanel.tsx`

```ts
interface Props {
  appName: string;
  vitals: VitalSigns;              // initial snapshot
  liveMode?: boolean;              // default true — subscribes to vitals SSE
  variant?: "compact" | "full";    // compact for OR right rail, full for /apps/[name]
}
```

- Compact: 4 stacked rows, each = label + current value + sparkline
- Full: 2×2 grid, each = big label + giant current value + larger sparkline with axis ticks
- Subscribes to `useAppVitals(appName)` hook (see Module 06)
- DoD: with `liveMode=true`, values update every 1s; with `liveMode=false`, static snapshot

#### `<PhaseLane>` — `client/src/components/PhaseLane.tsx`

```ts
type Phase = "detecting" | "diagnosing" | "fixing" | "verifying";

interface Props {
  phase: Phase;
  events: ChannelEvent[];          // filtered to this phase
  isActive: boolean;               // pulse glow when active
  onEventClick: (event: ChannelEvent) => void;
}
```

- Header row: icon (lucide) + phase name + count badge
- Active lane: animated glow border (`box-shadow: 0 0 24px var(--color-phase-X)`)
- Events list: vertical, newest at bottom (chronological)
- Each event renders as `<EventCard>` (below)
- Empty: muted "waiting…" with subtle pulse dot
- DoD: handles 0/1/10 events without scroll issues; active lane visibly glows

#### `<EventCard>` — `client/src/components/EventCard.tsx`

```ts
interface Props {
  event: ChannelEvent;
  onClick: () => void;
}
```

- Tool call: shows `🔧 {tool_name}` + truncated input preview (e.g. `read_logs(since=60)`)
- Tool result: shows `← {tool_name}` + result summary (e.g. `12 log lines, 3 errors`)
- Thought: shows first ~80 chars italicized
- Error result: red border + first ~80 chars of error
- Click → opens existing `EvidencePanel` with full JSON
- DoD: every event type renders distinctly; click opens panel

#### `<ThoughtStream>` — `client/src/components/ThoughtStream.tsx`

```ts
interface Props {
  events: ChannelEvent[];          // filtered to type="thought"
  maxItems?: number;               // default 8 — older drop off
}
```

- Vertical list, newest at top
- New item: slides in from top with 400ms `ease-out`, fades in
- Each item: short timestamp (relative: "2s ago") + thought text (mono, dimmed quote style)
- DoD: smoothly streams in new thoughts without layout jump

#### `<PatchView>` — `client/src/components/PatchView.tsx`

```ts
interface Props {
  event: ChannelEvent;             // tool_call where name === "propose_patch"
  expanded?: boolean;              // default false
}
```

- Collapsed: 1 line summary — `📄 src/routes/auth.rs (+3, -2)`
- Expanded: unified-diff renderer
  - Lines starting `+`: green background
  - Lines starting `-`: red background
  - Lines starting `@@`: muted blue background
- Renderer: simple line-by-line iteration, no library — ~40 LOC
- DoD: renders the SRE-0001 patch correctly with proper colors

#### `<LiveVitals>` — `client/src/components/LiveVitals.tsx`

Thin wrapper around `<VitalsPanel variant="compact" liveMode={true} />` for the OR right rail. Adds a "PATIENT VITALS" header.

#### `<DischargeCard>` — `client/src/components/DischargeCard.tsx`

```ts
interface Props {
  run: IncidentRun;                // must be status="done"
  baseline?: string;               // e.g. "~30 min"
  speedup?: number;                // e.g. 128 (×)
  onDismiss: () => void;
}
```

- Full-screen overlay (`fixed inset-0 z-50 bg-bg-primary/95`)
- Centered card animates in with spring (`cubic-bezier(0.34, 1.56, 0.64, 1)`, 800ms)
- Big check mark + "PATIENT DISCHARGED"
- Score: 4xl bold green digits, counts up from 0.00 to final (use `requestAnimationFrame`, ~800ms)
- Time: large mono digits
- Phase check rail: 4 phase names with checks
- "Human baseline ~30 min · Speedup 128×" subtitle
- On score ≥ 0.80: trigger `canvas-confetti` burst on mount
- Click anywhere or Escape → `onDismiss`, fades out 400ms
- After dismiss: collapses to a header bar at top of OR page
- DoD: passes manual cinematic test (looks great on big screen)

#### `<OrHeader>` — `client/src/components/OrHeader.tsx`

Top bar of `/incidents/[id]`: case ID, app name, elapsed timer (mm:ss live), current phase pill, doctor avatar.

#### `<WardHeader>` — `client/src/components/WardHeader.tsx`

Top bar of `/`: "Sentinel Ward" title, doctor-on-duty pill, count badge ("4 patients · 0 active incidents"), presenter-mode toggle.

#### `<AdmissionsTable>` — `client/src/components/AdmissionsTable.tsx`

Restyle of current incidents table on `/`. Same data shape — just visual upgrade. Columns: Case ID (link) · App · Incident · Score · Time · Status.

#### `<PatientHeader>` — `client/src/components/PatientHeader.tsx`

Top of `/apps/[name]`: emoji avatar, name, language tag, "Patient since 2d ago", last-incident summary.

#### `<ConditionList>` — `client/src/components/ConditionList.tsx`

```ts
interface Props {
  incidents: IncidentMeta[];       // from /apps/{name}/incidents
  onAdmit: (incidentId: string) => Promise<void>;
}
```

Rows: `SRE-XXXX · {difficulty} · {category} · {title}`. "Admit" button on each row (=inject + start run).

#### `<TreatmentHistory>` — `client/src/components/TreatmentHistory.tsx`

Rows: `Run {id} · {incident} · resolved in {mttr}s · score {score}` — click → `/incidents/{id}`.

#### `<ScoreboardGrid>` — `client/src/components/ScoreboardGrid.tsx`

```ts
interface Props {
  rows: { app: string; cells: { incidentId: string; score: number | null }[] }[];
  onCellClick: (app: string, incidentId: string) => void;
}
```

- Sticky-header grid; cells colored by score band (`< 0.3`: critical, `0.3–0.7`: watch, `> 0.7`: healthy, `null`: dim "—")
- Click cell → opens run replay if score exists, else does nothing
- DoD: handles 4 apps × 20 incidents grid without layout breaking

#### `<ScoreboardStats>` — `client/src/components/ScoreboardStats.tsx`

Aggregated stats panel (solved-by-difficulty, avg MTTR, avg score per difficulty).

#### `<HardestUnsolved>` — `client/src/components/HardestUnsolved.tsx`

Single highlighted card calling out the incident with highest difficulty + lowest max-score across runs.

#### `<PresenterModeToggle>` — `client/src/components/PresenterModeToggle.tsx`

Top-nav toggle that:
- Enables sound effects
- Slows status transitions to 1000ms (more dramatic on screen)
- Mouse-cursor highlight ring (CSS `cursor: crosshair` or a follow-the-mouse circle)
- Stored in `localStorage.presenterMode`

### Components to delete

| File | Why |
|---|---|
| `client/src/components/AppCard.tsx` | replaced by `<PatientCard>` |
| `client/src/components/PhaseTimeline.tsx` | logic moved into `<PhaseLane>×4` + `<ThoughtStream>` |
| `client/src/components/IncidentScore.tsx` | replaced by `<OrHeader>` + `<DischargeCard>` |
| `client/src/components/EvidencePanel.tsx` | **KEEP** — used by `<EventCard>` click |

---

## Module 06 · API Contract

### Existing endpoints (don't modify behavior — only reference)

| Method | Path | Returns | Source |
|---|---|---|---|
| GET | `/health` | `{ status, has_sentinel }` | `server/main.py` |
| GET | `/apps` | `AppSummary[]` | `server/main.py` |
| GET | `/apps/{name}` | full manifest | `server/main.py` |
| GET | `/apps/{name}/health` | `HealthStatus` | `server/main.py` |
| GET | `/apps/{name}/logs?since=N&grep=` | `{ logs: LogLine[] }` | `server/main.py` |
| GET | `/apps/{name}/metrics` | `{ series: MetricSeries[] }` | `server/main.py` |
| POST | `/incidents/start` | `IncidentRun` | `server/main.py` |
| GET | `/incidents` | `IncidentRun[]` | `server/main.py` |
| GET | `/incidents/{id}` | `IncidentRun` | `server/main.py` |
| GET | `/incidents/{id}/stream` | SSE `ChannelEvent[]` | `server/main.py` |

### New endpoints (build in `server/main.py`)

#### `GET /apps/{name}/incidents`

List incident specs available for an app.

**Response**:
```json
[
  {
    "id": "SRE-0001",
    "title": "Login crashes on missing password (unwrap() panic)",
    "difficulty": "easy",
    "category": "code"
  }
]
```

**Implementation** (~15 LOC):
```python
@app.get("/apps/{name}/incidents")
def list_app_incidents(name: str):
    if name not in app.state.apps:
        raise HTTPException(404, f"App '{name}' not found")
    incidents_dir = APPS_DIR / name / "incidents"
    if not incidents_dir.exists():
        return []
    out = []
    for p in sorted(incidents_dir.glob("*.yaml")):
        try:
            inc = load_incident(p)
            out.append({
                "id": inc.id, "title": inc.title,
                "difficulty": inc.difficulty, "category": inc.category,
            })
        except Exception:
            continue
    return out
```

#### `GET /apps/{name}/vitals?since=60&simulate=false`

Latest N seconds of vital signs.

**Response**:
```json
{
  "ts_end": 1731234567.0,
  "samples_per_second": 1,
  "vitals": {
    "req_per_sec":       [12, 14, 13, 15],
    "p99_latency_ms":    [45, 47, 43],
    "error_rate_pct":    [0.0, 0.0],
    "cpu_pct":           [35, 36, 38]
  }
}
```

**Implementation** (~40 LOC, lives in `server/sentinel/vitals.py` — new):
- Try to pull from `MetricSource.scrape()` (existing)
- If empty or `simulate=true`, generate plausible values via `simulate_vitals()`
- Cache last 300s per app in process memory

#### `GET /apps/{name}/vitals/stream`

SSE stream of vital sign samples (1 per second).

**Implementation**: similar pattern to `/incidents/{id}/stream`. Each event = single tick `{ ts, req_per_sec, p99, err_pct, cpu_pct }`.

#### `GET /incidents/{id}/stream?replay=true&speed=Nx`

Re-stream existing JSONL at controllable speed.

**Implementation** (~30 LOC):
```python
async def replay_gen(run_id: str, speed: float):
    evidence_path = EVIDENCE_DIR / f"{run_id}.jsonl"
    if not evidence_path.exists():
        return
    events = [json.loads(l) for l in evidence_path.read_text().splitlines() if l]
    if not events:
        return
    t0 = events[0]["ts"]
    wall_start = time.time()
    for ev in events:
        target = (ev["ts"] - t0) / speed
        elapsed = time.time() - wall_start
        if target > elapsed:
            await asyncio.sleep(target - elapsed)
        yield {"data": json.dumps(ev)}
```

Add `?replay=true&speed=Nx` query params to existing `stream_incident` endpoint.

#### `POST /apps/{name}/inject`

Apply an incident's `inject` patch without running the agent (manual destabilization).

**Request**: `{ "incident_id": "SRE-0001" }`

**Response**: `{ "applied": true, "incident_id": "SRE-0001" }`

**Implementation** (~20 LOC): load incident, call `srebench.injector.apply(inject_steps, app_manifest)`.

#### `POST /apps/{name}/heal`

Reverse the inject — apply the gold-truth fix without involving the agent. Used for demo cleanup ("reset patient").

**Request**: `{ "incident_id": "SRE-0001" }`

**Response**: `{ "healed": true }`

**Implementation** (~20 LOC): run `git checkout` on touched files, restart the app.

#### `GET /leaderboard`

Aggregate of all runs across all apps/incidents.

**Response**:
```json
{
  "rows": [
    {
      "app": "shop-api",
      "cells": [
        { "incident_id": "SRE-0001", "best_score": 0.95, "runs": 3 },
        { "incident_id": "SRE-0006", "best_score": 0.80, "runs": 1 }
      ]
    }
  ],
  "incident_ids": ["SRE-0001", "SRE-0003", "SRE-0006", "SRE-0013", "SRE-0020"],
  "stats": {
    "solved_easy": 3, "total_easy": 3,
    "solved_medium": 0, "total_medium": 1,
    "solved_hard": 0, "total_hard": 1,
    "avg_mttr_s": 22.5
  }
}
```

**Implementation** (~50 LOC): scan `RESULTS_DIR/*.json`, group by `(app, incident_id)`, compute best score and counts.

#### `POST /demo/seed`

Seeds one fake completed run into `EVIDENCE_DIR` + `RESULTS_DIR` if both are empty, so first-time-open of `/` and `/leaderboard` aren't blank.

**Implementation** (~30 LOC): write a canned JSONL trace + result.

### Client API library — `client/src/lib/api.ts`

Add these functions:

```ts
export interface IncidentMeta {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  category: "code" | "config" | "resource" | "network" | "integration";
}

export interface VitalSigns {
  ts_end: number;
  samples_per_second: number;
  vitals: {
    req_per_sec: number[];
    p99_latency_ms: number[];
    error_rate_pct: number[];
    cpu_pct: number[];
  };
}

export interface LeaderboardData {
  rows: { app: string; cells: { incident_id: string; best_score: number | null; runs: number }[] }[];
  incident_ids: string[];
  stats: {
    solved_easy: number; total_easy: number;
    solved_medium: number; total_medium: number;
    solved_hard: number; total_hard: number;
    avg_mttr_s: number;
  };
}

export const getAppIncidents = (name: string) =>
  fetchJSON<IncidentMeta[]>(`/apps/${name}/incidents`);

export const getAppVitals = (name: string, opts: { since?: number; simulate?: boolean } = {}) => {
  const qs = new URLSearchParams({
    since: String(opts.since ?? 60),
    simulate: String(opts.simulate ?? false),
  });
  return fetchJSON<VitalSigns>(`/apps/${name}/vitals?${qs}`);
};

export const injectIncident = (name: string, incidentId: string) =>
  fetch(`${API}/apps/${name}/inject`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ incident_id: incidentId }),
  }).then(r => r.json());

export const healPatient = (name: string, incidentId: string) =>
  fetch(`${API}/apps/${name}/heal`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ incident_id: incidentId }),
  }).then(r => r.json());

export const getLeaderboard = () =>
  fetchJSON<LeaderboardData>(`/leaderboard`);
```

### Client SSE hooks — `client/src/lib/sse.ts`

Add:

```ts
export function useAppVitals(name: string | null): VitalSigns | null {
  // EventSource subscribes to /apps/{name}/vitals/stream
  // Accumulates samples into rolling 60-sample buffer
  // Returns latest snapshot
}
```

---

## Module 07 · Vitals Simulator

### Why simulated vitals
Production apps emit metrics. Demo apps idle. To make the Ward feel alive even when nothing's happening, the server fabricates plausible vitals when no real data flows. Behind `?simulate=true` so we never lie about real numbers (when real metrics exist, use them).

### Algorithm — `server/sentinel/vitals.py`

```python
import math
import random
import time

class VitalSimulator:
    """Generates plausible vitals using sinusoidal baselines + Gaussian noise."""

    def __init__(self, app_name: str, seed: int | None = None):
        self.app_name = app_name
        self.rng = random.Random(seed or hash(app_name))
        # Stable baselines per app (so shop-api looks consistent run-to-run)
        self.baseline_rps    = self.rng.uniform(50, 200)
        self.baseline_p99    = self.rng.uniform(30, 80)
        self.baseline_err    = 0.0
        self.baseline_cpu    = self.rng.uniform(20, 50)
        self.injected = False  # toggled when /inject called

    def sample(self, ts: float) -> dict:
        # Sinusoidal load over 60s period + 5% noise
        period_s = 60.0
        phase = (ts % period_s) / period_s * 2 * math.pi
        rps_mod   = 1.0 + 0.2 * math.sin(phase)
        p99_mod   = 1.0 + 0.15 * math.sin(phase + 0.5)
        cpu_mod   = 1.0 + 0.1  * math.sin(phase + 1.0)

        noise = lambda: self.rng.gauss(0, 0.05)

        rps = max(0, self.baseline_rps * rps_mod * (1 + noise()))
        p99 = max(0, self.baseline_p99 * p99_mod * (1 + noise()))
        cpu = max(0, min(100, self.baseline_cpu * cpu_mod * (1 + noise())))
        err = max(0, self.baseline_err + noise() * 0.1)

        if self.injected:
            err = min(20.0, err + 5.0 + abs(noise()) * 10)  # 5-20% error
            p99 *= 3                                          # latency spike
            rps *= 0.3                                        # traffic drops

        return {
            "ts": ts,
            "req_per_sec":    round(rps, 2),
            "p99_latency_ms": round(p99, 1),
            "error_rate_pct": round(err, 3),
            "cpu_pct":        round(cpu, 1),
        }
```

State: one `VitalSimulator` per app, held in `app.state.vital_sims: dict[str, VitalSimulator]`. `inject` endpoint sets `.injected=True`; `heal` endpoint sets it `False`.

### Tests — `server/tests/test_vitals.py`

- `test_baseline_stable`: same seed → same baselines
- `test_inject_raises_errors`: after `.injected=True`, error_rate_pct samples ≥ 5%
- `test_heal_restores`: setting `.injected=False` brings err back near 0 within 10 samples
- `test_within_bounds`: 1000 samples — all values non-negative, cpu ≤ 100

---

## Module 08 · Demo Replay

### Use case
- Backup if live agent fails during demo
- `/leaderboard` cell drill-down → replays the historical run
- General "rewind" UX

### Mechanism
Existing `evidence/{run_id}.jsonl` already captures every event with `ts`. Replay endpoint streams these back via SSE with controllable speed:

`GET /incidents/{run_id}/stream?replay=true&speed=2x`

- `speed=1x`: original timing
- `speed=2x`: half wall-clock
- `speed=0.5x`: double wall-clock (slower, more dramatic)

Server holds the original wall-clock delta between events and `await asyncio.sleep((delta) / speed)` before yielding next event. Client doesn't need to know it's a replay.

### Frontend integration
OR page (`/incidents/[id]`) reads `?replay=true` and `?speed=N` from URL search params, passes them through to the SSE URL.

### Pre-recorded backup
A "canonical" SRE-0001 run is captured and committed at `server/tests/fixtures/demo-runs/SRE-0001-canonical.jsonl`. The `POST /demo/seed` endpoint copies this into `EVIDENCE_DIR` + creates the matching `RESULTS_DIR/<id>.json` so it's immediately replayable. Capture procedure (one-time setup):

```bash
make dev
cd apps/rust && cargo run &
make run-incident APP=shop-api ID=SRE-0001
# Wait for completion, then:
RUN_ID=<run_id from response>
cp evidence/$RUN_ID.jsonl server/tests/fixtures/demo-runs/SRE-0001-canonical.jsonl
cp results/$RUN_ID.json   server/tests/fixtures/demo-runs/SRE-0001-canonical.json
```

---

## Module 09 · Implementation Order (15-Day Sprint)

Each day has: **goal**, **tickets (with files + DoD)**, **dependencies**. Designed for one focused dev; with two devs, split the per-day work.

### Day 1 · Design tokens + cleanup

**Goal**: ship a new color/type/motion system. Existing pages still work but with new look.

**Tickets**:
- **T1.1** — Update `client/src/app/globals.css` with `@theme` block from Module 03
- **T1.2** — Update `client/src/app/layout.tsx`: load Inter + Inter Tight + JetBrains Mono via `next/font/google`; set body bg/text classes
- **T1.3** — Install `lucide-react`: `cd client && bun add lucide-react`
- **T1.4** — Install `canvas-confetti`: `cd client && bun add canvas-confetti && bun add -D @types/canvas-confetti`
- **T1.5** — Update `client/src/app/page.tsx` to use new bg/text tokens (still using old `<AppCard>` for now — replace tomorrow)
- **T1.6** — Smoke: `bun run build` clean; `localhost:3000` loads with new colors

**DoD**: new palette visibly applied; build passes; no TS errors.

### Day 2 · Primitives

**Goal**: ship `<StatusPill>`, `<Sparkline>`, `<HeartbeatIcon>`, `<Tag>`.

**Tickets** (one per component, see Module 05 for specs):
- **T2.1** — `<StatusPill>` + visual test page at `client/src/app/_dev/pills/page.tsx`
- **T2.2** — `<Sparkline>` + visual test at `client/src/app/_dev/sparklines/page.tsx`
- **T2.3** — `<HeartbeatIcon>` (CSS keyframes in `globals.css`) + visual test
- **T2.4** — `<Tag>` + add to test page

**DoD**: visual test pages render every variant; no console errors; primitives have JSDoc on props.

### Day 3 · Backend: incidents endpoint + vitals simulator

**Goal**: serve incident metadata + simulated vitals so the Ward can light up.

**Tickets**:
- **T3.1** — Add `GET /apps/{name}/incidents` in `server/main.py` (Module 06 spec)
- **T3.2** — Create `server/sentinel/vitals.py` with `VitalSimulator` (Module 07 algorithm)
- **T3.3** — Wire `VitalSimulator` into FastAPI lifespan: `app.state.vital_sims = {name: VitalSimulator(name) for name in apps}`
- **T3.4** — Add `GET /apps/{name}/vitals` (snapshot, Module 06 spec)
- **T3.5** — Tests: `server/tests/test_vitals.py` (Module 07 list)
- **T3.6** — Tests: `server/tests/test_main.py` — add cases for new endpoints

**DoD**: `curl localhost:8000/apps/shop-api/incidents` returns 5 incidents; `curl localhost:8000/apps/shop-api/vitals` returns 60 samples; all server tests pass.

### Day 4 · `<PatientCard>` + Ward rebuild

**Goal**: `/` becomes the Ward Overview.

**Tickets**:
- **T4.1** — Build `<PatientCard>` (Module 05 wireframe). Polls vitals every 1s via `getAppVitals`.
- **T4.2** — Update `client/src/lib/api.ts` with `getAppIncidents`, `getAppVitals`, `injectIncident` (Module 06)
- **T4.3** — Build `<WardHeader>`
- **T4.4** — Build `<AdmissionsTable>` (restyle from current table on `/`)
- **T4.5** — Rewrite `client/src/app/page.tsx` to use new components
- **T4.6** — Delete `client/src/components/AppCard.tsx`

**DoD**: `/` shows shop-api card with ticking vitals + heartbeat. Inject dropdown shows the 5 incident IDs.

### Day 5 · Vitals SSE stream + status derivation

**Goal**: vitals update via push (SSE) instead of poll, status derives correctly.

**Tickets**:
- **T5.1** — Add `GET /apps/{name}/vitals/stream` SSE endpoint in `server/main.py`
- **T5.2** — Add `useAppVitals(name)` hook in `client/src/lib/sse.ts`
- **T5.3** — Add `deriveStatus(vitals)` helper in `client/src/lib/api.ts`: implements Module 04 state machine
- **T5.4** — Update `<PatientCard>` to use SSE hook + derived status (drives heartbeat bpm)
- **T5.5** — Add `POST /apps/{name}/inject` and `POST /apps/{name}/heal` (Module 06)
- **T5.6** — Wire inject button in `<PatientCard>` → calls `injectIncident` → simulator flips state → SSE pushes critical vitals

**DoD**: clicking "Inject" on a card visibly destabilizes that patient (status → critical, heartbeat → 180bpm, sparkline reddens) within 2s. Clicking "Heal" (add temp button on `/` for testing) restores.

### Day 6 · OR layout + thought stream + phase lanes

**Goal**: `/incidents/[id]` is the Operating Theater.

**Tickets**:
- **T6.1** — Build `<OrHeader>` (Module 05)
- **T6.2** — Build `<ThoughtStream>` (filtered `events.filter(e => e.type === "thought")`)
- **T6.3** — Build `<PhaseLane>` (replaces parts of `<PhaseTimeline>` — see Module 05)
- **T6.4** — Build `<EventCard>`
- **T6.5** — Rewrite `client/src/app/incidents/[id]/page.tsx` to use new 3-column OR layout (Module 03 wireframe)
- **T6.6** — Keep `EvidencePanel` (it's reused by EventCard click)
- **T6.7** — Delete `client/src/components/PhaseTimeline.tsx`, `client/src/components/IncidentScore.tsx`

**DoD**: opening a completed run shows thoughts on left, 4 lanes in middle with events, EvidencePanel opens on event click.

### Day 7 · `<PatchView>` + `<LiveVitals>` right rail

**Goal**: OR shows patch diff inline + live vitals on the right.

**Tickets**:
- **T7.1** — Build `<PatchView>` with collapsed + expanded states (Module 05)
- **T7.2** — In `<PhaseLane>`, when an event is `tool_call` with `name === "propose_patch"`, render `<PatchView>` inline instead of `<EventCard>`
- **T7.3** — Build `<VitalsPanel variant="compact">` (the compact variant)
- **T7.4** — Build `<LiveVitals>` wrapper, integrate into OR right rail
- **T7.5** — During an active run, `<LiveVitals>` shows the patient app's vitals (not the agent's)

**DoD**: opening a completed SRE-0001 run shows the actual diff highlighted; right rail shows vitals over time of the run.

### Day 8 · `<DischargeCard>` + score animation

**Goal**: cinematic finale when a run completes.

**Tickets**:
- **T8.1** — Build `<DischargeCard>` with spring animation (Module 05)
- **T8.2** — Score counter: animates 0.00 → final over 800ms
- **T8.3** — Trigger `canvas-confetti` on mount if `score ≥ 0.80`
- **T8.4** — Wire into OR page: when SSE delivers `phase === "done"`, show DischargeCard
- **T8.5** — Add `<HumanBaselineComparison>` (static map: easy→"~5 min", medium→"~30 min", hard→"~2 hr")
- **T8.6** — Dismiss handler: card fades out, collapses to header bar showing the final score

**DoD**: completed run opens to full-screen discharge card with confetti; dismissable; collapses cleanly.

### Day 9 · Patient Chart page

**Goal**: `/apps/[name]` is a full patient chart.

**Tickets**:
- **T9.1** — Build `<PatientHeader>`
- **T9.2** — Build `<VitalsPanel variant="full">` (4 big charts in 2x2)
- **T9.3** — Build `<ConditionList>` (incident list with Admit buttons)
- **T9.4** — Build `<TreatmentHistory>` (past runs for this app)
- **T9.5** — Rewrite `client/src/app/apps/[name]/page.tsx`
- **T9.6** — Add `GET /incidents?app=<name>` filter to existing endpoint, or filter client-side from `getIncidents()`

**DoD**: `/apps/shop-api` shows live vitals, 5 conditions with admit buttons, recent treatment history.

### Day 10 · Backend: leaderboard + seed

**Goal**: `/leaderboard` has data to show + the Ward isn't empty on first load.

**Tickets**:
- **T10.1** — Add `GET /leaderboard` (Module 06 spec)
- **T10.2** — Add `POST /demo/seed` (Module 06 spec); script lives in `server/sentinel/seed.py`
- **T10.3** — Lifespan: if `RESULTS_DIR` empty at startup, auto-call seed once
- **T10.4** — Capture the canonical SRE-0001 run and commit to `server/tests/fixtures/demo-runs/`
- **T10.5** — Tests in `server/tests/test_leaderboard.py`

**DoD**: `curl /leaderboard` returns data; first-time-open of `/leaderboard` shows the seeded run; tests pass.

### Day 11 · Scoreboard page

**Goal**: `/leaderboard` is the Hospital Scoreboard.

**Tickets**:
- **T11.1** — Build `<ScoreboardGrid>` (color-banded cells)
- **T11.2** — Build `<ScoreboardStats>`
- **T11.3** — Build `<HardestUnsolved>` callout
- **T11.4** — Rewrite `client/src/app/leaderboard/page.tsx`
- **T11.5** — Cell click → `/incidents/{run_id}?replay=true&speed=1x` for best run

**DoD**: scoreboard renders all apps × incidents grid; clicking a cell opens that run's replay.

### Day 12 · Replay endpoint + presenter-mode toggle

**Goal**: replay backup works; presenter mode toggles dramatic timings.

**Tickets**:
- **T12.1** — Extend `stream_incident` endpoint with `?replay=true&speed=Nx` (Module 06)
- **T12.2** — Update `useIncidentStream` to accept replay params via URL
- **T12.3** — Build `<PresenterModeToggle>` (top nav)
- **T12.4** — Presenter-mode effects: slow transitions to 1000ms, enable sound (drop sounds if risky)
- **T12.5** — `?demo=1` URL param: forces seed + sets a flag in localStorage

**DoD**: open `/incidents/{seeded-id}?replay=true&speed=2x` and watch the full run playback at 2× speed.

### Day 13 · Sound + polish pass

**Goal**: cohesive feel across all pages.

**Tickets**:
- **T13.1** — Source 3 CC0 sound files (heartbeat, alarm, ding) → `client/public/sounds/`. **If sourcing risks copyright, skip this entire day's sound work — visuals are sufficient.**
- **T13.2** — Add sound playback hooks tied to status transitions + phase changes + discharge
- **T13.3** — Audit every page for: empty states, loading states, error states (Module 03 copy voice)
- **T13.4** — Fix every console error / warning observed during dry-run of the demo
- **T13.5** — Run Lighthouse — fix obvious issues (alt text, contrast)

**DoD**: full demo flow start-to-finish has zero console errors; sound (if shipped) doesn't crash if files missing.

### Day 14 · Dry-run rehearsal + recording

**Goal**: full demo executed live, recorded, watched back.

**Tickets**:
- **T14.1** — Set up demo laptop exactly as Module 12 prescribes
- **T14.2** — Record full demo on phone — 3 takes
- **T14.3** — Watch back; identify 5 weakest moments
- **T14.4** — Fix the 5 moments
- **T14.5** — Save best take as `assets/demo-backup.mp4` (the Plan C fallback)

**DoD**: at least one take ≤ 9:30 wall-clock with no apparent flubs.

### Day 15 · Materials + final pass

**Goal**: poster, handout, QR codes, deployed instance (optional).

**Tickets**:
- **T15.1** — Architecture poster (A2): redraw `docs/ARCHITECTURE.md` diagram in Figma/Excalidraw; export PDF
- **T15.2** — One-page handout PDF: front = "what this does + score formula + benchmark size"; back = `git clone` + `make setup` reproduce instructions
- **T15.3** — QR code → GitHub repo (use `qrencode` CLI or any free generator)
- **T15.4** — *Optional* deploy: Vercel for `client/`, Fly.io for `server/`. Set ANTHROPIC_API_KEY as secret. Only deploy if you've verified it stays cheap and stable. Otherwise skip — local demo is fine.
- **T15.5** — Dry-run with a non-team viewer (Module 16 verification protocol)

**DoD**: poster + handout printed; if deploying, the live URL works; verification protocol passes.

### Cut-list (drop in this order if behind)
1. Sound effects (Day 13.1, 13.2)
2. Public deployment (Day 15.4)
3. `<HardestUnsolved>` callout (Day 11.3)
4. Patient Chart live vitals (use static snapshot — Day 9.2 → simpler)
5. Confetti (Day 8.3 — replace with text "✓ Discharged")
6. Replay-speed control (only ship `1x`, drop the `speed=Nx` param work)
7. `<PresenterModeToggle>` (just always-on by default)
8. `<ScoreboardStats>` (keep grid, drop stats panel)

**Must ship no matter what**: Ward, OR layout, score reveal, the destabilization animation.

---

## Module 10 · Quality Gates

### Tests

**Server** (already at 33 passing; add):
- `tests/test_vitals.py` (Module 07)
- `tests/test_leaderboard.py`
- `tests/test_main.py` — new endpoints (Module 06)
- Target: ≥ 40 passing total.

**Rust** (already at 5 passing): no changes needed unless we add new routes.

**Frontend**: skip unit tests. Visual test pages under `client/src/app/_dev/` are the QA surface. Manual checklist:
- [ ] `/` loads in < 1.5s
- [ ] Vitals tick smoothly (no jitter)
- [ ] Inject button destabilizes patient in < 2s
- [ ] OR page streams events with < 200ms latency
- [ ] Discharge card animates without dropped frames
- [ ] Scoreboard sortable; cells link correctly
- [ ] No console errors during full demo flow

### Performance budgets

| Metric | Budget | How to measure |
|---|---|---|
| Initial JS bundle (`/`) | ≤ 200 KB gzip | `bun run build` output |
| First contentful paint | ≤ 1.0s | Chrome DevTools, throttled laptop |
| Time to interactive | ≤ 1.5s | Lighthouse |
| SSE event → DOM | ≤ 200ms | manual stopwatch on alarm beat |
| 60fps during animations | yes | DevTools rendering tab |

### Accessibility (don't oversweat — demo, not production)
- All buttons have visible text or `aria-label`
- Color isn't sole indicator (status pills include icons)
- Keyboard: Tab walks the page, Enter activates buttons
- Skip: full screen-reader pass, ARIA-live regions (overkill for a demo)

---

## Module 11 · Demo Script (Beat-by-Beat)

> All times are rehearsal targets. Stage directions in **bold**. Narrator lines in *italics*.

### Beat 1 · Hook (0:00–0:45) — 45s
- **Open laptop. Full-screen "outage statistics" slide.**
- *"June 2021. Fastly's CDN went down for one hour. Two hundred million dollars in commerce impact. Single config bug. Twelve engineers, forty-seven minutes to diagnose."* (5s pause)
- *"Today, I'm going to show you an AI agent that does the same job in fourteen seconds."*
- **Click → cut to dashboard `/`.**

### Beat 2 · Problem (0:45–1:45) — 60s
- **Slide deck overlay or in-dashboard banner.**
- *"Three pain points of running production systems."*
  - *"One: MTTR. Every minute of downtime, Gartner estimates fifty-six hundred dollars in damage."*
  - *"Two: oncall burnout. Engineers don't quit code — they quit the pager."*
  - *"Three: existing tools detect, they don't fix. PagerDuty, Datadog — they call the human. The human is the bottleneck."*
- *"We built the thing that picks up the pager."*

### Beat 3 · Meet the Ward (1:45–2:30) — 45s
- **`/` Ward Overview now full-screen.**
- *"This is the Sentinel Ward. These are our patient apps. Real running services."*
- **Hover over `shop-api` card. Vitals visibly tick.**
- *"Each app declared itself to our platform with a 30-line YAML file. No special instrumentation. Drop a manifest, you're admitted."*
- *"Today's patient is `shop-api` — a Rust e-commerce backend. I wrote it last week. It has five known latent bugs. I'll demo one. The agent has not seen them before."*

### Beat 4 · THE LIVE INCIDENT (2:30–6:30) — 4:00 — **the centerpiece**

#### 4a · Setup (10s)
- *"I'm injecting SRE-0001 — a junior dev pushed `unwrap()` on user input. Login crashes when a request omits the password."*

#### 4b · Inject (5s)
- **Click "💉 Inject SRE-0001" on the patient card.** (Don't dispatch agent yet.)

#### 4c · Destabilization (10s)
- **Card visibly transitions: 🟢 → 🟡 → 🔴.**
- **Heartbeat slows, then flatlines.**
- **Sparklines redden.**
- **Logs panel scrolls red.**

#### 4d · The pause (3s) — *don't talk*
- **Silence. Let the panel see a dying patient.**
- *"If this were 3 AM in production, an engineer's phone would now be ringing."*

#### 4e · Call the doctor (2s)
- **Click "📟 Dispatch Sentinel" button on the card.**
- **Page transitions to `/incidents/[id]` — Operating Theater.**

#### 4f · Detecting phase (15s)
- **Detect lane glows blue. Events fill in.**
- *"The agent's reading logs. Same logs an oncall would read."*
- **Thought stream: "Error rate is elevated. Investigating recent log entries…"**
- **EventCard: `read_logs(since=60)` → `12 lines, 3 errors`**
- **Thought: "Found panic in auth handler. Will inspect source."**

#### 4g · Diagnosing phase (15s)
- **Diagnose lane glows amber.**
- *"Now it's searching the code. Finding the file. Finding the line."*
- **EventCard: `read_file("src/routes/auth.rs", 100, 115)`**
- **EventCard: `search_code("unwrap()", "*.rs")`**
- **Thought: "Located root cause: line 107 calls `.unwrap()` on `body.password: Option<String>`."**

#### 4h · Fixing phase (15s)
- **Treat lane glows orange.**
- *"Watch this. It's writing a patch. Unified diff. Real Rust."*
- **PatchView expands inline showing `- .unwrap()` / `+ .ok_or_else(BadRequest(...))?`**
- **EventCard: `propose_patch(...)` → `applied, restart triggered`**

#### 4i · Verifying phase (10s)
- **Verify lane glows green.**
- *"Running my own tests. Hitting the health endpoint."*
- **EventCard: `run_tests("login_test")` → `passed`**
- **EventCard: `check_health()` → `healthy`**

#### 4j · Recovery + score (10s)
- **Patient flips 🔴 → 🟢. Heartbeat resumes.**
- **DischargeCard slides up with spring.**
- **Confetti.**
- *"Score: zero point nine five out of one. Resolved in fourteen seconds."*
- *"Human SRE baseline for code-panic incidents: about thirty minutes. Speedup: one hundred and twenty-eight times."*

### Beat 5 · Architecture (6:30–7:30) — 60s
- **Cut to architecture slide.**
- *"Four design choices."*
  - *"App-agnostic. The platform never hardcoded `Rust`. The patient app declared itself."*
  - *"One agent, four phases. It's one Claude Sonnet 4.6 ReAct loop. The four phases you saw are tags the LLM emits. We don't orchestrate multiple agents."*
  - *"Nine tools. Read logs, search code, propose patch, run tests. That's actually all an SRE does."*
  - *"Everything audit-logged. JSONL, append-only. You can replay any incident, write a postmortem from the file."*

### Beat 6 · Benchmark (7:30–8:30) — 60s
- **Open `/leaderboard`.**
- *"We didn't just build one demo. We built a benchmark."*
- *"Twenty incidents across config, code, resource, and integration categories. Four-person team. One semester. Inspired by RCAEval, a published benchmark with eighty cases — we'll match it next semester."*
- **Point at grid.** *"Each cell: one (agent version, incident) pair. Green: solved. Red: failed. This is how the field will evaluate SRE agents in three years."*
- *"Scoring formula: zero point two times detect, plus zero point three times diagnose, plus zero point five times fix, minus an MTTR penalty. Reproducible. Anyone with our API key gets the same numbers."*

### Beat 7 · Startup arc (8:30–9:30) — 60s
- **Cut to "Roadmap" slide.**
- *"Three milestones."*
  - *"One: this semester. Twenty incidents, one patient app, one agent. Done."*
  - *"Two: open the benchmark. Like HELM did for LLMs. OpenAI, Anthropic, Google can submit their SRE agents to a public leaderboard."*
  - *"Three: this becomes a product. Real SRE teams plug their apps in via the manifest spec. Pay for autonomous oncall."*
- *"This is also my startup. The college project is the v0."*

### Beat 8 · Close (9:30–10:00) — 30s
- *"Three things we're proudest of."*
  - *"App-agnostic. Drop a YAML, you're in."*
  - *"Objectively scored. Reproducible, not a vibes demo."*
  - *"Open. Every incident is a YAML with gold-truth tests anyone can verify."*
- *"Happy to take questions."*

---

## Module 12 · Demo Day Operations

### T-24h prep
- Pull latest from `main`
- `make setup` (verify clean install on a fresh laptop)
- `make test` — all green
- Capture canonical SRE-0001 run (Module 08)
- Print poster + handout
- Charge laptop, charge phone (backup video host), charge mouse
- If deploying: verify live URL works

### T-1h prep
- Reboot laptop (clear OS gunk)
- Close every app except: Terminal, Chrome, presentation slides
- Plug in external monitor, mouse, ethernet, charger
- Test HDMI cable

### T-15m setup
```bash
cd /Users/shaurya35/Cursor/college/autonomous-runtime-area
make reset                                    # clean evidence/, results/
make dev > /tmp/sentinel.log 2>&1 &           # backend + frontend
sleep 5
cd apps/rust && cargo run > /tmp/shop.log 2>&1 &
sleep 3
# Seed the leaderboard with one resolved run:
curl -s -X POST http://localhost:8000/demo/seed
# Verify:
curl -s http://localhost:8000/health | python3 -m json.tool
curl -s http://localhost:8000/apps | python3 -m json.tool
# Reset bug state (in case prior run patched):
cd apps/rust && git checkout src/routes/auth.rs && cargo build
```

### Tab arrangement (Chrome, left to right)
1. `http://localhost:3000/` — the Ward (active tab at demo start)
2. `http://localhost:3000/leaderboard` — for Beat 6
3. `http://localhost:3000/incidents/<canonical-run-id>?replay=true&speed=1x` — backup
4. Architecture slide (full-screen image or Keynote)
5. Closing slide

### Backup plan ladder (memorize)

| Plan | Trigger | Action |
|---|---|---|
| A | Default | Live demo, agent solves it |
| B | Agent stalls > 60s on one phase | Click "Try again" once. If still bad, switch to tab 3 (replay) and say *"the agent's having a moment — here's a recent run that worked"* |
| C | Live stack crashes (server died, port conflict) | Switch to tab 3 (replay). Continue narration. Don't apologize. |
| D | Browser dies / OS reboot | Pull out phone, play `assets/demo-backup.mp4`. Narrate over it. |
| E | Everything dies | Hold up the poster. Walk through it. Open GitHub from phone if Q&A. |

### Materials to physically bring
- [ ] Laptop + charger + HDMI adapter
- [ ] External monitor + cable (or confirm venue provides one)
- [ ] External wired mouse
- [ ] Ethernet cable (5m, just in case)
- [ ] Backup laptop (if team has spare)
- [ ] Phone fully charged with `demo-backup.mp4` saved locally
- [ ] 10 copies of one-page handout
- [ ] 1 printed A2 architecture poster
- [ ] Notebook + pen (for capturing Q&A feedback)

### Rehearsal cadence
- **Day 14**: 3 full takes, recorded on phone. Watch back. Note 5 weakest moments.
- **Day 14 evening**: fix the 5 moments.
- **Day 15 morning**: 1 take in front of a teammate. Adjust.
- **Day 15 afternoon**: 1 dress rehearsal — real monitor, real script, no mistakes.
- **Demo morning**: 1 final dry run, T-1h.

---

## Module 13 · Q&A Playbook

### Likely questions + canned answers (memorize first 6)

| # | Q | A (~30s spoken) |
|---|---|---|
| Q1 | *"How is this different from GitHub Copilot?"* | "Copilot suggests in the editor — a human reads, accepts, runs. Sentinel runs the loop end-to-end: observes prod, hypothesizes, patches, restarts, tests, verifies. No human until you want one. Copilot helps you write code; we replace the oncall." |
| Q2 | *"What if the LLM just memorized the answers?"* | "Two defenses. First, our incident YAMLs aren't on the public internet. Second, we score `verifying` highest in the formula — the agent has to produce passing tests, not just say the right thing. A hallucinated answer fails verification and gets zero points on the 0.5 weight. The score punishes guessing." |
| Q3 | *"How do you prevent it making things worse?"* | "Today: the agent can only modify files inside `source_root` declared in the manifest, and only via `propose_patch` which restarts and re-tests. If post-fix tests fail, we don't mark the incident solved. In v2, we add a policy layer that requires human approval on patches above a risk threshold." |
| Q4 | *"Why not just use Datadog Watchdog or PagerDuty AIOps?"* | "Those are anomaly detectors. They tell humans 'something's wrong.' They don't write the patch. We're attacking the second half of the loop — the part that's still human." |
| Q5 | *"How does the benchmark scale beyond your hand-written incidents?"* | "Same way SWE-bench scaled. Every incident is a self-contained YAML — inject patch, gold-truth fix, pre/post fix tests. We published the spec format in `docs/INCIDENT_SPEC.md`. Anyone can write an incident. Real production postmortems can become benchmark cases." |
| Q6 | *"Is it deterministic?"* | "The agent's reasoning isn't — LLMs aren't. The *score* is. Every YAML declares its `pre_fix_tests` and `post_fix_tests`. The score is a function of which tests pass, not what the agent said. Same starting state, same tests, deterministic outcome." |

### Less likely but possible

| Q | A |
|---|---|
| *"What model are you using?"* | "Claude Sonnet 4.6. We chose it for the 200K context window — incident YAMLs plus tool outputs add up. Anthropic API." |
| *"How much does a run cost?"* | "Empirically, around $0.05–$0.15 per incident depending on how many tool calls the agent makes. Cost is in `results/<run_id>.json`. We could swap in Haiku for cost-sensitive runs at the price of some accuracy." |
| *"What about security — could the agent leak data?"* | "All tool outputs stay in `evidence/<run_id>.jsonl` on disk. The agent has read access to source code in `source_root` and that's it. No outbound network except to the LLM API. In a real deployment, you'd run this air-gapped or with a local LLM." |
| *"How does it handle bugs spanning multiple services?"* | "Today, one incident = one patient. Multi-service is in v2 — we'd extend the manifest to declare relationships, and let the agent traverse them via a `cross_service_query` tool." |
| *"What if the bug isn't in the code — e.g. infrastructure?"* | "We have a `config` category — env vars, ports, secrets. The agent can read `.env` and propose changes. For deeper infra (k8s manifests, terraform), we'd extend the runtime adapter. Not yet implemented." |
| *"Could this replace the entire SRE team?"* | "No. It handles the *known unknowns* — incidents that look like prior incidents. The *unknown unknowns* — novel architectural issues, capacity planning, organizational coordination — those stay human. Think of it as removing the boring 80% so humans can focus on the interesting 20%." |
| *"What's the failure mode? When does it fail?"* | "Three modes. One: bugs requiring multi-file reasoning beyond its context budget. Two: bugs whose symptoms don't appear in logs/metrics — e.g. silent data corruption. Three: bugs needing physical access — bad hardware. SRE-0020 (async starvation) is on the edge — we score around 0.4 on it." |

---

## Module 14 · Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Agent fails to solve SRE-0001 during live demo | Medium | High | Plan B/C/D ladder (Module 12); pre-cached replay |
| R2 | Network down at venue | Medium | Medium | Local demo doesn't need internet (Anthropic API does — bring phone hotspot as fallback) |
| R3 | Anthropic API rate limit / outage | Low | High | Replay backup (Plan C) requires no API |
| R4 | Rust app fails to restart after patch | Medium | Medium | Wrap restart with retry; if fails, agent already scored on detect+diagnose+fix |
| R5 | Browser hangs on long SSE | Low | Medium | Test SSE for 5+ min in rehearsal |
| R6 | Demo runs over 10 min | Medium | Low | Strict 9:30 target; cut Beat 6 (benchmark) if behind |
| R7 | Teacher asks a question you can't answer | Medium | Low | "Great question — let me follow up after." is acceptable |
| R8 | Dashboard breaks on demo screen resolution | Low | High | Test on actual venue monitor day before; min-width breakpoints generous |
| R9 | Sound files copyright-claim risk | Low | Low | Use CC0 only, or drop sound (see cut-list) |
| R10 | One of the 4 teammates can't make demo day | Low | Medium | Single presenter; team backs up via notes |
| R11 | Anthropic model deprecated between now and demo | Very low | High | Pin model in `agent.py`; update if needed |
| R12 | SQLite shop.db file got corrupted between rehearsal and demo | Low | Medium | `make reset` clears it; migrations re-run on startup |
| R13 | Patches injected during prior rehearsals leaked into demo | Medium | High | T-15m setup includes `git checkout` of patched files |
| R14 | Confetti library crashes on Safari/older browser | Very low | Low | Try/catch around confetti call |

---

## Module 15 · Stretch Goals

Only ship these *after* core (Day 1–14) is shippable. Each is sized.

| # | Stretch | Effort | Value | Notes |
|---|---|---|---|---|
| S1 | Multi-patient incident | 1 day | High | Inject 2 bugs into different apps; agent handles both in parallel. Requires `Promise.all` in agent loop and parallel tool dispatch. |
| S2 | Adversarial mode | 1 day | Very high | Teacher writes a bug live in a Monaco editor on the dashboard; agent fixes it. Ultimate "they didn't memorize" demo. |
| S3 | Voice narration (TTS) | 0.5 day | Medium | Web Speech API reads agent's thoughts as they stream. Free. Can be jarring if too loud. |
| S4 | Public deployment | 2 hours | Medium | Vercel + Fly.io. Only worth it if you've stress-tested for stability. |
| S5 | Comparison run | 1 day | High | Side-by-side same incident with Sonnet vs. Haiku vs. rule-based baseline. Quantifies "the model matters." |
| S6 | Replay scrubber | 1 day | Low | Time-slider on `/incidents/[id]` for scrubbing. Postmortem tool, not demo tool. |
| S7 | Sentry/Datadog adapter | 1.5 days | Medium | New log source adapter. Shows "we can plug into your stack." |
| S8 | Slack notification | 0.5 day | Low | "Patient discharged" message to a webhook. Cute, not essential. |

---

## Module 16 · Verification Protocol

### Pre-flight checklist (T-3 days, do once)

Run all of these. Every box must check.

- [ ] `make setup` works from a fresh clone (on a different machine if possible)
- [ ] `make test` — 100% pass
- [ ] `make dev` — both services boot in < 10s
- [ ] `apps/rust && cargo run` — patient app serves `/healthz` 200 in < 5s
- [ ] `curl -X POST :8000/incidents/start -d '{"app":"shop-api","incident_id":"SRE-0001"}'` returns run_id
- [ ] Watch full SRE-0001 run in OR — discharge card appears with score ≥ 0.80
- [ ] `?replay=true&speed=2x` works on a completed run
- [ ] `/leaderboard` shows at least one row
- [ ] `make reset` clears evidence + results
- [ ] After reset, `make dev` + `/demo/seed` re-populates `/leaderboard`
- [ ] No console errors in Chrome DevTools during full demo flow
- [ ] Lighthouse score (any single page) ≥ 80 for performance

### Dry-run with naive viewer (T-3 days)

Find someone who has never seen the project — sibling, friend in a different department. Run the full 10-minute demo on them. They should:

1. **Understand the metaphor in 30 seconds** without explanation
2. **Identify the 4 phases from icons alone** without reading labels
3. **Lean forward / make a face during the destabilization beat**
4. **React audibly (smile, "wow") at the discharge moment**
5. **Ask one substantive question afterward**

If they fail any 1–5, schedule another fix-pass + re-test. Don't skip this.

### Sign-off (T-1 day)

The team leads sign off on each:

- [ ] Story (Modules 02, 11) — does the narrative work?
- [ ] Visuals (Modules 03, 05) — does it look like a hospital ward, not Grafana?
- [ ] Technical (Modules 06–08) — does every endpoint return the right shapes?
- [ ] Drama (Module 11, Beat 4) — does the destabilization → resolution arc land?
- [ ] Backup plans (Module 12) — is every level of the ladder rehearsed?

If any of these is "no", you're not ready. Bump the showcase by a day if possible.

### Success criterion

Not "every component built." Not "every test green." The criterion is: **the naive-viewer dry-run audience reacts the way teachers will react.** Build toward that. Cut anything that doesn't serve it.

---

## Appendix · Files this plan creates or modifies

### Created
```
client/src/components/
  StatusPill.tsx
  Sparkline.tsx
  HeartbeatIcon.tsx
  Tag.tsx
  PatientCard.tsx
  WardHeader.tsx
  AdmissionsTable.tsx
  PatientHeader.tsx
  VitalsPanel.tsx
  ConditionList.tsx
  TreatmentHistory.tsx
  OrHeader.tsx
  ThoughtStream.tsx
  PhaseLane.tsx
  EventCard.tsx
  PatchView.tsx
  LiveVitals.tsx
  DischargeCard.tsx
  HumanBaselineComparison.tsx
  ScoreboardGrid.tsx
  ScoreboardStats.tsx
  HardestUnsolved.tsx
  PresenterModeToggle.tsx

client/src/app/_dev/
  pills/page.tsx
  sparklines/page.tsx
  heartbeats/page.tsx

client/public/sounds/        (optional)
  heartbeat.mp3
  alarm.mp3
  ding.mp3

server/sentinel/vitals.py
server/sentinel/seed.py
server/tests/test_vitals.py
server/tests/test_leaderboard.py
server/tests/fixtures/demo-runs/
  SRE-0001-canonical.jsonl
  SRE-0001-canonical.json

assets/demo-backup.mp4
assets/architecture-poster.pdf
assets/handout.pdf
assets/qr-github.png
assets/qr-live.png           (if deploying)
```

### Modified
```
client/src/app/page.tsx                    (rebuild as Ward)
client/src/app/apps/[name]/page.tsx        (rebuild as Patient Chart)
client/src/app/incidents/[id]/page.tsx     (rebuild as Operating Theater)
client/src/app/leaderboard/page.tsx        (populate scoreboard)
client/src/app/layout.tsx                  (fonts, presenter-mode provider)
client/src/app/globals.css                 (design tokens, keyframes)
client/src/lib/api.ts                      (new endpoints)
client/src/lib/sse.ts                      (new useAppVitals hook)
client/package.json                        (lucide-react, canvas-confetti)

server/main.py                             (new endpoints)
server/sentinel/manifest.py                (no changes expected)
```

### Deleted
```
client/src/components/AppCard.tsx
client/src/components/PhaseTimeline.tsx
client/src/components/IncidentScore.tsx
```
