import type { MemoryPanelPayload } from "../../contracts";

export type MemorySelection =
  | { kind: "fact"; id: string }
  | { kind: "expression"; id: string }
  | { kind: "foreshadow"; id: string }
  | { kind: "revision"; id: string };

type MemoryTabProps = {
  memory: MemoryPanelPayload | null;
  selectedMemory: MemorySelection | null;
  setSelectedMemory: (selection: MemorySelection | null) => void;
  memoryDetail: unknown;
  onRefresh: () => void;
};

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function MemoryTab({ memory, selectedMemory, setSelectedMemory, memoryDetail, onRefresh }: MemoryTabProps) {
  if (!memory) {
    return (
      <div className="codex-tab-body">
        <div className="codex-empty">
          <p>这里会显示当前历史线的：</p>
          <ul className="plain-list">
            <li>· 事实（CanonGate 通过的硬记录）</li>
            <li>· 表达（确认终稿后写入）</li>
            <li>· 伏笔（待回收）</li>
            <li>· 修订（作者干预记录）</li>
          </ul>
          <button className="ghost codex-empty-cta" onClick={onRefresh}>
            加载记忆
          </button>
        </div>
      </div>
    );
  }

  function renderList<T extends { id: string; summary: string }>(
    title: string,
    entries: T[],
    kind: MemorySelection["kind"],
  ) {
    return (
      <section className="codex-card">
        <header>
          <strong>{title}</strong>
          <small>{entries.length}</small>
        </header>
        <ul className="memory-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                className={selectedMemory?.kind === kind && selectedMemory.id === entry.id ? "active" : ""}
                onClick={() => setSelectedMemory({ kind, id: entry.id } as MemorySelection)}
              >
                {entry.summary}
              </button>
            </li>
          ))}
          {entries.length === 0 && <li className="empty-state">空</li>}
        </ul>
      </section>
    );
  }

  return (
    <div className="codex-tab-body">
      <div className="codex-tab-toolbar">
        <button className="ghost" onClick={onRefresh}>
          刷新记忆
        </button>
      </div>
      {renderList("事实", memory.factEntries, "fact")}
      {renderList("表达", memory.expressionEntries, "expression")}
      {renderList("伏笔", memory.foreshadowEntries, "foreshadow")}
      {renderList("修订", memory.revisionEntries, "revision")}
      <section className="codex-card">
        <header>
          <strong>详情</strong>
        </header>
        <pre className="codex-pre">
          {memoryDetail ? formatJson(memoryDetail) : "选择一条记忆条目后，这里会显示完整溯源。"}
        </pre>
      </section>
    </div>
  );
}
