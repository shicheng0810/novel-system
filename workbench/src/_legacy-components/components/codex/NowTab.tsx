import type { NarrativeDraft } from "@novel";

import type { WorkbenchSessionState } from "../../contracts";
import { WorldEchoes } from "../WorldEchoes";

type NowTabProps = {
  session: WorkbenchSessionState | null;
  activeDraft: NarrativeDraft | undefined;
};

export function NowTab({ session, activeDraft }: NowTabProps) {
  const pack = activeDraft?.sourcePack;
  const selectedLine = session?.simulation.selectedLine;

  if (!pack) {
    return (
      <div className="codex-tab-body">
        <WorldEchoes chapterId={session?.selectedLineId} />
        <div className="codex-empty">
          <p>这里会显示当前场景关联的：</p>
          <ul className="plain-list">
            <li>· 焦点角色卡片</li>
            <li>· 关系状态</li>
            <li>· 当前阶段的奇门 / 八字小卡</li>
            <li>· 硬事实与禁止动作</li>
          </ul>
          <p className="codex-empty-cta">先在 Writing 区生成一次章节，Codex 自动跟着浮起。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="codex-tab-body">
      <WorldEchoes chapterId={session?.selectedLineId} />
      <section className="codex-card">
        <header>
          <strong>线 · {selectedLine?.label ?? pack.lineLabel}</strong>
          <small>{selectedLine?.kind === "canon" ? "正史" : "分叉"}</small>
        </header>
        <p className="codex-summary">{pack.worldPressureSummary}</p>
      </section>

      <section className="codex-card">
        <header>
          <strong>角色</strong>
          <small>{pack.characterSummaries.length}</small>
        </header>
        <ul className="plain-list">
          {pack.characterSummaries.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="codex-card">
        <header>
          <strong>关系</strong>
          <small>{pack.relationshipSummaries.length}</small>
        </header>
        <ul className="plain-list">
          {pack.relationshipSummaries.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="codex-card">
        <header>
          <strong>奇门 / 宫位</strong>
        </header>
        <p className="codex-summary">{pack.palaceSummary}</p>
        {pack.qimenContext?.pattern && (
          <p className="codex-meta">
            局 {pack.qimenContext.pattern} · {pack.qimenContext.locationFocus ?? "—"}
          </p>
        )}
      </section>

      <section className="codex-card">
        <header>
          <strong>硬事实</strong>
        </header>
        <ul className="plain-list">
          {pack.hardFacts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </section>

      <section className="codex-card">
        <header>
          <strong>禁止动作</strong>
        </header>
        <ul className="plain-list">
          {pack.forbiddenMoves.map((move) => (
            <li key={move}>{move}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
