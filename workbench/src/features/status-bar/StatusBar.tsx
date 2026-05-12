import { useEventStore } from "../../stores/useEventStore";
import { useDaemonStore } from "../../stores/useDaemonStore";

export function StatusBar() {
  const sseState = useEventStore((s) => s.sseState);
  const latest = useEventStore((s) => s.latestPulse);
  const status = useDaemonStore((s) => s.status);

  const heartbeatText = latest
    ? `${latest.verb}中 · ${latest.summary.slice(0, 32)}`
    : "静观 · 等待事件";

  const pill = status?.active
    ? `▶ ${status.completedTicks}/${status.targetTicks}`
    : status?.paused
      ? `⏸ ${status.completedTicks}/${status.targetTicks}`
      : status?.completed
        ? `✓ ${status.completedTicks}/${status.targetTicks}`
        : "▢ 0/0";

  return (
    <footer className="status-bar">
      <div className="status-bar__left">
        <span className={`sse-dot sse-dot--${sseState}`} aria-label={`SSE ${sseState}`} />
        <span className="heartbeat">{heartbeatText}</span>
      </div>
      <div className="status-bar__right">
        <span className="runtime-pill">{pill}</span>
      </div>
    </footer>
  );
}
