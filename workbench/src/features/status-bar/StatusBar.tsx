// StatusBar · 静观 (listening post)
// Default: collapsed single-line heartbeat with cinder pulse.
// Click heartbeat area → expands to a 3-line 听筒 panel of last 3 non-ambient events.

import { useMemo } from "react";

import { useEventStore } from "../../stores/useEventStore";
import { useDaemonStore } from "../../stores/useDaemonStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { useUIStore } from "../../stores/useUIStore";

export function StatusBar() {
  const sseState = useEventStore((s) => s.sseState);
  const latest = useEventStore((s) => s.latestPulse);
  const events = useEventStore((s) => s.events);
  const connect = useEventStore((s) => s.connect);
  const disconnect = useEventStore((s) => s.disconnect);
  const worldId = useSessionStore((s) => s.worldId);
  const status = useDaemonStore((s) => s.status);
  const expanded = useUIStore((s) => s.statusBarExpanded);
  const toggleExpanded = useUIStore((s) => s.toggleStatusBar);

  // P2-E · Manual reconnect when SSE is in an error state. Disconnect first to
  // close the broken EventSource, then re-open with the current worldId filter.
  function reconnect(e: React.MouseEvent) {
    e.stopPropagation();
    disconnect();
    connect({ worldId });
  }

  // Three most recent non-ambient events, for the 听筒 panel.
  const recent = useMemo(() => {
    return events.filter((e) => e.severity !== "ambient").slice(0, 3);
  }, [events]);

  const heartbeatFull = latest
    ? `${latest.verb}中 · ${latest.summary}`
    : "静观 · 等待事件";

  // When collapsed, truncate at 32 chars for the bar; tooltip shows full.
  const heartbeatText = latest
    ? `${latest.verb}中 · ${truncate(latest.summary, 32)}`
    : "静观 · 等待事件";

  const pill = status?.active
    ? `▶ ${status.completedTicks}/${status.targetTicks}`
    : status?.paused
      ? `⏸ ${status.completedTicks}/${status.targetTicks}`
      : status?.completed
        ? `✓ ${status.completedTicks}/${status.targetTicks}`
        : "▢ 0/0";

  const pillTooltip = status
    ? `runs: ${status.runIds.length}${status.lastRunId ? ` · last: ${status.lastRunId}` : ""}`
    : undefined;

  return (
    <footer className={`status-bar${expanded ? " status-bar--expanded" : ""}`}>
      {!expanded && (
        <div className="status-bar__line">
          <span className={`sse-dot sse-dot--${sseState}`} aria-label={`SSE ${sseState}`} />
          {sseState === "error" ? (
            <span className="status-bar__error">
              <span className="status-bar__error-text">SSE 断线</span>
              <button type="button" className="ghost status-bar__reconnect" onClick={reconnect}>
                ↻ 重连
              </button>
            </span>
          ) : (
            <span
              className="heartbeat"
              title={heartbeatFull}
              onClick={toggleExpanded}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleExpanded();
                }
              }}
            >
              <span className="heartbeat__cinder" aria-hidden />
              <span className="heartbeat__text">{heartbeatText}</span>
            </span>
          )}
          <span className="runtime-pill" title={pillTooltip}>{pill}</span>
        </div>
      )}
      {expanded && (
        <div className="status-bar__expanded" onClick={toggleExpanded} role="button" tabIndex={0}>
          <div className="status-bar__expanded-head">
            <span className={`sse-dot sse-dot--${sseState}`} aria-label={`SSE ${sseState}`} />
            <span className="status-bar__expanded-title">听筒 · 最近三声</span>
            <span className="status-bar__expanded-close muted">点此收起 ▾</span>
            <span className="runtime-pill" title={pillTooltip}>{pill}</span>
          </div>
          <ul className="status-bar__expanded-list">
            {recent.length === 0 && (
              <li className="status-bar__expanded-empty muted">暂无非旁声事件</li>
            )}
            {recent.map((e) => (
              <li key={e.id} className={`status-bar__expanded-row status-bar__expanded-row--${e.severity}`}>
                <span className="status-bar__expanded-time muted">
                  {new Date(e.ts).toLocaleTimeString("zh-CN", { hour12: false })}
                </span>
                <span className="status-bar__expanded-verb">{e.verb}</span>
                <span className="status-bar__expanded-summary">{e.summary}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </footer>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
