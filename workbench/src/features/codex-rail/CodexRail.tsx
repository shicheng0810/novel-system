import { useEffect, useState } from "react";

import { api } from "../../lib/api";
import { useSessionStore } from "../../stores/useSessionStore";
import { useUIStore } from "../../stores/useUIStore";

import { WorldEchoes } from "../world-echoes/WorldEchoes";
import { DecisionInbox } from "../decision-inbox/DecisionInbox";

const TABS = [
  { id: "now", label: "Now" },
  { id: "world", label: "世界" },
  { id: "memory", label: "记忆" },
  { id: "atlas", label: "图谱" },
] as const;

export function CodexRail() {
  const tab = useUIStore((s) => s.codexRailTab);
  const setTab = useUIStore((s) => s.setCodexTab);

  return (
    <aside className="codex-rail">
      <nav className="codex-rail__tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`ghost codex-rail__tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="codex-rail__body">
        {tab === "now" && <NowTab />}
        {tab === "world" && <WorldTab />}
        {tab === "memory" && <MemoryTab />}
        {tab === "atlas" && <AtlasTab />}
      </div>
    </aside>
  );
}

function NowTab() {
  return (
    <>
      <WorldEchoes />
      <DecisionInbox />
    </>
  );
}

function WorldTab() {
  const parsed = useSessionStore((s) => s.parsed);
  const snapshot = useSessionStore((s) => s.snapshot);
  if (!parsed) return <div className="codex-empty">未加载世界 · 点 ▶ 加载示例世界开始</div>;
  return (
    <div className="codex-world">
      <h4>角色 · {parsed.characters.length}</h4>
      <ul>
        {parsed.characters.map((c) => {
          const st = snapshot?.characters?.[c.id];
          return (
            <li key={c.id}>
              <strong>{c.name}</strong> <span className="muted">{c.faction} · {c.role}</span>
              {st && (
                <div className="codex-world__stats">
                  压力 {st.pressure} · 进度 {st.progress} · 上次：{st.lastAction}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <h4>关系 · {parsed.relationships.length}</h4>
      <ul>
        {parsed.relationships.map((r) => (
          <li key={r.id}>
            {r.left} ↔ {r.right} <span className="muted">· {r.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MemoryTab() {
  const worldId = useSessionStore((s) => s.worldId);
  const lineId = useSessionStore((s) => s.lineId);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Array<{ entry: { id: string; body?: string; kind: string }; scores: { total: number } }>>([]);
  const [loading, setLoading] = useState(false);

  async function runQuery(q: string) {
    setLoading(true);
    try {
      const result = (await api.recallMemory({ worldId, lineId, query: q, limit: 20 })) as Array<{
        entry: { id: string; body?: string; kind: string };
        scores: { total: number };
      }>;
      setHits(result);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="codex-memory">
      <div className="codex-memory__bar">
        <input
          value={query}
          placeholder="搜记忆…（关键字 / 角色名）"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void runQuery(query);
          }}
        />
        <button type="button" className="ghost" onClick={() => void runQuery(query)} disabled={loading}>
          搜索
        </button>
      </div>
      {loading && <div className="codex-empty">查询中…</div>}
      {!loading && hits.length === 0 && <div className="codex-empty">没有命中</div>}
      <ul>
        {hits.map((h) => (
          <li key={h.entry.id}>
            <div className="codex-memory__head">
              <span className="muted">[{h.entry.kind}]</span> · 总分 {h.scores.total.toFixed(2)}
            </div>
            <div className="codex-memory__body">{h.entry.body ?? "(无文本)"}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AtlasTab() {
  const worldId = useSessionStore((s) => s.worldId);
  const lineId = useSessionStore((s) => s.lineId);
  const [tree, setTree] = useState<Array<{ path: string; kind: string }>>([]);
  const [selected, setSelected] = useState<string | undefined>();
  const [body, setBody] = useState<string>("");

  useEffect(() => {
    void api.atlasTree(worldId, lineId).then((res) => setTree(res.tree));
  }, [worldId, lineId]);

  useEffect(() => {
    if (!selected) {
      setBody("");
      return;
    }
    void api.atlasFile(worldId, lineId, selected).then((f) => setBody(f?.body ?? ""));
  }, [worldId, lineId, selected]);

  if (tree.length === 0) {
    return <div className="codex-empty">未加载世界 · 图谱尚未编译</div>;
  }

  return (
    <div className="codex-atlas">
      <ul className="codex-atlas__tree">
        {tree.map((n) => (
          <li
            key={n.path}
            className={`codex-atlas__node codex-atlas__node--${n.kind}${selected === n.path ? " active" : ""}`}
            onClick={() => n.kind === "file" && setSelected(n.path)}
          >
            {n.path}
          </li>
        ))}
      </ul>
      {selected && (
        <pre className="codex-atlas__file">{body}</pre>
      )}
    </div>
  );
}
