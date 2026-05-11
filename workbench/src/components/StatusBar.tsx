import type { SimulationRunSummary, WorkbenchSessionState } from "../contracts";
import type { UIState } from "../store";

type StatusBarProps = {
  session: WorkbenchSessionState | null;
  runs: SimulationRunSummary[];
  pendingAction: string | null;
  setUI: (updater: (current: UIState) => UIState) => void;
};

function formatAgo(iso?: string): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "";
  if (ms < 60_000) return `${Math.max(1, Math.floor(ms / 1000))}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

export function StatusBar({ session, runs, pendingAction, setUI }: StatusBarProps) {
  const daemon = session?.runtimeDaemon;
  const activeRun = runs.find((r) => r.status === "running");

  let pillText: string;
  let pillKind: "idle" | "running" | "paused" | "failed" = "idle";

  if (daemon?.active && activeRun) {
    const ago = formatAgo(activeRun.updatedAt);
    pillText = `▶ ${activeRun.stepCount}/${daemon.targetTicks ?? "?"} ticks${ago ? ` · ${ago}` : ""}`;
    pillKind = "running";
  } else if (daemon?.active) {
    pillText = `▶ ${daemon.completedTicks}/${daemon.targetTicks} ticks`;
    pillKind = "running";
  } else if (daemon?.paused) {
    pillText = `▮ paused ${daemon.completedTicks}/${daemon.targetTicks}`;
    pillKind = "paused";
  } else if (daemon?.failed) {
    pillText = `✗ failed ${daemon.completedTicks}/${daemon.targetTicks}`;
    pillKind = "failed";
  } else {
    pillText = "▢ 0/0";
  }

  function openRuntime() {
    setUI((current) => ({
      ...current,
      bottomPanelOpen: true,
      bottomPanelTab: "ticks",
    }));
  }

  return (
    <footer className="status-bar">
      <div className="status-bar-left">
        <span>{session?.providerName ?? "provider 未知"}</span>
        <span>{session?.aiSettings?.model ?? "—"}</span>
        <span>line {session?.selectedLineId ?? "canon"}</span>
        {pendingAction && <span className="status-bar-pending">处理中：{pendingAction}</span>}
      </div>
      <div className="status-bar-right">
        <button
          type="button"
          className={`runtime-pill runtime-pill-${pillKind}`}
          onClick={openRuntime}
          title="点击展开 Runtime 面板"
        >
          {pillText}
        </button>
      </div>
    </footer>
  );
}
