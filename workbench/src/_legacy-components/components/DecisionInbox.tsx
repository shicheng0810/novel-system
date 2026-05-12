import { useEffect, useState } from "react";

import { workbenchApi } from "../api";
import type { WorldEvent } from "../../../src/world-events/types";

type Props = {
  pollIntervalMs?: number;
};

export function DecisionInbox({ pollIntervalMs = 2000 }: Props) {
  const [events, setEvents] = useState<WorldEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await workbenchApi.worldEvents({
          severity: "decision-required",
          limit: 50,
        });
        if (!cancelled) setEvents(response.events);
      } catch {
        // ignore
      }
    };
    void poll();
    const handle = setInterval(() => void poll(), pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [pollIntervalMs]);

  if (events.length === 0) {
    return (
      <div className="decision-inbox-empty">
        <p>当前没有需要作者裁决的事件。</p>
        <small>CanonGate 拦截 / pause-on-risk 会在此排队。</small>
      </div>
    );
  }

  return (
    <ul className="decision-inbox-list">
      {events.map((event) => (
        <li key={event.id} className="decision-inbox-row">
          <header>
            <strong>{event.verb}</strong>
            <small>{event.subsystem}</small>
          </header>
          <p>{event.summary}</p>
          {event.refs ? (
            <pre className="decision-inbox-refs">
              {JSON.stringify(event.refs, null, 2)}
            </pre>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function useDecisionCount(pollIntervalMs = 2000): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await workbenchApi.worldEvents({
          severity: "decision-required",
          limit: 100,
        });
        if (!cancelled) setCount(response.events.length);
      } catch {
        // ignore
      }
    };
    void poll();
    const handle = setInterval(() => void poll(), pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [pollIntervalMs]);
  return count;
}
