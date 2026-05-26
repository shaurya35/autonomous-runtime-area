"use client";
import { useEffect, useRef, useState } from "react";
import type { ChannelEvent, VitalSigns } from "./api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function useIncidentStream(runId: string | null, replay = false): ChannelEvent[] {
  const [events, setEvents] = useState<ChannelEvent[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!runId) return;
    doneRef.current = false;

    function connect() {
      if (doneRef.current) return;
      const qs = replay ? "?replay=true&speed=4" : "";
      const es = new EventSource(`${API}/incidents/${runId}/stream${qs}`);
      esRef.current = es;

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
          setEvents((prev) => {
            if (prev.some(x => x.ts === ev.ts)) return prev;
            return [...prev, ev];
          });
          if (ev.phase === "done" || ev.phase === "failed") {
            doneRef.current = true;
            es.close();
          }
        } catch {}
      };

      es.onerror = () => {
        es.close();
        if (!doneRef.current) {
          // retry after 2s — EventSource will replay from offset 0 (backend re-streams file)
          retryRef.current = setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      doneRef.current = true;
      esRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [runId, replay]);

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
    es.onerror = () => {};
    return () => es.close();
  }, [name]);

  return vitals;
}
