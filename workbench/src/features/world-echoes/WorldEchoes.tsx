import { useEventStore } from "../../stores/useEventStore";

const SEVERITY_LABEL: Record<string, string> = {
  ambient: "·",
  notable: "★",
  "decision-required": "!",
};

export function WorldEchoes() {
  const events = useEventStore((s) =>
    s.events.filter((e) => e.severity !== "ambient").slice(0, 8),
  );

  if (events.length === 0) {
    return <div className="world-echoes world-echoes--empty">还没有回响</div>;
  }

  return (
    <div className="world-echoes">
      <h3>世界回响</h3>
      <ul>
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
