import { useEffect, useMemo, useRef, useState } from "react";

import { api } from "../../lib/api";
import { useSessionStore } from "../../stores/useSessionStore";
import { useUIStore } from "../../stores/useUIStore";

import { WorldEchoes } from "../world-echoes/WorldEchoes";
import { DecisionInbox } from "../decision-inbox/DecisionInbox";

// P1-C · MemoryTab response shape. Loose typing in api.ts:107 returns unknown;
// we anchor a strong contract here so component code stays sound.
type MemoryHit = {
  entry: { id: string; body?: string; kind: string };
  scores: { total: number };
};

// P1-D · Server returns a flat list of atlas nodes; we group by parent path.
type AtlasNode = { path: string; kind: string };

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
  const [hits, setHits] = useState<MemoryHit[]>([]);
  const [loading, setLoading] = useState(false);
  // P1-C · Capped pagination: 20 → 40 → 80 → 100.
  const [limit, setLimit] = useState(20);
  // P1-C · Request-id guard against rapid-typing stale-response overwrites.
  const requestIdRef = useRef(0);

  // P1-C · 300ms debounce live-search. Replaces explicit search button.
  useEffect(() => {
    const q = query.trim();
    if (q.length === 0) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = window.setTimeout(async () => {
      const myId = ++requestIdRef.current;
      try {
        const result = (await api.recallMemory({ worldId, lineId, query: q, limit })) as MemoryHit[];
        // Skip stale responses — only the most recent fetch updates state.
        if (myId !== requestIdRef.current) return;
        setHits(result);
      } finally {
        if (myId === requestIdRef.current) setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, worldId, lineId, limit]);

  const canPaginate = !loading && hits.length > 0 && hits.length === limit && limit < 100;
  const hasQuery = query.trim().length > 0;

  return (
    <div className="codex-memory">
      <div className="codex-memory__bar">
        <input
          autoFocus
          value={query}
          placeholder="搜记忆…（关键字 / 角色名）"
          onChange={(e) => {
            setQuery(e.target.value);
            // Reset pagination on new query so 更多 chain doesn't carry over.
            if (limit !== 20) setLimit(20);
          }}
        />
      </div>
      {hasQuery && !loading && (
        <div className="codex-memory__count muted">命中 {hits.length} 条</div>
      )}
      {loading && <MemorySkeleton />}
      {!loading && hasQuery && hits.length === 0 && <div className="codex-empty">没有命中</div>}
      {!hasQuery && <div className="codex-empty">输入关键字开始搜索</div>}
      <ul>
        {hits.map((h) => (
          <li key={h.entry.id}>
            <div className="codex-memory__head">
              <span className="codex-memory__kind">{h.entry.kind}</span> · 总分 {h.scores.total.toFixed(2)}
            </div>
            <div className="codex-memory__body">{h.entry.body ?? "(无文本)"}</div>
          </li>
        ))}
      </ul>
      {canPaginate && (
        <button
          type="button"
          className="ghost codex-memory__more"
          onClick={() => setLimit((l) => Math.min(l * 2, 100))}
        >
          更多 · {Math.min(limit * 2, 100)} 条
        </button>
      )}
    </div>
  );
}

function AtlasTab() {
  const worldId = useSessionStore((s) => s.worldId);
  const lineId = useSessionStore((s) => s.lineId);
  const [tree, setTree] = useState<AtlasNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [body, setBody] = useState<string>("");
  // P1-D · Selected file and expanded folders persist across tab switches.
  const selected = useUIStore((s) => s.atlasSelected);
  const setSelected = useUIStore((s) => s.setAtlasSelected);
  const expanded = useUIStore((s) => s.atlasExpanded);
  const toggleExpanded = useUIStore((s) => s.toggleAtlasExpanded);
  // P1-D · Race guard for atlas/file fetches.
  const fileRequestRef = useRef(0);

  useEffect(() => {
    setTreeLoading(true);
    void api.atlasTree(worldId, lineId).then((res) => {
      setTree(res.tree);
      setTreeLoading(false);
    });
  }, [worldId, lineId]);

  useEffect(() => {
    if (!selected) {
      setBody("");
      return;
    }
    const myId = ++fileRequestRef.current;
    void api.atlasFile(worldId, lineId, selected).then((f) => {
      if (myId !== fileRequestRef.current) return; // stale response — discard
      setBody(f?.body ?? "");
    });
  }, [worldId, lineId, selected]);

  // P1-D · Build parent→children index from flat path list.
  // Path "characters/林焰.md" → parent "characters", child "林焰.md".
  // Root nodes have parent "".
  const { childrenByParent, rootNodes } = useMemo(() => {
    const map = new Map<string, AtlasNode[]>();
    for (const node of tree) {
      const idx = node.path.lastIndexOf("/");
      const parent = idx >= 0 ? node.path.slice(0, idx) : "";
      const bucket = map.get(parent) ?? [];
      bucket.push(node);
      map.set(parent, bucket);
    }
    // Stable order: folders first, then files, alphabetically within each kind.
    const isDir = (k: string) => k === "directory" || k === "folder";
    for (const bucket of map.values()) {
      bucket.sort((a, b) => {
        const aDir = isDir(a.kind);
        const bDir = isDir(b.kind);
        if (aDir !== bDir) return aDir ? -1 : 1;
        return a.path.localeCompare(b.path);
      });
    }
    return { childrenByParent: map, rootNodes: map.get("") ?? [] };
  }, [tree]);

  if (treeLoading && tree.length === 0) {
    return <AtlasSkeleton />;
  }
  if (tree.length === 0) {
    return <div className="codex-empty">未加载世界 · 图谱尚未编译</div>;
  }

  function renderNode(node: AtlasNode, depth: number) {
    // Server returns kind === "directory" (not "folder"); accept either for safety.
    const isFolder = node.kind === "directory" || node.kind === "folder";
    const isOpen = expanded[node.path] === true;
    const isActive = !isFolder && selected === node.path;
    const label = labelOf(node.path);
    const children = childrenByParent.get(node.path) ?? [];
    const kindClass = isFolder ? "folder" : "file";
    return (
      <li key={node.path} className="codex-atlas__node-wrapper">
        <div
          className={`codex-atlas__node codex-atlas__node--${kindClass}${isActive ? " active" : ""}`}
          style={{ paddingLeft: depth * 14 + 8 }}
          onClick={() => {
            if (isFolder) toggleExpanded(node.path);
            else setSelected(node.path);
          }}
        >
          {isFolder && <span className="codex-atlas__disclosure">{isOpen ? "▾" : "▸"}</span>}
          <span className="codex-atlas__name">{label}</span>
        </div>
        {isFolder && isOpen && children.length > 0 && (
          <ul className="codex-atlas__children">
            {children.map((c) => renderNode(c, depth + 1))}
          </ul>
        )}
      </li>
    );
  }

  const breadcrumb = selected ? selected.split("/") : null;

  return (
    <div className="codex-atlas">
      <ul className="codex-atlas__tree">
        {rootNodes.map((n) => renderNode(n, 0))}
      </ul>
      {selected && (
        <div className="codex-atlas__detail">
          {breadcrumb && (
            <nav className="codex-atlas__breadcrumb">
              {breadcrumb.map((seg, i) => (
                <span key={i} className="codex-atlas__crumb">
                  {i > 0 && <span className="codex-atlas__crumb-sep"> › </span>}
                  {seg}
                </span>
              ))}
            </nav>
          )}
          <pre className="codex-atlas__file">{body}</pre>
        </div>
      )}
    </div>
  );
}

// P1-D · Strip the parent path so each leaf shows just the local segment.
function labelOf(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(idx + 1) : path;
}

// P2-C · Soft pulsing skeleton rows; matches lamp-track breathing motion.
function AtlasSkeleton() {
  return (
    <div className="codex-skeleton" aria-hidden>
      <div className="codex-skeleton__row" />
      <div className="codex-skeleton__row codex-skeleton__row--indent" />
      <div className="codex-skeleton__row codex-skeleton__row--indent" />
      <div className="codex-skeleton__row" />
      <div className="codex-skeleton__row codex-skeleton__row--indent" />
    </div>
  );
}

// P2-C · MemoryTab skeleton — two-line cards mimic memory hit shape.
function MemorySkeleton() {
  return (
    <div className="codex-skeleton" aria-hidden>
      <div className="codex-skeleton__row codex-skeleton__row--short" />
      <div className="codex-skeleton__row" />
      <div className="codex-skeleton__row codex-skeleton__row--short" />
      <div className="codex-skeleton__row" />
    </div>
  );
}
