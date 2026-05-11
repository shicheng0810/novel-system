import type { WorkbenchSessionState, WorldDraftPreview } from "../../contracts";

type WorldTabProps = {
  session: WorkbenchSessionState | null;
  draftEditorText: string;
  draftPreview: WorldDraftPreview | null;
  isDraftApplied: boolean;
  pendingAction: string | null;
  onLoadSample: () => void;
  onResetWorld: () => void;
  onPreviewWorld: () => void;
  onApplyWorld: () => void;
  onDraftEditorChange: (value: string) => void;
};

export function WorldTab(props: WorldTabProps) {
  const {
    session,
    draftEditorText,
    draftPreview,
    isDraftApplied,
    pendingAction: _pendingAction,
    onLoadSample,
    onResetWorld,
    onPreviewWorld,
    onApplyWorld,
    onDraftEditorChange,
  } = props;
  const preview = draftPreview ?? session?.worldPreview;

  return (
    <div className="codex-tab-body">
      <section className="codex-card">
        <header>
          <strong>世界草案</strong>
          <small>{isDraftApplied ? "已应用" : "未应用"}</small>
        </header>
        <div className="action-stack">
          <button className="ghost" onClick={onLoadSample}>
            加载示例
          </button>
          <button className="ghost" onClick={onResetWorld}>
            重置编辑区
          </button>
          <button className="ghost" onClick={onPreviewWorld}>
            预览解析
          </button>
          <button onClick={onApplyWorld}>应用到当前会话</button>
        </div>
        <textarea
          className="world-editor codex-textarea"
          value={draftEditorText}
          onChange={(event) => onDraftEditorChange(event.target.value)}
        />
      </section>

      {!preview?.ok && (
        <section className="codex-card">
          <p className="error-copy">{preview?.error ?? "当前还没有可用预览。"}</p>
        </section>
      )}

      {preview?.ok && (
        <>
          <section className="codex-card">
            <header>
              <strong>世界</strong>
              <small>{preview.worldSpec?.genre ?? ""}</small>
            </header>
            <p className="codex-summary">{preview.worldSpec?.cultivationSystem}</p>
            <ul className="plain-list">
              {preview.worldSpec?.worldRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </section>

          <section className="codex-card">
            <header>
              <strong>角色</strong>
              <small>{preview.counts.characters}</small>
            </header>
            <ul className="plain-list">
              {preview.characters.map((character) => (
                <li key={character.id}>
                  <strong>{character.name}</strong>
                  <span> {character.faction} · {character.role}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="codex-card">
            <header>
              <strong>关系</strong>
              <small>{preview.counts.relationships}</small>
            </header>
            <ul className="plain-list">
              {preview.relationships.map((relationship) => (
                <li key={relationship.id}>
                  <strong>{relationship.left} / {relationship.right}</strong>
                  <span> {relationship.status}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="codex-card">
            <header>
              <strong>锚点</strong>
            </header>
            <ul className="plain-list">
              {preview.characterAnchors.map((anchor) => (
                <li key={anchor.characterId}>
                  <strong>{anchor.characterId}</strong>
                  <span> {anchor.stageGoal}</span>
                </li>
              ))}
              {preview.relationshipAnchors.map((anchor) => (
                <li key={anchor.relationshipId}>
                  <strong>{anchor.relationshipId}</strong>
                  <span> {anchor.trend}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
