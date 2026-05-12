/**
 * Pure store-level tests. We run zustand stores directly (no React).
 * Since the workbench package is a sub-tsconfig, we import via relative paths.
 */
import { describe, expect, test, beforeEach } from "vitest";

import { useEventStore } from "../workbench/src/stores/useEventStore";
import { useUIStore } from "../workbench/src/stores/useUIStore";
import type { WorldEvent } from "../workbench/src/types";

function makeEvent(id: string, over: Partial<WorldEvent> = {}): WorldEvent {
  return {
    id,
    ts: Date.now(),
    worldId: "w1",
    subsystem: "compose",
    severity: "ambient",
    status: "succeeded",
    verb: "成文",
    subject: "本章",
    summary: `summary-${id}`,
    ...over,
  };
}

beforeEach(() => {
  useEventStore.setState({ events: [], bySubsystem: {}, decisions: [], latestPulse: undefined, sseState: "idle" });
  useUIStore.setState({
    activeMode: "writing",
    codexRailTab: "now",
    railCollapsed: false,
    bottomPanelOpen: false,
    showCommandPalette: false,
    showSettings: false,
    typewriterMode: false,
  });
});

describe("useEventStore", () => {
  test("ingest adds an event to the head, dedup by id", () => {
    useEventStore.getState().ingest(makeEvent("a"));
    useEventStore.getState().ingest(makeEvent("b"));
    useEventStore.getState().ingest(makeEvent("a", { summary: "updated" }));
    const state = useEventStore.getState();
    expect(state.events).toHaveLength(2);
    expect(state.events.find((e) => e.id === "a")?.summary).toBe("updated");
  });

  test("bySubsystem buckets events by subsystem", () => {
    useEventStore.getState().ingest(makeEvent("a", { subsystem: "compose" }));
    useEventStore.getState().ingest(makeEvent("b", { subsystem: "memory" }));
    useEventStore.getState().ingest(makeEvent("c", { subsystem: "compose" }));
    const state = useEventStore.getState();
    expect(state.bySubsystem.compose).toHaveLength(2);
    expect(state.bySubsystem.memory).toHaveLength(1);
  });

  test("decision-required severity flows into decisions list", () => {
    useEventStore.getState().ingest(makeEvent("a", { severity: "ambient" }));
    useEventStore.getState().ingest(makeEvent("b", { severity: "decision-required" }));
    expect(useEventStore.getState().decisions).toHaveLength(1);
  });

  test("latestPulse skips ambient events from non-runtime subsystems", () => {
    useEventStore.getState().ingest(makeEvent("a", { severity: "ambient", subsystem: "memory" }));
    expect(useEventStore.getState().latestPulse).toBeUndefined();
    useEventStore.getState().ingest(makeEvent("b", { severity: "notable", subsystem: "commit" }));
    expect(useEventStore.getState().latestPulse?.id).toBe("b");
  });

  test("bulkReplace resets state", () => {
    useEventStore.getState().bulkReplace([
      makeEvent("a", { severity: "decision-required" }),
      makeEvent("b", { severity: "notable" }),
    ]);
    expect(useEventStore.getState().events).toHaveLength(2);
    expect(useEventStore.getState().decisions).toHaveLength(1);
  });
});

describe("useUIStore", () => {
  test("setMode switches activity mode and updates codex tab for matching modes", () => {
    useUIStore.getState().setMode("memory");
    expect(useUIStore.getState().activeMode).toBe("memory");
    expect(useUIStore.getState().codexRailTab).toBe("memory");

    useUIStore.getState().setMode("writing");
    expect(useUIStore.getState().activeMode).toBe("writing");
    expect(useUIStore.getState().codexRailTab).toBe("memory");
  });

  test("setMode runtime opens bottom panel", () => {
    useUIStore.getState().setMode("runtime");
    expect(useUIStore.getState().bottomPanelOpen).toBe(true);
  });

  test("toggleRail flips railCollapsed", () => {
    useUIStore.getState().toggleRail();
    expect(useUIStore.getState().railCollapsed).toBe(true);
    useUIStore.getState().toggleRail();
    expect(useUIStore.getState().railCollapsed).toBe(false);
  });
});
