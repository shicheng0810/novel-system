import { useEffect, useState } from "react";

import { workbenchApi } from "../api";
import type { WorldEvent, WorldEventSeverity } from "../../../src/world-events/types";

type Props = {
  chapterId?: string;
  pollIntervalMs?: number;
  visibleRows?: number;
};

const SEVERITY_ICON: Record<WorldEventSeverity, string> = {
  ambient: "·",
  notable: "◆",
  "decision-required": "⚠",
};

function formatTs(ts: number): string {
  const date = new Date(ts);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function WorldEchoes({ chapterId, pollIntervalMs = 2000, visibleRows = 3 }: Props) {
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [ambientCount, setAmbientCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const [primary, ambient] = await Promise.all([
          workbenchApi.worldEvents({
            chapterId,
            severity: "notable,decision-required",
            limit: 30,
          }),
          workbenchApi.worldEvents({
            chapterId,
            severity: "ambient",
            limit: 30,
          }),
        ]);
        if (cancelled) return;
        setEvents(showAll ? [...primary.events, ...ambient.events] : primary.events);
        setAmbientCount(ambient.events.length);
      } catch {
        // tolerate transient failures
      }
    };
    void poll();
    const handle = setInterval(() => void poll(), pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [chapterId, pollIntervalMs, showAll]);

  const visible = showAll ? events : events.slice(0, visibleRows);

  return (
    <section className="world-echoes" aria-label="世界回响">
      <header className="world-echoes-header">
        <strong>世界回响</strong>
        <small>
          {chapterId ? `本章 · ${chapterId}` : "全部"}
          <button
            type="button"
            className="ghost"
            onClick={() => setShowAll((value) => !value)}
            style={{ marginLeft: "0.5rem" }}
          >
            {showAll ? "折叠" : "全部"}
          </button>
        </small>
      </header>
      {visible.length === 0 ? (
        <p className="world-echoes-empty">世界静观中。等待第一条 notable 事件。</p>
      ) : (
        <ul className="world-echoes-list">
          {visible.map((event) => (
            <li
              key={event.id}
              className={`world-echoes-row world-echoes-${event.severity}`}
              onClick={() => setExpanded((current) => (current === event.id ? null : event.id))}
              role="button"
              tabIndex={0}
            >
              <span className="world-echoes-time">{formatTs(event.ts)}</span>
              <span className="world-echoes-icon" aria-hidden>{SEVERITY_ICON[event.severity]}</span>
              <span className="world-echoes-verb">{event.verb}</span>
              <span className="world-echoes-summary">{event.summary}</span>
              {expanded === event.id && event.refs ? (
                <pre className="world-echoes-refs">
                  {JSON.stringify(event.refs, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {!showAll && ambientCount > 0 ? (
        <footer className="world-echoes-footer">
          还有 {ambientCount} 条 ambient 已合并
        </footer>
      ) : null}
    </section>
  );
}
