import { useEffect, useMemo, useState } from "react";

import { workbenchApi } from "../api";
import type { WorldEvent } from "../../../src/world-events/types";

const SIX_STAGES = [
  { phase: "memory-read", label: "取材" },
  { phase: "blueprint", label: "立骨" },
  { phase: "scene-expand", label: "铺场" },
  { phase: "synthesize", label: "成文" },
  { phase: "critique", label: "自审" },
  { phase: "memory-write", label: "入史" },
] as const;

type StageState = "pending" | "running" | "succeeded" | "failed" | "blocked";

type StageView = {
  phase: string;
  label: string;
  state: StageState;
};

type Props = {
  runId: string | null;
  pollIntervalMs?: number;
};

function deriveStages(events: WorldEvent[]): {
  stages: StageView[];
  current: StageView | null;
  summary: string;
} {
  const byPhase: Record<string, { latestStatus: WorldEvent["status"]; summary: string; ts: number }> = {};
  for (const event of events) {
    if (!event.phase) continue;
    const previous = byPhase[event.phase];
    if (!previous || event.ts >= previous.ts) {
      byPhase[event.phase] = {
        latestStatus: event.status,
        summary: event.summary,
        ts: event.ts,
      };
    }
  }
  const stages: StageView[] = SIX_STAGES.map(({ phase, label }) => {
    const seen = byPhase[phase];
    let state: StageState = "pending";
    if (seen) {
      if (seen.latestStatus === "succeeded") state = "succeeded";
      else if (seen.latestStatus === "failed") state = "failed";
      else if (seen.latestStatus === "blocked") state = "blocked";
      else state = "running";
    }
    return { phase, label, state };
  });
  const runningIdx = stages.findIndex((s) => s.state === "running");
  const lastDoneIdx = stages.map((s) => s.state).lastIndexOf("succeeded");
  const currentIdx = runningIdx >= 0 ? runningIdx : Math.min(lastDoneIdx + 1, stages.length - 1);
  const current = stages[currentIdx] ?? null;
  const summary = current ? byPhase[current.phase]?.summary ?? "" : "";
  return { stages, current, summary };
}

const STATE_GLYPH: Record<StageState, string> = {
  pending: "▱",
  running: "▰",
  succeeded: "▰",
  failed: "▰",
  blocked: "▰",
};

export function SixStageProgress({ runId, pollIntervalMs = 1500 }: Props) {
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    setIsLive(true);
    const poll = async () => {
      try {
        const response = await workbenchApi.worldEvents({
          subsystem: "compose",
          runId,
          limit: 100,
        });
        if (!cancelled) setEvents(response.events);
      } catch {
        // tolerate transient fetch errors
      }
    };
    void poll();
    const handle = setInterval(() => void poll(), pollIntervalMs);
    return () => {
      cancelled = true;
      setIsLive(false);
      clearInterval(handle);
    };
  }, [runId, pollIntervalMs]);

  const view = useMemo(() => deriveStages(events), [events]);

  if (!runId || !isLive) return null;

  return (
    <div className="six-stage-progress" role="status" aria-live="polite">
      <div className="six-stage-lights">
        <span className="six-stage-leader">写续段：</span>
        {view.stages.map((stage) => (
          <span
            key={stage.phase}
            className={`six-stage-light six-stage-light-${stage.state}`}
            title={`${stage.label} (${stage.state})`}
          >
            {stage.label} {STATE_GLYPH[stage.state]}
          </span>
        ))}
      </div>
      <div className="six-stage-summary">{view.summary || "等待第一阶段开始…"}</div>
    </div>
  );
}
