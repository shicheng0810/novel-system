import { useMemo, useState } from "react";

import { useDaemonStore } from "../../stores/useDaemonStore";
import { useEventStore } from "../../stores/useEventStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { useUIStore } from "../../stores/useUIStore";

export function BottomPanel() {
  const open = useUIStore((s) => s.bottomPanelOpen);
  const toggle = useUIStore((s) => s.toggleBottomPanel);
  const status = useDaemonStore((s) => s.status);
  const decisions = useEventStore((s) => s.decisions);
  const focusIds = useUIStore((s) => s.focusIds);
  const parsed = useSessionStore((s) => s.parsed);

  const summary = status?.active
    ? `▶ 推演 · ${status.completedTicks}/${status.targetTicks}`
    : status?.paused
      ? `⏸ 推演 · ${status.completedTicks}/${status.targetTicks}`
      : status?.completed
        ? `✓ 推演 · ${status.completedTicks}/${status.targetTicks}`
        : "▢ 推演 · 0/0";

  // Show a soft focus preview in the collapsed bar so users see their selection survives.
  const focusPreview = !open && focusIds.length > 0
    ? focusIds
        .map((id) => parsed?.characters?.find((c) => c.id === id)?.name ?? id)
        .join("·")
    : null;

  return (
    <section className={`bottom-panel${open ? " bottom-panel--open" : ""}`}>
      <div className="bottom-panel__bar" onClick={toggle} role="button">
        <span>{summary}</span>
        <span className="muted">· ★ {decisions.length} 决策</span>
        {focusPreview && <span className="bottom-panel__focus-preview muted">· 焦点 {focusPreview}</span>}
        <span className="bottom-panel__chevron">{open ? "▾" : "▴"}</span>
      </div>
      {open && (
        <div className="bottom-panel__body">
          <SimControls />
          <TickLog />
        </div>
      )}
    </section>
  );
}

function SimControls() {
  const parsed = useSessionStore((s) => s.parsed);
  const start = useDaemonStore((s) => s.start);
  const pause = useDaemonStore((s) => s.pause);
  const resume = useDaemonStore((s) => s.resume);
  const status = useDaemonStore((s) => s.status);
  const busy = useDaemonStore((s) => s.busy);
  // focusIds persisted to useUIStore — survives panel close/tab switch.
  const focusIds = useUIStore((s) => s.focusIds);
  const toggleFocus = useUIStore((s) => s.toggleFocusId);

  const [targetTicks, setTargetTicks] = useState(5);
  const [composeEvery, setComposeEvery] = useState(3);
  const [chapterGoal, setChapterGoal] = useState("推进核心冲突");
  const [sceneCount, setSceneCount] = useState(4);

  // P1-B · Preset chips fill the numeric inputs without auto-submitting.
  // Click → user verifies values → presses ▶ 启动 separately.
  function applyPreset(t: number, c: number, s: number) {
    setTargetTicks(t);
    setComposeEvery(c);
    setSceneCount(s);
  }

  return (
    <div className="sim-controls">
      <div className="sim-controls__row sim-controls__row--presets">
        <span className="muted">快启：</span>
        <button
          type="button"
          className="ghost sim-controls__preset"
          onClick={() => applyPreset(5, 3, 4)}
        >
          5 步 · 每 3 出章
        </button>
        <button
          type="button"
          className="ghost sim-controls__preset"
          onClick={() => applyPreset(1, 99, 4)}
        >
          1 步 · 不出章
        </button>
        <button
          type="button"
          className="ghost sim-controls__preset"
          onClick={() => applyPreset(10, 3, 4)}
        >
          10 步 · 长跑
        </button>
      </div>
      <div className="sim-controls__row">
        <label>步数<input type="number" min={1} max={50} value={targetTicks} onChange={(e) => setTargetTicks(Math.max(1, Number(e.target.value)))} /></label>
        <label>composeEvery<input type="number" min={1} max={20} value={composeEvery} onChange={(e) => setComposeEvery(Math.max(1, Number(e.target.value)))} /></label>
        <label>scenes<input type="number" min={2} max={8} value={sceneCount} onChange={(e) => setSceneCount(Math.max(2, Number(e.target.value)))} /></label>
      </div>
      <div className="sim-controls__row">
        <label className="sim-controls__goal">章节目标<input value={chapterGoal} onChange={(e) => setChapterGoal(e.target.value)} /></label>
      </div>
      <div className="sim-controls__row">
        <span className="muted">焦点：</span>
        {(parsed?.characters ?? []).map((c) => (
          <button
            key={c.id}
            type="button"
            className={`ghost sim-controls__focus${focusIds.includes(c.id) ? " active" : ""}`}
            onClick={() => toggleFocus(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="sim-controls__actions">
        <button
          type="button"
          disabled={busy || status?.active || !parsed}
          onClick={() => {
            const fallbackFocus = (parsed?.characters ?? []).slice(0, 2).map((c) => c.id);
            const effectiveFocus = focusIds.length ? focusIds : fallbackFocus;
            void start({
              targetTicks,
              composeEvery,
              composeLens: effectiveFocus.length
                ? { focusCharacterIds: effectiveFocus, chapterGoal, sceneCount }
                : undefined,
            });
          }}
        >
          ▶ 启动
        </button>
        <button type="button" className="ghost" onClick={() => void pause()} disabled={!status?.active}>⏸ 暂停</button>
        <button type="button" className="ghost" onClick={() => void resume()} disabled={!status?.paused}>↻ 恢复</button>
      </div>
    </div>
  );
}

function TickLog() {
  const events = useEventStore((s) => s.bySubsystem.runtime ?? []);
  const composeEvents = useEventStore((s) => s.bySubsystem.compose ?? []);
  const merged = useMemo(() => {
    return [...events, ...composeEvents].sort((a, b) => b.ts - a.ts).slice(0, 40);
  }, [events, composeEvents]);

  return (
    <ul className="tick-log">
      {merged.map((event) => (
        <li key={event.id} className={`tick-log__row tick-log__row--${event.status}`}>
          <span className="muted">{new Date(event.ts).toLocaleTimeString("zh-CN", { hour12: false })}</span>
          <span className="tick-log__verb">{event.verb}</span>
          <span className="tick-log__summary">{event.summary}</span>
        </li>
      ))}
    </ul>
  );
}
