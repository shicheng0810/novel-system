import { useEffect, useRef, useState } from "react";

import { useEventStore } from "../../stores/useEventStore";

const SEVERITY_LABEL: Record<string, string> = {
  ambient: "·",
  notable: "★",
  "decision-required": "!",
};

// P2-B · Threshold below which a new echo will auto-yank the scroll to top.
// Above this, we keep the user's reading position and show a "新回响" pill instead.
const AUTO_SCROLL_THRESHOLD_PX = 20;

export function WorldEchoes() {
  const events = useEventStore((s) =>
    s.events.filter((e) => e.severity !== "ambient").slice(0, 8),
  );
  const listRef = useRef<HTMLUListElement>(null);
  const [hasUnseen, setHasUnseen] = useState(false);
  const newestId = events[0]?.id;

  // P2-B · On new echo, either soft-scroll to top (if user was near top)
  // or surface an unobtrusive 新回响 indicator (if user was reading older echoes).
  useEffect(() => {
    if (!newestId || !listRef.current) return;
    const el = listRef.current;
    if (el.scrollTop <= AUTO_SCROLL_THRESHOLD_PX) {
      el.scrollTo({ top: 0, behavior: "smooth" });
      setHasUnseen(false);
    } else {
      setHasUnseen(true);
    }
  }, [newestId]);

  function jumpToLatest() {
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setHasUnseen(false);
  }

  if (events.length === 0) {
    return <div className="world-echoes world-echoes--empty">还没有回响</div>;
  }

  return (
    <div className="world-echoes">
      <h3>世界回响</h3>
      {hasUnseen && (
        <button type="button" className="world-echoes__pill" onClick={jumpToLatest}>
          ▲ 新回响
        </button>
      )}
      <ul ref={listRef}>
        {events.map((event) => (
          <li key={event.id} className={`echo echo--${event.severity}`}>
            <span className="echo__time">{new Date(event.ts).toLocaleTimeString("zh-CN", { hour12: false })}</span>
            <span className="echo__sev">{SEVERITY_LABEL[event.severity] ?? "·"}</span>
            <span className="echo__verb">{event.verb}</span>
            <span className="echo__summary">{event.summary}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
