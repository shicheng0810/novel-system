import { useState } from "react";

import type { NarrativeDraft } from "@novel";

import type { WorkbenchSessionState } from "../contracts";
import type { UIState } from "../store";
import { InlineSlashMenu, type SlashCommand } from "./InlineSlashMenu";
import { LensDrawer, type LensFormState } from "./LensDrawer";

type WritingCanvasProps = {
  ui: UIState;
  setUI: (updater: (current: UIState) => UIState) => void;
  session: WorkbenchSessionState | null;
  activeDraft: NarrativeDraft | undefined;
  selectedSceneId: string;
  setSelectedSceneId: (id: string) => void;
  lensForm: LensFormState;
  setLensForm: (updater: (current: LensFormState) => LensFormState) => void;
  rewriteInstruction: string;
  setRewriteInstruction: (value: string) => void;
  pendingAction: string | null;
  onCompose: () => void;
  onCritique: () => void;
  onAssemble: () => void;
  onRewrite: () => void;
  onConfirmFinal: () => void;
  onSelectLine: (lineId: string) => void;
  onRunTick: () => void;
  onOpenCommandPalette: () => void;
};

export function WritingCanvas(props: WritingCanvasProps) {
  const {
    ui,
    setUI,
    session,
    activeDraft,
    selectedSceneId,
    setSelectedSceneId,
    lensForm,
    setLensForm,
    rewriteInstruction,
    setRewriteInstruction,
    pendingAction,
    onCompose,
    onCritique,
    onAssemble,
    onRewrite,
    onConfirmFinal,
    onSelectLine,
    onRunTick,
    onOpenCommandPalette,
  } = props;

  const selectedScene =
    activeDraft?.sceneDrafts.find((scene) => scene.sceneId === selectedSceneId) ?? activeDraft?.sceneDrafts[0];

  const wordCount = activeDraft?.chapterText.length ?? 0;
  const chapterTitle = activeDraft?.plan.chapterTitle ?? activeDraft?.plan.chapterGoal ?? "尚未生成章节";

  const [continuationText, setContinuationText] = useState("");

  const slashCommands: SlashCommand[] = [
    { id: "续写", label: "续写一段（基于当前 lens）", run: () => onCompose() },
    { id: "复核", label: "Critic 复核当前章节", run: () => onCritique() },
    { id: "重写", label: "只重写当前场景", run: () => onRewrite() },
    { id: "tick", label: "跑一个 Runtime tick", run: () => onRunTick() },
    { id: "切场景", label: "打开命令面板切场景 / 切线", run: () => onOpenCommandPalette() },
    { id: "终稿", label: "把当前场景确认为终稿", run: () => onConfirmFinal() },
  ];

  return (
    <section className={`workspace-panel writing-canvas ${ui.typewriterMode ? "typewriter" : ""}`}>
      <div className="canvas-dock">
        <strong className="canvas-dock-title">{chapterTitle}</strong>
        <span className="canvas-dock-meta">{wordCount} 字</span>
        <button onClick={onCompose} disabled={pendingAction !== null}>
          ▶ 续写 1 段
        </button>
        <span className="canvas-dock-hint">在下方输入 <code>/</code> 触发命令</span>
        <button
          className="ghost"
          onClick={() => setUI((current) => ({ ...current, lensDrawerOpen: !current.lensDrawerOpen }))}
        >
          {ui.lensDrawerOpen ? "📐 收起" : "📐 调参"}
        </button>
        <button className="ghost" onClick={onOpenCommandPalette} title="⌘K">
          ⌘K
        </button>
      </div>

      <section className="context-band">
        <div>
          <span className="context-label">当前阶段</span>
          <strong>{session?.selectedStageId ?? "尚未选择"}</strong>
        </div>
        <div>
          <span className="context-label">推荐分叉</span>
          <strong>
            {session?.simulation.latestBranchEvaluations.find((branch) => branch.recommended)?.title ?? "暂无"}
          </strong>
        </div>
        <div>
          <span className="context-label">世界压强</span>
          <strong>{activeDraft?.sourcePack.worldPressureSummary ?? "先运行推演或生成正文后可见"}</strong>
        </div>
      </section>

      <div className="section-grid writing-grid">
        <article className="studio-card compact-card">
          <div className="card-heading">
            <h2>历史线</h2>
            <span>{session?.simulation.lines.length ?? 0} 条</span>
          </div>
          <div className="line-switcher">
            {session?.simulation.lines.map((line) => (
              <button
                key={line.lineId}
                className={line.lineId === session.selectedLineId ? "active" : ""}
                onClick={() => onSelectLine(line.lineId)}
              >
                <span>{line.label}</span>
                <small>{line.kind === "canon" ? "正史" : line.recommended ? "推荐分叉" : "分叉"}</small>
              </button>
            ))}
          </div>
        </article>

        <LensDrawer
          lensForm={lensForm}
          setLensForm={setLensForm}
          session={session}
          open={ui.lensDrawerOpen}
          onToggle={() => setUI((current) => ({ ...current, lensDrawerOpen: !current.lensDrawerOpen }))}
        />
      </div>

      <div className="section-grid writing-main-grid">
        <article className="studio-card chapter-card">
          <div className="card-heading">
            <h2>{activeDraft?.plan.chapterTitle ?? activeDraft?.plan.chapterGoal ?? "尚未生成章节"}</h2>
            <span>{activeDraft ? `${activeDraft.chapterText.length} 字` : "等待生成"}</span>
          </div>
          <div className="summary-grid">
            <div>
              <span className="context-label">主冲突</span>
              <p>{activeDraft?.plan.mainConflict ?? "等待蓝图"}</p>
            </div>
            <div>
              <span className="context-label">副冲突</span>
              <p>{activeDraft?.plan.secondaryConflict ?? "等待蓝图"}</p>
            </div>
            <div>
              <span className="context-label">章末钩子</span>
              <p>{activeDraft?.plan.closingHook ?? "等待蓝图"}</p>
            </div>
          </div>

          <div className="scene-strip">
            {activeDraft?.sceneDrafts.map((scene) => (
              <button
                key={scene.sceneId}
                className={scene.sceneId === selectedSceneId ? "active" : ""}
                onClick={() => setSelectedSceneId(scene.sceneId)}
              >
                <span>{scene.title}</span>
                <small>{scene.summary}</small>
              </button>
            ))}
          </div>

          <div className="scene-reader">
            <header>
              <h3>{selectedScene?.title ?? "选择一个场景"}</h3>
              <p>{selectedScene?.summary ?? "当前还没有可用场景。"}</p>
            </header>
            <pre>{selectedScene?.text ?? "先生成章节，再在这里查看正文。"} </pre>
          </div>
          <div className="scene-reader">
            <header>
              <h3>完整章节</h3>
              <p>{activeDraft ? `${activeDraft.sceneDrafts.length} 个场景已装配` : "等待场景草稿。"}</p>
            </header>
            <pre>{activeDraft?.chapterText ?? "所有场景写完后，在这里生成完整章节正文。"} </pre>
          </div>

          <div className="continuation-zone">
            <header>
              <h3>💬 写续段</h3>
              <small>不会写入正文，只用来触发命令。Enter 执行当前匹配项。</small>
            </header>
            <InlineSlashMenu
              value={continuationText}
              onChange={setContinuationText}
              commands={slashCommands}
              placeholder="在这里草拟下一段思路…输入 / 调用命令（续写 / 复核 / 重写 / tick / 切场景 / 终稿）"
            />
          </div>
        </article>

        <article className="studio-card compact-card">
          <div className="card-heading">
            <h2>局部重写与终稿</h2>
            <span>{activeDraft?.review.passed ? "Critic 已通过" : "待复核"}</span>
          </div>
          <label className="stacked-field">
            当前指令
            <textarea
              value={rewriteInstruction}
              onChange={(event) => setRewriteInstruction(event.target.value)}
            />
          </label>
          <div className="action-stack">
            <button onClick={onAssemble} disabled={!activeDraft || pendingAction !== null}>
              生成完整章节
            </button>
            <button onClick={onRewrite} disabled={!selectedScene || pendingAction !== null}>
              只重写当前场景
            </button>
            <button className="ghost" onClick={onConfirmFinal} disabled={!selectedScene || pendingAction !== null}>
              确认当前场景为作者终稿
            </button>
          </div>
          <div className="critic-panel">
            <h3>Critic 报告</h3>
            <ul className="plain-list">
              {activeDraft?.review.issues.map((issue) => <li key={issue}>{issue}</li>)}
              {activeDraft?.review.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              {activeDraft?.review.styleNotes.map((note) => <li key={note}>{note}</li>)}
              {!activeDraft && <li>生成正文后，这里会显示一致性、节奏和语言层反馈。</li>}
            </ul>
          </div>
        </article>
      </div>
    </section>
  );
}
