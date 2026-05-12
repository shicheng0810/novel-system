import type { AtlasFilePayload, AtlasTreeNode, WorkbenchSessionState } from "../../contracts";

type AtlasTabProps = {
  session: WorkbenchSessionState | null;
  atlasTree: AtlasTreeNode[];
  atlasFile: AtlasFilePayload | null;
  pendingAction: string | null;
  onCompile: () => void;
  onOpenFile: (path: string) => void;
};

export function AtlasTab({ session, atlasTree, atlasFile, pendingAction, onCompile, onOpenFile }: AtlasTabProps) {
  if (atlasTree.length === 0) {
    return (
      <div className="codex-tab-body">
        <div className="codex-empty">
          <p>这里会显示当前历史线的 Atlas 镜像（角色 / 地点 / 派系 / 设定）。</p>
          <button onClick={onCompile} disabled={pendingAction !== null} className="codex-empty-cta">
            编译当前线 Atlas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="codex-tab-body atlas-tab">
      <div className="codex-tab-toolbar">
        <button onClick={onCompile} disabled={pendingAction !== null}>
          编译 Atlas
        </button>
        <span className="codex-meta">{session?.atlasUpdatedFiles.length ?? 0} 最近更新</span>
      </div>
      <section className="codex-card">
        <header>
          <strong>文件树</strong>
          <small>{atlasTree.length}</small>
        </header>
        <ul className="plain-list atlas-tree">
          {atlasTree.map((node) => (
            <li key={node.path}>
              {node.kind === "file" ? (
                <button
                  className={atlasFile?.path === node.path ? "active" : ""}
                  onClick={() => onOpenFile(node.path)}
                >
                  {node.path}
                </button>
              ) : (
                <span>{node.path}</span>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="codex-card">
        <header>
          <strong>{atlasFile?.path ?? "Markdown 预览"}</strong>
        </header>
        <pre className="atlas-preview codex-pre">
          {atlasFile?.content ?? "先编译或选择一个 Atlas 文件。"}
        </pre>
      </section>
    </div>
  );
}
