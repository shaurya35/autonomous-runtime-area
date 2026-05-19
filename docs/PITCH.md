# How to Pitch SREBench — Strategy & Storytelling

> Companion doc to `SHOWCASE.md` (tactical demo) and `ENTERPRISE.md` (integration).
> This is the **strategic layer**: how to make teachers care, why the demo is shaped the way it is, what to cut.

---

## Module 1 · The Framing Principle

**Never lead with code.** Lead with the **problem**, then the **person who has the problem**, then the **money the problem costs**. Only then show the solution.

The natural student instinct is to walk teachers through the architecture diagram first. Resist it. Teachers see 30 projects in a row; the ones that stand out are the ones where they understand *why this exists* within 60 seconds.

The pitch order:

```
1. Pain    →  "Production breaks. It costs $5,600/minute."
2. Person  →  "An oncall engineer is asleep at 3 AM."
3. Status  →  "PagerDuty calls them. They debug for 47 minutes."
4. Gap     →  "Existing tools detect. Nobody fixes."
5. Solve   →  "We built the thing that fixes." [demo]
6. Proof   →  "Here's the score. Here's the benchmark. Here's the audit log."
7. Vision  →  "This becomes how every SRE team operates in 3 years."
```

Code never appears until step 5, and even then only as the *means* — the focus is the patient recovering.

---

## Module 2 · Who's In The Room

Not all teachers care about the same thing. Read the panel; emphasize different beats for different judges.

| Judge archetype | What they care about | Beat to emphasize |
|---|---|---|
| **The systems professor** | Real distributed-systems thinking — concurrency, observability, fault tolerance | Architecture beat. SRE-0020 (async starvation) as a flex. |
| **The AI/ML professor** | Novel use of LLMs — beyond chatbots, agentic loops, evaluation | Phase tagging, the scoring formula, why this isn't just RAG. |
| **The software engineering professor** | Code quality, testing, reproducibility, team coordination | Gold-truth tests, the YAML spec, the 20-incident benchmark. |
| **The startup-minded faculty** | Market, GTM, competitive landscape | The startup arc slide, ENTERPRISE.md onboarding, pricing. |
| **The skeptical generalist** | "Is this real or hand-waving?" | Live demo + score + audit trail. **Show, don't tell.** |

You don't have to address each one explicitly. Just structure the demo so each finds their hook within the first 5 minutes.

---

## Module 3 · The Value Pyramid

Build the pitch as a four-layer pyramid. Each layer earns the next.

```
                    ▲
                   ╱ ╲
                  ╱ V ╲     Vision: "How every SRE team operates"
                 ╱─────╲
                ╱   P   ╲    Proof: 20 incidents, scoring formula, audit trail
               ╱─────────╲
              ╱     S     ╲   Solution: AI agent that fixes prod bugs
             ╱─────────────╲
            ╱       P       ╲  Pain: $5,600/min outage, 47-min MTTR
           ╱─────────────────╲
```

- **Pain (30 sec)** — gets attention
- **Solution (4 min, the demo)** — earns belief
- **Proof (2 min, benchmark + leaderboard)** — earns credibility
- **Vision (1 min, startup arc)** — earns excitement

Skip any layer and the pitch collapses. Demos without pain feel like toys. Visions without proof feel like hype.

---

## Module 4 · Real-World Anchoring

Specific numbers from named incidents. **Never** abstract claims like "outages cost millions."

### Outage facts to memorize

| Year | Incident | Numbers | Use for |
|---|---|---|---|
| 2021 | Fastly CDN | 1 hr, $200M+ commerce impact, one config bug | Hook |
| 2021 | Facebook BGP | 6 hrs dark, engineers locked out of building | Hook (memorable) |
| 2024 | Roblox DNS | 73 hrs degraded, postmortem quote: "we needed something to diagnose this without us" | Hook (best — quote primes our pitch) |
| 2022 | Cloudflare router | 87 min outage, 19 data centers, single deploy push | Backup hook |

### Industry numbers

| Stat | Source | Use |
|---|---|---|
| $5,600/min average enterprise downtime | Gartner | Problem framing |
| 30+ minutes average MTTR for critical incidents | DORA / Google SRE | Comparison anchor for our 14s |
| 81% of oncall engineers report burnout | State of DevOps | Human-cost framing |
| 47 minutes — Fastly's 2021 detection time | Public postmortem | Specific anchor |

