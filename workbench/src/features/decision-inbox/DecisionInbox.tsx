import { useEventStore } from "../../stores/useEventStore";

export function DecisionInbox() {
  const decisions = useEventStore((s) => s.decisions);

  if (decisions.length === 0) {
    return <div className="decision-inbox decision-inbox--empty">没有待裁决项</div>;
  }
  return (
    <div className="decision-inbox">
      <h3>待裁决 · {decisions.length}</h3>
      <ul>
        {decisions.map((event) => (
          <li key={event.id}>
            <div className="decision__verb">{event.verb}</div>
            <div className="decision__summary">{event.summary}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
