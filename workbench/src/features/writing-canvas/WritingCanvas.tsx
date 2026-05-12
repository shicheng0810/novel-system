import { useState } from "react";

import { useSessionStore } from "../../stores/useSessionStore";
import { useDaemonStore } from "../../stores/useDaemonStore";
import { useEventStore } from "../../stores/useEventStore";

export function WritingCanvas() {
  const draftText = useSessionStore((s) => s.draftText);
  const setDraftText = useSessionStore((s) => s.setDraftText);
  const snapshot = useSessionStore((s) => s.snapshot);
  const start = useDaemonStore((s) => s.start);
  const daemonBusy = useDaemonStore((s) => s.busy);
  const composeEvents = useEventStore((s) => s.bySubsystem.compose ?? []);

  const [targetTicks, setTargetTicks] = useState(3);

  const currentComposePhase = composeEvents[0]?.phase ?? "—";

  return (
    <main className="writing-canvas">
      <section className="canvas-dock">
        <div className="canvas-dock__left">
          <span className="dock-title">prose canvas</span>
          <span className="dock-stage">
            stage #{snapshot?.stageNumber ?? 0}
          </span>
        </div>
        <div className="canvas-dock__right">
          <span className="dock-phase">最近 compose 阶段：{currentComposePhase}</span>
        </div>
      </section>

      <textarea
        className="canvas-editor"
        value={draftText}
        onChange={(e) => setDraftText(e.target.value)}
        placeholder="续写区。输入 / 弹 inline 菜单（待 Phase 6.5 实装）。"
      />

      <section className="canvas-controls">
        <label>
          推演步数：
          <input
            type="number"
            min={1}
            max={50}
            value={targetTicks}
            onChange={(e) => setTargetTicks(Math.max(1, Number(e.target.value)))}
          />
        </label>
        <button
          type="button"
          disabled={daemonBusy}
          onClick={() => void start({ targetTicks })}
        >
          {daemonBusy ? "启动中…" : "▶ 启动 daemon"}
        </button>
      </section>
    </main>
  );
}