### Names to drop (in the right beats)

| Name | Why | When |
|---|---|---|
| **RCAEval** | Published benchmark (80 cases), our methodology peer | Benchmark beat |
| **SWE-bench** | "Like SWE-bench, but for ops" — instantly legible | Vision beat |
| **HELM / MMLU** | Eval-leaderboard reference frame | Startup arc |
| **Site Reliability Engineering (the O'Reilly book)** | Google's bible, your vocabulary source | Q&A — establishes credibility |
| **Datadog, PagerDuty, Splunk** | The competitive landscape | Differentiation: "they detect, we fix" |
| **GitHub Copilot** | Inevitable comparison — answer it pre-emptively | Architecture beat |

---

## Module 5 · The "Imagine" Technique

After the demo lands, paint the future state in two sentences. This converts "cute demo" into "obvious product."

Script:

> *"Imagine this running 24/7 across every service at a 500-engineer company. Every page that fires at 3 AM gets a PR with passing tests in your Slack by the time the oncall engineer opens their laptop. The engineer's job becomes reviewing the AI's fix — not finding it."*

Or:

> *"Imagine SRE-bench becoming the standard way every AI lab benchmarks their agents — the way HELM did for language. Every Anthropic, OpenAI, Google release cycle includes 'we scored X on SRE-bench.' We built the v0 of that."*

Use one, not both. Whichever fits the room you're reading.

---

## Module 6 · What To Cut (Anti-Patterns)

Common student-demo mistakes — explicitly avoid:

| Don't | Why |
|---|---|
| Open with the tech stack | Nobody outside engineering cares about "Rust + Python + Next.js" |
| Walk through every file | The repo is for the GitHub link, not the panel |
| Read your slides aloud | Teachers can read; narrate the meaning, not the words |
| Apologize for incomplete features | They don't know what's missing; don't tell them |
| Hand-wave the demo | "It would normally do X" = "It doesn't do X" to a skeptic |
| Use 5 buzzwords in one sentence | "AI-powered agentic observability platform" sounds like ChatGPT wrote it |
| Show test coverage as a flex | Coverage isn't a story; bugs solved is |
| Read the leaderboard cell by cell | Show it for 5 seconds, name the headline number, move on |
| End with "Questions?" awkwardly | End with **"Three things we're proudest of"** — gives them something to ask about |
| Bring 4 presenters | One narrator. Backup teammates handle laptop/timer/Q&A. Reduces chaos. |

---

## Module 7 · Showing Value, Not Code

Three substitutions to convert "code show" into "value show":

| Instead of showing... | Show this | Why |
|---|---|---|
| The architecture diagram | A patient recovering on screen | Outcomes beat structure |
| The number of tests passing | A score (`0.95 / 1.00`) on one specific incident | Score is a verdict; tests are plumbing |
| Lines of code written | The 30-line manifest a customer would write | Reframes from "we built X" to "you can use X" |
| Multi-language support | A live `shop-api` Rust patient and (if stretch goal lands) a Python patient in the same Ward | Make app-agnosticism visible, not claimed |
| The agent loop | The 4 phase lanes filling in | Process becomes drama |
| Tooling list | A patch diff appearing inline | Concrete change, not abstract capability |

The rule: **every technical claim has a visible counterpart on screen.** If you say "app-agnostic," point at the manifest. If you say "audit log," scroll through one. If you say "scored objectively," show the formula on the leaderboard page.

---

## Module 8 · Handling The Skeptic

Inevitable in any defense. Pre-load three answers:

### "How is this not just ChatGPT in a wrapper?"

> "Three things make this not a wrapper. First, the loop — Claude doesn't know what tools exist until we give them. We curated 9 tools and built the dispatcher. Second, the observability stack — log adapters, metric scrapers, health probes, runtime hooks. None of that is the LLM. Third, the eval — the scoring formula, the gold-truth tests, the benchmark. The LLM solves; the benchmark grades. Both are the contribution."

### "How do we know the LLM didn't memorize the answers?"

> "Two defenses. First, our incident YAMLs aren't on the public internet. We wrote them in this repo. Second, the score weights `verifying` highest — the agent has to produce tests that pass against an injected bug. A hallucinated guess fails verification and loses the 0.5 weight. The benchmark punishes guessing."

### "What's the actual research contribution?"

> "Three things. One, the incident spec format — a YAML schema that lets anyone contribute reproducible SRE incidents. We're proposing it as the SWE-bench-equivalent for ops. Two, the scoring formula — `0.2·detect + 0.3·diagnose + 0.5·fix − MTTR penalty` — which weights observable, gradable phases. Three, the phase-tagged single-loop architecture — we show that you don't need multi-agent orchestration to get phase-structured behavior, just LLM tag emission."

Each answer is 30 seconds, ends with a confident period. **No "um, kind of, I guess."**

---

## Module 9 · The Stakes Reframe

Teachers grade against an unspoken question: *"How much would this matter if it worked?"*

Make that answer big:

> *"If this works at scale, on-call as a profession changes. The 3 AM page goes from 45 minutes of stumbling through dashboards to a 5-minute PR review. The 81% burnout statistic drops. Companies hire fewer ops engineers per service. The economics of running software production shifts."*

You're not asking for a grade. You're asking them to imagine a different industry.

---

## Module 10 · The Closing Ask

Don't end with "Questions?" — end with a **call to action**. Even a college panel.

Three options, pick one:

**A) The community ask** (best for academic panels):
> "We're publishing the incident spec format. If you'd give us 30 minutes after this to talk about how you'd contribute one — a real production bug you've seen — we'd love that."

