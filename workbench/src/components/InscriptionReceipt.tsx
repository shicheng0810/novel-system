import { useEffect, useMemo, useState } from "react";

import { workbenchApi } from "../api";
import type { WorldEvent } from "../../../src/world-events/types";

type Props = {
  confirmTs: number | null;
  lineId?: string;
  autoCollapseMs?: number;
};

type ReceiptBreakdown = {
  memoryCount: number;
  atlasFiles: number;
  canonOutcome: string;
  promotionCount: number;
  cascadeSummary: string;
};

function summarize(events: WorldEvent[]): ReceiptBreakdown {
  let memoryCount = 0;
  let atlasFiles = 0;
  let canonOutcome = "未触发";
  let promotionCount = 0;
  let cascadeSummary = "";
  for (const event of events) {
    if (event.subsystem === "memory") memoryCount += 1;
    if (event.subsystem === "atlas") atlasFiles += 1;
    if (event.subsystem === "canon") {
      canonOutcome = event.status === "succeeded" ? "通过" : event.status === "failed" ? "拒绝" : "高风险";
    }
    if (event.subsystem === "promotion") promotionCount += 1;
    if (event.subsystem === "compose" && event.phase === "confirm-final") {
      cascadeSummary = event.summary;
      const refs = event.refs as Record<string, unknown> | undefined;
      const atlasRef = refs?.atlasFiles;
      if (Array.isArray(atlasRef)) atlasFiles = Math.max(atlasFiles, atlasRef.length);
      const sceneRef = refs?.sceneCount;
      if (typeof sceneRef === "number") memoryCount = Math.max(memoryCount, sceneRef);
    }
  }
  return { memoryCount, atlasFiles, canonOutcome, promotionCount, cascadeSummary };
}

export function InscriptionReceipt({ confirmTs, lineId, autoCollapseMs = 5000 }: Props) {
  const [events, setEvents] = useState<WorldEvent[] | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (confirmTs === null) {
      setEvents(null);
      setCollapsed(false);
      return;
    }
    setCollapsed(false);
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await workbenchApi.worldEvents({
          since: confirmTs,
          subsystem: "memory,atlas,canon,promotion,compose",
          chapterId: lineId,
          limit: 50,
        });
        if (!cancelled) setEvents(response.events);
      } catch {
        // tolerate fetch errors
      }
    };
    void poll();
    const handle = setInterval(() => void poll(), 1500);
    const collapseHandle = setTimeout(() => {
      if (!cancelled) setCollapsed(true);
    }, autoCollapseMs);
    return () => {
      cancelled = true;
      clearInterval(handle);
      clearTimeout(collapseHandle);
    };
  }, [confirmTs, lineId, autoCollapseMs]);

  const summary = useMemo(() => summarize(events ?? []), [events]);

  if (confirmTs === null || events === null) return null;

  return (
    <div className={`inscription-receipt ${collapsed ? "collapsed" : ""}`} role="status">
      <header className="inscription-receipt-header">
        <strong>终稿已入史 ✓</strong>
        <button
          type="button"
          className="ghost"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "展开 receipt" : "收起 receipt"}
        >
          {collapsed ? "展开" : "收起"}
        </button>
      </header>
      {!collapsed && (
        <ul className="inscription-receipt-list">
          <li>正史分支：{lineId ?? "—"}（promotion {summary.promotionCount}）</li>
          <li>记忆：+{summary.memoryCount}</li>
          <li>图谱：{summary.atlasFiles} 文件更新</li>
          <li>Canon：{summary.canonOutcome}</li>
          {summary.cascadeSummary ? <li className="cascade-line">{summary.cascadeSummary}</li> : null}
        </ul>
      )}
    </div>
  );
}
