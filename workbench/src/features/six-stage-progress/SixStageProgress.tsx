import { useMemo } from "react";

import { useEventStore } from "../../stores/useEventStore";
import type { WorldEvent } from "../../types";

const PHASES = [
  { id: "memory-read", label: "取材" },
  { id: "blueprint", label: "立骨" },
  { id: "scene-cards", label: "铺场" },
  { id: "synthesize", label: "成文" },
  { id: "review", label: "自审" },
  { id: "inscribe", label: "入史" },
] as const;

type Status = "idle" | "active" | "done" | "blocked";

export function SixStageProgress() {
  const composeEvents = useEventStore((s) => s.bySubsystem.compose ?? []);

  const { activePhase, perPhase } = useMemo(() => derive(composeEvents), [composeEvents]);

  return (
    <ol className="six-stage-progress">
      {PHASES.map((p) => {
        const ph = perPhase.get(p.id);
        const state: Status = ph?.state ?? (activePhase && phaseIndex(p.id) < phaseIndex(activePhase) ? "done" : "idle");
        return (
          <li key={p.id} className={`stage-dot stage-dot--${state}`} title={ph?.summary ?? p.label}>
            <span className="stage-dot__pip" />
            <span className="stage-dot__label">{p.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function phaseIndex(id: string): number {
  return PHASES.findIndex((p) => p.id === id);
}

function derive(events: WorldEvent[]): {
  activePhase: string | undefined;
  perPhase: Map<string, { state: Status; summary: string }>;
} {
  const perPhase = new Map<string, { state: Status; summary: string }>();
  let activePhase: string | undefined;
  // events arrive newest-first per the bucket; walk oldest-first so the
  // newest status for each phase wins.
  for (const event of [...events].reverse()) {
    if (!event.phase) continue;
    if (!PHASES.some((p) => p.id === event.phase)) continue;
    let state: Status = "idle";
    if (event.status === "started" || event.status === "progress") state = "active";
    else if (event.status === "succeeded") state = "done";
    else if (event.status === "blocked" || event.status === "failed") state = "blocked";
    perPhase.set(event.phase, { state, summary: event.summary });
    if (state === "active") activePhase = event.phase;
    else if (state === "blocked") activePhase = event.phase;
  }
  return { activePhase, perPhase };
}
