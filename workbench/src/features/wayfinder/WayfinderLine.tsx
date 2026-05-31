// Way-finder line · 引路
// A single whisper-imperative living in the topbar's negative space.
// Always answers "what next breath?" based on app state. Ambient surface — no chrome.

import { useEffect, useMemo, useState } from "react";

import { useDaemonStore } from "../../stores/useDaemonStore";
import { useEventStore } from "../../stores/useEventStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { useUIStore } from "../../stores/useUIStore";

type Wayfinder = {
  text: string;
  // Optional click affordance. If present, cursor → pointer and underline on hover.
  onClick?: () => void;
};

export function WayfinderLine() {
  const snapshot = useSessionStore((s) => s.snapshot);
  const status = useDaemonStore((s) => s.status);
  const decisions = useEventStore((s) => s.decisions);
  const latestInscribe = useEventStore((s) =>
    (s.bySubsystem.compose ?? []).find((e) => e.phase === "inscribe" && e.status === "succeeded"),
  );
  const setCodexTab = useUIStore((s) => s.setCodexTab);
  const toggleBottomPanel = useUIStore((s) => s.toggleBottomPanel);
  const bottomPanelOpen = useUIStore((s) => s.bottomPanelOpen);

  // Fade-between transitions: when text changes, fade out, swap, fade in.
  const wayfinder = useMemo<Wayfinder>(() => {
    if (!snapshot) {
      return { text: "落墨之前 · 先备世界" };
    }
    if (decisions.length > 0) {
      return {
        text: `★ 一桩待裁 · 移目右栏「议事」`,
        onClick: () => setCodexTab("now"),
      };
    }
    if (status?.active) {
      const label = status.lastStageLabel ?? "推演中";
      return {
        text: `${label} · 第 ${status.completedTicks}/${status.targetTicks} 推演`,
      };
    }
    if (status?.paused) {
      return { text: `驻笔 · 第 ${status.completedTicks}/${status.targetTicks} · 待恢复` };
    }
    if (status?.completed && latestInscribe) {
      const goal = latestInscribe.summary?.split(" · ")[0] ?? "新章";
      return {
        text: `新章已落 · 《${goal}》`,
      };
    }
    if (snapshot && !status?.active) {
      return {
        text: "世界已成 · 落座等候推演",
        onClick: () => {
          if (!bottomPanelOpen) toggleBottomPanel();
        },
      };
    }
    return { text: "案头清静" };
  }, [snapshot, status, decisions.length, latestInscribe, setCodexTab, toggleBottomPanel, bottomPanelOpen]);

  // Fade animation via a key change on the inner span.
  const [renderKey, setRenderKey] = useState(0);
  useEffect(() => {
    setRenderKey((k) => k + 1);
  }, [wayfinder.text]);

  const interactive = Boolean(wayfinder.onClick);

  return (
    <div className="wayfinder">
      <span
        key={renderKey}
        className={`wayfinder__phrase${interactive ? " wayfinder__phrase--interactive" : ""}`}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={wayfinder.onClick}
        onKeyDown={(e) => {
          if (interactive && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            wayfinder.onClick?.();
          }
        }}
      >
        {wayfinder.text}
      </span>
    </div>
  );
}
