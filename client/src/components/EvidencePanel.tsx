"use client";
import type { ChannelEvent } from "@/lib/api";

export function EvidencePanel({ event, onClose }: { event: ChannelEvent; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-zinc-400 text-sm">{event.phase} · {event.type}</span>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 font-mono">✕</button>
        </div>
        <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap overflow-auto">
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      </div>
    </div>
  );
}
