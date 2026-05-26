import json
from datetime import datetime
from io import BytesIO
from pathlib import Path

import anthropic
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

NAVY      = colors.HexColor("#0a1226")
ACCENT    = colors.HexColor("#22d3ee")
GREEN     = colors.HexColor("#10b981")
AMBER     = colors.HexColor("#f59e0b")
REDC      = colors.HexColor("#ef4444")
LIGHT_BG  = colors.HexColor("#f8fafc")
DARK_TEXT = colors.HexColor("#1e293b")
MUTED     = colors.HexColor("#64748b")
BORDER    = colors.HexColor("#e2e8f0")


def _score_color(score: float) -> colors.Color:
    if score >= 0.7:
        return GREEN
    if score >= 0.4:
        return AMBER
    return REDC


def _load_result(results_dir: Path, run_id: str) -> dict:
    f = results_dir / f"{run_id}.json"
    if f.exists():
        return json.loads(f.read_text())
    raise FileNotFoundError(f"Result not found: {run_id}")


def _load_events(evidence_dir: Path, run_id: str) -> list[dict]:
    f = evidence_dir / f"{run_id}.jsonl"
    if not f.exists():
        return []
    events = []
    for line in f.read_text().splitlines():
        line = line.strip()
        if line:
            try:
                events.append(json.loads(line))
            except Exception:
                pass
    return events


def _compute_phase_durations(events: list[dict], phases_reached: list[str]) -> dict[str, float | None]:
    PHASES = ["detecting", "diagnosing", "fixing", "verifying"]
    first: dict[str, float] = {}
    last: dict[str, float] = {}
    for ev in events:
        phase = ev.get("phase", "")
        ts = ev.get("ts", 0.0)
        if phase in PHASES:
            if phase not in first:
                first[phase] = ts
            last[phase] = ts
    durations: dict[str, float | None] = {}
    for ph in PHASES:
        if ph in first:
            durations[ph] = round(last[ph] - first[ph], 1)
        elif ph in phases_reached:
            durations[ph] = 0.0
        else:
            durations[ph] = None
    return durations


def _load_historical(results_dir: Path, app: str, incident_id: str, exclude: str) -> list[dict]:
    runs = []
    for f in results_dir.glob("*.json"):
        try:
            d = json.loads(f.read_text())
            if d.get("app") == app and d.get("incident_id") == incident_id and d.get("run_id") != exclude:
                runs.append(d)
        except Exception:
            pass
    return runs


def _load_incident_meta(app_dirs: dict, app: str, incident_id: str) -> dict:
    from srebench.schema import load_incident
    app_dir = app_dirs.get(app)
    if not app_dir:
        return {}
    inc_path = Path(app_dir) / "incidents" / f"{incident_id}.yaml"
    if not inc_path.exists():
        return {}
    try:
        inc = load_incident(inc_path)
        gt = getattr(inc, "ground_truth", None)
        ag = getattr(inc, "agent_sees", None)
        return {
            "title": inc.title,
            "category": getattr(inc, "category", "unknown"),
            "difficulty": getattr(inc, "difficulty", "unknown"),
            "root_cause": getattr(gt, "root_cause", None),
            "alert": getattr(ag, "alert", None),
        }
    except Exception:
        return {}


