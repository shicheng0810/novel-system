import { useState } from "react";

import { useSessionStore } from "../../stores/useSessionStore";
import { ChapterView } from "../chapter-view/ChapterView";
import { SixStageProgress } from "../six-stage-progress/SixStageProgress";

type Tab = "chapters" | "draft";

export function WritingCanvas() {
  const draftText = useSessionStore((s) => s.draftText);
  const setDraftText = useSessionStore((s) => s.setDraftText);
  const snapshot = useSessionStore((s) => s.snapshot);

  const [tab, setTab] = useState<Tab>("chapters");

  return (
    <main className="writing-canvas">
      <section className="canvas-dock">
        <div className="canvas-dock__left">
          <span className="dock-title">prose canvas</span>
          <span className="dock-stage">stage #{snapshot?.stageNumber ?? 0}</span>
        </div>
        <div className="canvas-dock__right">
          <button
            type="button"
            className={`ghost canvas-tab${tab === "chapters" ? " active" : ""}`}
            onClick={() => setTab("chapters")}
          >
            已成章节
          </button>
          <button
            type="button"
            className={`ghost canvas-tab${tab === "draft" ? " active" : ""}`}
            onClick={() => setTab("draft")}
          >
            续段稿
          </button>
        </div>
      </section>

      <SixStageProgress />

      {tab === "chapters" ? (
        <ChapterView />
      ) : (
        <textarea
          className="canvas-editor"
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="续写区。输入 / 弹 inline 菜单。"
        />
      )}
    </main>
  );
}
