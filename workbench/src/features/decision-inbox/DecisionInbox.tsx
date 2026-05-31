// DecisionInbox · 议事
// Each decision-required event becomes a CouncilCard — a ritual artifact, not a list item.
// Two ritual buttons: 依准 (uphold) / 另议 (return). Frontend-stub for now;
// backend endpoint /api/decisions/{id}/resolve is TODO — see useEventStore.dismissDecision.

import { useEventStore } from "../../stores/useEventStore";
import { useUIStore } from "../../stores/useUIStore";
import type { WorldEvent } from "../../types";

export function DecisionInbox() {
  const decisions = useEventStore((s) => s.decisions);
  const dismissDecision = useEventStore((s) => s.dismissDecision);
  const recordResolution = useUIStore((s) => s.recordDecisionResolution);

  if (decisions.length === 0) {
    return <div className="decision-inbox decision-inbox--empty">没有待裁决项</div>;
  }

  function onUphold(event: WorldEvent) {
    // TODO: POST /api/decisions/{id}/resolve { resolution: "uphold" }
    recordResolution(event.id, "uphold");
    dismissDecision(event.id);
    // Console marker for backend wiring: easy to grep.
    console.info("[decision] uphold", event.id, event.verb, event.summary);
  }

  function onReturn(event: WorldEvent) {
    // TODO: POST /api/decisions/{id}/resolve { resolution: "return" }
    recordResolution(event.id, "return");
    dismissDecision(event.id);
    console.info("[decision] return", event.id, event.verb, event.summary);
  }

  return (
    <div className="decision-inbox">
      <h3 className="decision-inbox__title">议事 · {decisions.length}</h3>
      <ul className="decision-inbox__cards">
        {decisions.map((event) => (
          <li key={event.id} className="council-card">
            <div className="council-card__seal" aria-hidden>
              <span className="council-card__seal-corner council-card__seal-corner--tl">⌜</span>
              <span className="council-card__seal-verb">{event.verb}</span>
              <span className="council-card__seal-corner council-card__seal-corner--br">⌟</span>
            </div>
            <div className="council-card__summary">{event.summary}</div>
            {event.refs && Object.keys(event.refs).length > 0 && (
              <div className="council-card__refs">
                {Object.entries(event.refs)
                  .slice(0, 3)
                  .map(([k, v]) => (
                    <span key={k} className="council-card__ref">
                      <span className="council-card__ref-k">{k}</span>{" "}
                      <span className="council-card__ref-v">{formatRef(v)}</span>
                    </span>
                  ))}
              </div>
            )}
            <div className="council-card__hairline" aria-hidden />
            <div className="council-card__actions">
              <button
                type="button"
                className="ghost council-card__action council-card__action--uphold"
                onClick={() => onUphold(event)}
              >
                依准
              </button>
              <button
                type="button"
                className="ghost council-card__action council-card__action--return"
                onClick={() => onReturn(event)}
              >
                另议
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatRef(v: unknown): string {
  if (typeof v === "number") {
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  }
  if (typeof v === "string") {
    return v.length > 24 ? v.slice(0, 23) + "…" : v;
  }
  if (Array.isArray(v)) return `${v.length} 项`;
  return String(v);
}
