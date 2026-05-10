import type { SimulationRunStore } from "./run-store";
import type { ArtifactRef, SimulationRun } from "./runtime-types";

export type RuntimeTraceEvent = {
  at: string;
  type:
    | "context-pack"
    | "cache-hit"
    | "cache-miss"
    | "session-sync"
    | "world-tick"
    | "world-resume"
    | "canon-gate"
    | "error";
  message: string;
  data?: unknown;
};

export class RuntimeTrace {
  private readonly events: RuntimeTraceEvent[] = [];

  event(type: RuntimeTraceEvent["type"], message: string, data?: unknown): RuntimeTraceEvent {
    const traceEvent: RuntimeTraceEvent = {
      at: new Date().toISOString(),
      type,
      message,
      data,
    };
    this.events.push(traceEvent);
    return traceEvent;
  }

  toJSONL(): string {
    return `${this.events.map((event) => JSON.stringify(event)).join("\n")}\n`;
  }

  snapshot(): RuntimeTraceEvent[] {
    return [...this.events];
  }

  async writeArtifacts(runStore: SimulationRunStore, run: SimulationRun): Promise<ArtifactRef[]> {
    const traceRef = await runStore.writeArtifact(run, {
      refId: "runtime.trace",
      relativePath: "runtime/trace.jsonl",
      kind: "jsonl",
      value: this.events,
    });
    await runStore.saveRun(run);
    return [traceRef];
  }
}