**B) The introduction ask** (best for industry-adjacent panels):
> "If anyone here has a connection to an SRE team that would run this in shadow mode on one service — we'd love that introduction. We're not looking for paying customers yet, just one team to learn from."

**C) The validation ask** (safest, always works):
> "Three things we'd love feedback on: the metaphor (does it land?), the scoring formula (is `verifying` weighted right?), and the startup arc (does it feel real?). We'd rather have your critique now than after the semester."

All three are better than "Questions?" — they give teachers a frame for their feedback.

---

## Module 11 · The Strategic Demo Timeline

The 10-minute demo has a *strategic* shape, not just a tactical one. Each beat serves a specific persuasion goal:

| Beat | Tactical purpose | Strategic purpose |
|---|---|---|
| Hook (0–0:45) | Establish stakes | Earn 60 seconds of attention |
| Problem (0:45–1:45) | Frame the gap | Set up the obvious-in-hindsight feeling |
| Meet Ward (1:45–2:30) | Introduce surface | Make the metaphor click |
| Live incident (2:30–6:30) | Show it works | **Generate the gasp moment** |
| Architecture (6:30–7:30) | Show how | Convert excitement → respect |
| Benchmark (7:30–8:30) | Show rigor | Convert respect → credibility |
| Startup arc (8:30–9:30) | Show ambition | Convert credibility → bet-worthy |
| Close (9:30–10:00) | Set up Q&A | Hand them a frame for their feedback |

Cut anything that doesn't serve the strategic purpose. If a slide is technically true but doesn't move the audience along this arc, drop it.

---

## Module 12 · The One-Line Test

Before locking the pitch: pick anyone on the team and ask them to summarize the project in **one sentence** without using the words "AI," "agent," or "LLM."

If they can't — the pitch isn't ready. The technology is doing too much of the load-bearing.

A good one-line: *"It's a benchmark that scores how well AI fixes production bugs, plus a reference agent that competes on it."*

Or even shorter: *"Autonomous oncall. Like SWE-bench, but for ops."*

Either lands. Both work without buzzwords.

---

## Module 13 · After The Demo

Three things to track after every showing:

1. **Where did eyes light up?** — the moment the panel leaned in. Lean harder on that next time.
2. **Where did eyes glaze?** — the moment they checked out. Cut or compress.
3. **What did they ask first?** — reveals what was unclear in the demo itself. If they ask "wait, what does the agent do?" the demo failed to show it.

Keep a notebook. Iterate the pitch after every showing. By the third performance, it should be ~30% shorter than the first.

---

## Companion docs

- `docs/SHOWCASE.md` — the tactical 17-module demo plan
- `docs/ENTERPRISE.md` — the integration / onboarding story
- `docs/PITCH.md` — *this doc*, the strategic layer
- `docs/ARCHITECTURE.md` — for the deep-dive Q&A

The three planning docs form a stack:
- **PITCH** = why this exists, how to talk about it
- **SHOWCASE** = what to build for the demo, how to run it
- **ENTERPRISE** = the future state for skeptical buyers / professors
