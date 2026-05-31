import { useEffect, useMemo, useState } from "react";

import { useDaemonStore } from "../../stores/useDaemonStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { useUIStore } from "../../stores/useUIStore";
import { sampleWorld } from "../../sampleWorld";
import { api } from "../../lib/api";

type Command = {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  // P1-A · Small caps label (e.g. "捷径") to mark power-user shortcuts that
  // duplicate primary surfaces (e.g. BottomPanel daemon-start form).
  tag?: string;
  run: () => Promise<void> | void;
};

export function CommandPalette() {
  const open = useUIStore((s) => s.showCommandPalette);
  const close = useUIStore((s) => s.toggleCommandPalette);
  const setMode = useUIStore((s) => s.setMode);
  const setCodexTab = useUIStore((s) => s.setCodexTab);
  const toggleSettings = useUIStore((s) => s.toggleSettings);
  const worldId = useSessionStore((s) => s.worldId);
  const refresh = useSessionStore((s) => s.refresh);
  const start = useDaemonStore((s) => s.start);
  const pause = useDaemonStore((s) => s.pause);

  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  // P2-D · Incrementing this changes the empty-state element key, re-mounting
  // it and re-firing the shake keyframe. Used when Enter pressed with no match.
  const [shakeNonce, setShakeNonce] = useState(0);

  const commands: Command[] = useMemo(() => [
    {
      id: "load-sample",
      label: "加载示例世界",
      hint: "POST /api/world/apply-draft",
      tag: "捷径",
      run: async () => {
        await api.applyWorldDraft({ worldId, markdown: sampleWorld });
        await refresh();
      },
    },
    {
      id: "daemon-start-5",
      label: "启动 daemon · 5 步 · composeEvery=3",
      tag: "捷径",
      run: () => start({ targetTicks: 5, composeEvery: 3 }),
    },
    {
      id: "daemon-start-1",
      label: "启动 daemon · 1 步（不 compose）",
      tag: "捷径",
      run: () => start({ targetTicks: 1, composeEvery: 99 }),
    },
    {
      id: "daemon-pause",
      label: "暂停 daemon",
      tag: "捷径",
      run: () => pause(),
    },
    {
      id: "open-settings",
      label: "打开 AI 设置",
      run: () => toggleSettings(),
    },
    {
      id: "rail-memory",
      label: "切到 Codex Rail · 记忆 tab",
      run: () => {
        setMode("memory");
        setCodexTab("memory");
      },
    },
    {
      id: "rail-atlas",
      label: "切到 Codex Rail · 图谱 tab",
      run: () => {
        setMode("atlas");
        setCodexTab("atlas");
      },
    },
  ], [worldId, refresh, start, pause, toggleSettings, setMode, setCodexTab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  // Global ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        close();
      } else if (open && e.key === "Escape") {
        close();
      } else if (open && e.key === "ArrowDown") {
        setHighlight((h) => Math.min(filtered.length - 1, h + 1));
        e.preventDefault();
      } else if (open && e.key === "ArrowUp") {
        setHighlight((h) => Math.max(0, h - 1));
        e.preventDefault();
      } else if (open && e.key === "Enter") {
        const cmd = filtered[highlight];
        if (cmd && !cmd.disabled) {
          void cmd.run();
          close();
        } else if (filtered.length === 0) {
          // P2-D · Visual no-match feedback — empty state shakes briefly.
          setShakeNonce((n) => n + 1);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, highlight, close]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="command-palette__overlay" onMouseDown={close}>
      <div className="command-palette" onMouseDown={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="command-palette__input"
          value={query}
          placeholder="命令…（⌘K 关闭 · Esc 关闭）"
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
        />
        <ul className="command-palette__list">
          {filtered.length === 0 && (
            <li
              key={`empty-${shakeNonce}`}
              className={`command-palette__empty${shakeNonce > 0 ? " command-palette__empty--shake" : ""}`}
            >
              没有匹配命令
            </li>
          )}
          {filtered.map((c, i) => (
            <li
              key={c.id}
              className={`command-palette__row${i === highlight ? " active" : ""}${c.disabled ? " disabled" : ""}`}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                if (c.disabled) return;
                void c.run();
                close();
              }}
            >
              <span className="command-palette__label">{c.label}</span>
              {c.tag && <span className="command-palette__tag">[{c.tag}]</span>}
              {c.hint && <span className="command-palette__hint">{c.hint}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