def _generate_narrative(
    client: anthropic.Anthropic,
    result: dict,
    inc_meta: dict,
    events: list[dict],
    historical: list[dict],
) -> dict[str, str]:
    tool_calls = [
        f"{ev.get('phase', 'unknown')}: {ev.get('payload', {}).get('tool', '')}"
        for ev in events
        if ev.get("type") == "tool_call"
    ]
    hist_mttr = [r["mttr_s"] for r in historical if r.get("mttr_s") is not None]
    hist_note = (
        f"Prior runs averaged {sum(hist_mttr)/len(hist_mttr):.0f}s MTTR."
        if hist_mttr else "This is the first recorded run for this incident."
    )

    prompt = (
        "You are writing an incident resolution report for a software engineering audience.\n"
        "Write exactly 3 paragraphs labeled as shown below. Each paragraph must be 60 to 90 words.\n"
        "Rules: no em dashes, no marketing language, plain direct technical prose, "
        "do not copy input data verbatim.\n\n"
        "Use these exact labels on their own line before each paragraph:\n"
        "WHAT HAPPENED\n"
        "HOW SENTINEL RESOLVED IT\n"
        "KEY OBSERVATIONS\n\n"
        "Context:\n"
        f"- Application: {result.get('app', 'unknown')}\n"
        f"- Incident: {result.get('incident_id')} -- {inc_meta.get('title', '')}\n"
        f"- Category: {inc_meta.get('category', 'unknown')}, "
        f"Difficulty: {inc_meta.get('difficulty', 'unknown')}\n"
        f"- Root cause: {inc_meta.get('root_cause', 'not specified')}\n"
        f"- Alert context: {inc_meta.get('alert', 'not specified')}\n"
        f"- Final score: {result.get('score', 0):.2f} (0.0 to 1.0)\n"
        f"- MTTR: {result.get('mttr_s', 0)}s\n"
        f"- Phases completed: {', '.join(result.get('phases_reached', []))}\n"
        f"- Tools used: {', '.join(tool_calls) if tool_calls else 'none recorded'}\n"
        f"- Benchmark note: {hist_note}\n\n"
        "Output only the 3 labeled paragraphs, nothing else."
    )

    try:
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.content[0].text.strip()
        sections: dict[str, str] = {}
        current_label: str | None = None
        current_lines: list[str] = []
        labels = {"WHAT HAPPENED", "HOW SENTINEL RESOLVED IT", "KEY OBSERVATIONS"}
        for line in text.splitlines():
            if line.strip() in labels:
                if current_label:
                    sections[current_label] = " ".join(current_lines).strip()
                current_label = line.strip()
                current_lines = []
            elif current_label and line.strip():
                current_lines.append(line.strip())
        if current_label:
            sections[current_label] = " ".join(current_lines).strip()
        return sections
    except Exception as e:
        score = result.get("score", 0)
        mttr = result.get("mttr_s", 0)
        return {
            "WHAT HAPPENED": f"Narrative generation was unavailable ({type(e).__name__}). "
                             f"The incident {result.get('incident_id', '')} occurred in "
                             f"{result.get('app', 'the application')}.",
            "HOW SENTINEL RESOLVED IT": "The agent completed the incident resolution workflow "
                                        "across the phases listed in the Phase Analysis section.",
            "KEY OBSERVATIONS": f"Final score: {score:.2f}. MTTR: {mttr}s. "
                                 f"See the Benchmark Context section for historical comparison.",
        }


def _styles() -> dict[str, ParagraphStyle]:
    B = "Helvetica-Bold"
    R = "Helvetica"
    M = "Courier"
    return {
        "header_title": ParagraphStyle("header_title", fontName=B, fontSize=14,
                                       textColor=colors.white, leading=18),
        "header_meta":  ParagraphStyle("header_meta",  fontName=R, fontSize=9,
                                       textColor=ACCENT, leading=13, alignment=2),
        "section_lbl":  ParagraphStyle("section_lbl",  fontName=B, fontSize=9,
                                       textColor=NAVY, leading=14, spaceBefore=4, spaceAfter=2),
        "label":        ParagraphStyle("label",  fontName=B, fontSize=9,
                                       textColor=MUTED, leading=13),
        "value":        ParagraphStyle("value",  fontName=R, fontSize=9,
                                       textColor=DARK_TEXT, leading=13),
        "value_ok":     ParagraphStyle("value_ok",  fontName=B, fontSize=9,
                                       textColor=GREEN, leading=13),
        "value_muted":  ParagraphStyle("value_muted", fontName=R, fontSize=9,
                                       textColor=MUTED, leading=13),
        "mono":         ParagraphStyle("mono",  fontName=M, fontSize=8,
                                       textColor=DARK_TEXT, leading=12),
        "big_score":    ParagraphStyle("big_score", fontName=B, fontSize=30,
                                       textColor=DARK_TEXT, leading=36),
        "formula":      ParagraphStyle("formula", fontName=M, fontSize=8,
                                       textColor=MUTED, leading=12),
        "th":           ParagraphStyle("th", fontName=B, fontSize=9,
                                       textColor=colors.white, leading=13),
        "ai_label":     ParagraphStyle("ai_label", fontName=B, fontSize=9,
                                       textColor=ACCENT, leading=13, spaceBefore=6),
        "ai_body":      ParagraphStyle("ai_body", fontName=R, fontSize=9,
                                       textColor=DARK_TEXT, leading=14, leftIndent=12),
        "footer":       ParagraphStyle("footer", fontName=R, fontSize=8,
                                       textColor=MUTED, leading=11, alignment=1),
    }


