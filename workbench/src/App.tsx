import { useEffect } from "react";

import { useEventStore } from "./stores/useEventStore";
import { useDaemonStore } from "./stores/useDaemonStore";
import { useSessionStore } from "./stores/useSessionStore";
import { useUIStore } from "./stores/useUIStore";

import { StatusBar } from "./features/status-bar/StatusBar";
import { WorldEchoes } from "./features/world-echoes/WorldEchoes";
import { DecisionInbox } from "./features/decision-inbox/DecisionInbox";
import { WritingCanvas } from "./features/writing-canvas/WritingCanvas";

export function App() {
  const connect = useEventStore((s) => s.connect);
  const disconnect = useEventStore((s) => s.disconnect);
  const ingestRuntimeEvent = useDaemonStore((s) => s.ingestRuntimeEvent);
  const refreshDaemon = useDaemonStore((s) => s.refresh);
  const refreshSession = useSessionStore((s) => s.refresh);
  const worldId = useSessionStore((s) => s.worldId);
  const railCollapsed = useUIStore((s) => s.railCollapsed);
  const bottomPanelOpen = useUIStore((s) => s.bottomPanelOpen);

  // Bootstrap: subscribe SSE + initial fetches.
  useEffect(() => {
    connect({ worldId });
    void refreshDaemon();
    void refreshSession();
    return () => disconnect();
  }, [connect, disconnect, refreshDaemon, refreshSession, worldId]);

  // SSE → daemon store: refresh status on runtime events.
  useEffect(() => {
    const unsub = useEventStore.subscribe((state, prev) => {
      const newest = state.events[0];
      if (!newest || newest === prev.events[0]) return;
      if (newest.subsystem === "runtime" || newest.subsystem === "commit") {
        ingestRuntimeEvent({ status: newest.status, subject: newest.subject, summary: newest.summary });
      }
    });
    return () => unsub();
  }, [ingestRuntimeEvent]);

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <span className="brand">Novel System · v3</span>
      </header>
      <div className="app-frame">
        <WritingCanvas />
        {!railCollapsed && (
          <aside className="codex-rail">
            <WorldEchoes />
            <DecisionInbox />
          </aside>
        )}
      </div>
      {bottomPanelOpen && (
        <section className="bottom-panel">
          {/* Phase 6.5: simulation controls + runtime ticks tab live here. */}
          <p>Bottom panel (推演 / Runtime) — to be filled in next iteration.</p>
        </section>
      )}
      <StatusBar />
    </div>
  );
}
