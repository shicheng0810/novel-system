import { useEffect } from "react";

import { useEventStore } from "./stores/useEventStore";
import { useDaemonStore } from "./stores/useDaemonStore";
import { useSessionStore } from "./stores/useSessionStore";
import { useUIStore } from "./stores/useUIStore";

import { StatusBar } from "./features/status-bar/StatusBar";
import { WritingCanvas } from "./features/writing-canvas/WritingCanvas";
import { WorldUploader } from "./features/world-uploader/WorldUploader";
import { CodexRail } from "./features/codex-rail/CodexRail";
import { BottomPanel } from "./features/bottom-panel/BottomPanel";
import { CommandPalette } from "./features/command-palette/CommandPalette";
import { SettingsModal } from "./features/settings/SettingsModal";

export function App() {
  const connect = useEventStore((s) => s.connect);
  const disconnect = useEventStore((s) => s.disconnect);
  const ingestRuntimeEvent = useDaemonStore((s) => s.ingestRuntimeEvent);
  const refreshDaemon = useDaemonStore((s) => s.refresh);
  const refreshSession = useSessionStore((s) => s.refresh);
  const snapshot = useSessionStore((s) => s.snapshot);
  const worldId = useSessionStore((s) => s.worldId);
  const railCollapsed = useUIStore((s) => s.railCollapsed);
  const toggleRail = useUIStore((s) => s.toggleRail);
  const toggleSettings = useUIStore((s) => s.toggleSettings);
  const togglePalette = useUIStore((s) => s.toggleCommandPalette);

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

  // Global key bindings: ⌘K / Ctrl+K to toggle palette; ⌘\\ to fold rail.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        togglePalette();
      } else if (meta && e.key === "\\") {
        e.preventDefault();
        toggleRail();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePalette, toggleRail]);

  const hasWorld = Boolean(snapshot);

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <span className="brand">Novel System · v3</span>
        <div className="app-topbar__actions">
          <button type="button" className="ghost" onClick={() => togglePalette()}>⌘K 命令面板</button>
          <button type="button" className="ghost" onClick={() => toggleSettings()} title="AI 设置">⚙</button>
        </div>
      </header>
      <div className="app-frame">
        {hasWorld ? <WritingCanvas /> : (
          <main className="writing-canvas">
            <WorldUploader />
          </main>
        )}
        {!railCollapsed && <CodexRail />}
      </div>
      <BottomPanel />
      <StatusBar />
      <CommandPalette />
      <SettingsModal />
    </div>
  );
}