def generate_report_pdf(
    run_id: str,
    results_dir: Path,
    evidence_dir: Path,
    app_dirs: dict,
    anthropic_api_key: str,
) -> bytes:
    result = _load_result(results_dir, run_id)
    events = _load_events(evidence_dir, run_id)

    app         = result.get("app", "unknown")
    incident_id = result.get("incident_id", "unknown")
    score       = float(result.get("score") or 0)
    mttr_s      = int(result.get("mttr_s") or 0)
    phases      = result.get("phases_reached") or []
    status      = result.get("status", "done")

    inc_meta       = _load_incident_meta(app_dirs, app, incident_id)
    phase_dur      = _compute_phase_durations(events, phases)
    historical     = _load_historical(results_dir, app, incident_id, run_id)
    hist_scores    = [r["score"] for r in historical if r.get("score") is not None]
    hist_mttr      = [r["mttr_s"] for r in historical if r.get("mttr_s") is not None]
    all_scores     = hist_scores + [score]
    best_score     = max(all_scores)
    total_runs     = len(historical) + 1
    solved_count   = sum(1 for s in all_scores if s >= 0.7)
    avg_mttr_str   = f"{sum(hist_mttr)/len(hist_mttr):.1f}s" if hist_mttr else "first run"

    detected  = "detecting"  in phases
    diagnosed = "diagnosing" in phases
    fixed     = "fixing"     in phases and status == "done"
    raw       = 0.2 * detected + 0.3 * diagnosed + 0.5 * fixed
    penalty   = max(0.0, (mttr_s / 60 - 5) * 0.01)

    ai_client = anthropic.Anthropic(api_key=anthropic_api_key)
    narrative = _generate_narrative(ai_client, result, inc_meta, events, historical)

    buf = BytesIO()
    W = A4[0] - 4 * cm
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm)
    S = _styles()
    PHASES = ["detecting", "diagnosing", "fixing", "verifying"]
    story = []

    # ── Header band ────────────────────────────────────────────────────────────
    hdr = Table(
        [[Paragraph("INCIDENT RESOLUTION REPORT", S["header_title"]),
          Paragraph(f"Run {run_id[:8]}<br/>"
                    f'<font color="#6f7a98">'
                    f'{datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")}'
                    f"</font>", S["header_meta"])]],
        colWidths=[W * 0.65, W * 0.35],
    )
    hdr.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("TOPPADDING",    (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("LEFTPADDING",   (0, 0), (0, -1),  16),
        ("RIGHTPADDING",  (-1, 0), (-1, -1), 16),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(hdr)
    story.append(Spacer(1, 0.5*cm))

    # ── Incident Overview ──────────────────────────────────────────────────────
    story.append(Paragraph("INCIDENT OVERVIEW", S["section_lbl"]))
    story.append(HRFlowable(width=W, thickness=1, color=BORDER, spaceAfter=4))
    ov_rows = [
        ("Application", app),
        ("Incident ID", incident_id),
        ("Title",       inc_meta.get("title", "N/A")),
        ("Category",    (inc_meta.get("category") or "unknown").capitalize()),
        ("Difficulty",  (inc_meta.get("difficulty") or "unknown").capitalize()),
    ]
    ov = Table(
        [[Paragraph(k, S["label"]), Paragraph(v, S["value"])] for k, v in ov_rows],
        colWidths=[W * 0.28, W * 0.72],
    )
    ov.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, LIGHT_BG]),
    ]))
    story.append(ov)
    story.append(Spacer(1, 0.5*cm))

    # ── Performance Metrics ────────────────────────────────────────────────────
    story.append(Paragraph("PERFORMANCE METRICS", S["section_lbl"]))
    story.append(HRFlowable(width=W, thickness=1, color=BORDER, spaceAfter=4))

    sc = _score_color(score)
    formula_str = (
        f"0.2 x detected ({int(detected)}) + 0.3 x diagnosed ({int(diagnosed)}) "
        f"+ 0.5 x fixed ({int(fixed)}) = {raw:.2f}"
        + (f"  minus  {penalty:.3f} time penalty" if penalty > 0.001 else "")
    )
    score_row = Table(
        [[Paragraph(f"{score:.2f}", S["big_score"]),
          Paragraph(formula_str, S["formula"])]],
        colWidths=[W * 0.2, W * 0.8],
    )
    score_row.setStyle(TableStyle([
        ("LINEBEFORE",    (0, 0), (0, -1), 5, sc),
        ("BACKGROUND",    (0, 0), (-1, -1), LIGHT_BG),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING",   (0, 0), (0, -1),  12),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(score_row)
    story.append(Spacer(1, 0.25*cm))

    mttr_disp = f"{mttr_s // 60}m {mttr_s % 60}s" if mttr_s >= 60 else f"{mttr_s}s"
    penalty_disp = f"{penalty:.3f}" if penalty > 0.001 else "None"
    met_rows = [
        [Paragraph("MTTR",          S["label"]), Paragraph(mttr_disp,                 S["mono"]),
         Paragraph("Time Penalty",  S["label"]), Paragraph(penalty_disp,              S["mono"])],
        [Paragraph("Status",        S["label"]), Paragraph(status.upper(),            S["value"]),
         Paragraph("Phases Reached",S["label"]), Paragraph(f"{len(phases)} / 4",      S["value"])],
    ]
    mt = Table(met_rows, colWidths=[W*0.22, W*0.28, W*0.22, W*0.28])
    mt.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, LIGHT_BG]),
    ]))
    story.append(mt)
    story.append(Spacer(1, 0.5*cm))

    # ── Phase Analysis ─────────────────────────────────────────────────────────
    story.append(Paragraph("PHASE ANALYSIS", S["section_lbl"]))
    story.append(HRFlowable(width=W, thickness=1, color=BORDER, spaceAfter=4))

    ph_rows = [[Paragraph(h, S["th"]) for h in ["Phase", "Reached", "Duration"]]]
    for ph in PHASES:
        reached = ph in phases
        dur = phase_dur.get(ph)
        dur_str = f"{dur:.1f}s" if dur and dur > 0 else ("< 1s" if reached else "—")
        ph_rows.append([
            Paragraph(ph.capitalize(), S["value"]),
            Paragraph("Yes" if reached else "No",
                      S["value_ok"] if reached else S["value_muted"]),
            Paragraph(dur_str, S["mono"]),
        ])
    pht = Table(ph_rows, colWidths=[W*0.35, W*0.25, W*0.4])
    pht.setStyle(TableStyle([
        ("BACKGROUND",   (0, 0), (-1, 0), NAVY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
    ]))
    story.append(pht)
    story.append(Spacer(1, 0.5*cm))

    # ── Benchmark Context ──────────────────────────────────────────────────────
    story.append(Paragraph("BENCHMARK CONTEXT", S["section_lbl"]))
    story.append(HRFlowable(width=W, thickness=1, color=BORDER, spaceAfter=4))

    success_pct = f"{solved_count * 100 // total_runs}%" if total_runs > 0 else "0%"
    ctx_rows = [
        ("Best Score (all runs)",        f"{best_score:.2f}"),
        ("Average MTTR (prior runs)",    avg_mttr_str),
        ("Total Runs",                   str(total_runs)),
        ("Success Rate (score >= 0.70)", f"{solved_count} / {total_runs} ({success_pct})"),
    ]
    ctx = Table(
        [[Paragraph(k, S["label"]), Paragraph(v, S["value"])] for k, v in ctx_rows],
        colWidths=[W * 0.48, W * 0.52],
    )
    ctx.setStyle(TableStyle([
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, LIGHT_BG]),
    ]))
    story.append(ctx)
    story.append(Spacer(1, 0.5*cm))

    # ── AI Analysis ────────────────────────────────────────────────────────────
    story.append(Paragraph("AI ANALYSIS", S["section_lbl"]))
    story.append(HRFlowable(width=W, thickness=1, color=BORDER, spaceAfter=4))

    for label, key in [
        ("What Happened",            "WHAT HAPPENED"),
        ("How Sentinel Resolved It", "HOW SENTINEL RESOLVED IT"),
        ("Key Observations",         "KEY OBSERVATIONS"),
    ]:
        text = narrative.get(key, "")
        if text:
            story.append(Paragraph(label, S["ai_label"]))
            story.append(Paragraph(text,  S["ai_body"]))

    story.append(Spacer(1, 0.5*cm))

    # ── Footer ─────────────────────────────────────────────────────────────────
    story.append(HRFlowable(width=W, thickness=0.5, color=BORDER))
    story.append(Spacer(1, 0.2*cm))
    story.append(Paragraph(
        f"Generated by Sentinel / claude-sonnet-4-6 / "
        f"{datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        S["footer"],
    ))

    doc.build(story)
    return buf.getvalue()
