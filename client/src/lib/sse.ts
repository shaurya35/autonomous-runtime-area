"use client";
import { useEffect, useRef, useState } from "react";
import type { ChannelEvent, VitalSigns } from "./api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function useIncidentStream(runId: string | null): ChannelEvent[] {
  const [events, setEvents] = useState<ChannelEvent[]>([]);

  useEffect(() => {
    if (!runId) return;
    const es = new EventSource(`${API}/incidents/${runId}/stream`);

    es.onmessage = (e) => {
      try {
        const raw = JSON.parse(e.data);
        const p = raw.payload ?? {};
        const ev: ChannelEvent = {
          ...raw,
          content: p.text ?? p.content ?? undefined,
          tool_name: p.tool ?? undefined,
          tool_input: p.input ?? undefined,
          tool_result: p.result ?? undefined,
        };
        setEvents((prev) => [...prev, ev]);
        if (ev.phase === "done" || ev.phase === "failed") es.close();
      } catch {}
    };

    es.onerror = () => {
      es.close();
    };

    return () => es.close();
  }, [runId]);

  return events;
}

export function useAppVitals(name: string | null): VitalSigns | null {
  const [vitals, setVitals] = useState<VitalSigns | null>(null);
  const bufferRef = useRef<Record<string, number[]>>({
    req_per_sec: [], p99_latency_ms: [], error_rate_pct: [], cpu_pct: []
  });

  useEffect(() => {
    if (!name) return;
    const es = new EventSource(`${API}/apps/${name}/vitals/stream`);
    es.onmessage = (e) => {
      try {
        const tick = JSON.parse(e.data);
        const buf = bufferRef.current;
        const MAX = 60;
        for (const key of ["req_per_sec", "p99_latency_ms", "error_rate_pct", "cpu_pct"] as const) {
          buf[key].push(tick[key] ?? 0);
          if (buf[key].length > MAX) buf[key].shift();
        }
        setVitals({
          ts_end: tick.ts,
          samples_per_second: 1,
          vitals: {
            req_per_sec: [...buf.req_per_sec],
            p99_latency_ms: [...buf.p99_latency_ms],
            error_rate_pct: [...buf.error_rate_pct],
            cpu_pct: [...buf.cpu_pct],
          }
        });
      } catch {}
    };
    return () => es.close();
  }, [name]);

  return vitals;
}
