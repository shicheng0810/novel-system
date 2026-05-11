import { useEffect, useRef, useState } from "react";

import { workbenchApi } from "../api";
import type { WorldEvent } from "../../../src/world-events/types";

type Props = {
  pollIntervalMs?: number;
  qimenPattern?: string;
};

function describeEvent(event: WorldEvent | null): { verb: string; subject: string } {
  if (!event) return { verb: "静观", subject: "世界" };
  let verb = event.verb;
  if (event.status === "started" || event.status === "progress") {
    verb = `${verb}中`;
  }
  return { verb, subject: event.subject };
}

export function Heartbeat({ pollIntervalMs = 1500, qimenPattern }: Props) {
  const [event, setEvent] = useState<WorldEvent | null>(null);
  const lastKeyRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await workbenchApi.worldEvents({
          severity: "ambient,notable",
          limit: 1,
        });
        if (cancelled) return;
        const next = response.events[0] ?? null;
        const key = next ? `${next.subsystem}:${next.phase ?? ""}:${next.status}` : "";
        if (key !== lastKeyRef.current) {
          lastKeyRef.current = key;
          setEvent(next);
        }
      } catch {
        // ignore transient errors
      }
    };
    void poll();
    const handle = setInterval(() => void poll(), pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [pollIntervalMs]);

  const { verb, subject } = describeEvent(event);
  return (
    <span className="heartbeat" title="世界脉搏">
      世界脉搏：{verb} · {subject}
      {qimenPattern ? <span className="heartbeat-qimen"> · 局: {qimenPattern}</span> : null}
    </span>
  );
}
