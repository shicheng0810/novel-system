import { useEffect, useMemo, useRef, useState } from "react";

import type { WorkbenchSessionState } from "../contracts";

export type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
};

type CommandPaletteProps = {
  session: WorkbenchSessionState | null;
  onClose: () => void;
  extraCommands?: CommandItem[];
  // Common actions wired by App
  onCompose: () => void;
  onRunStage: () => void;
  onRunTick: () => void;
  onSelectLine: (lineId: string) => void;
  onSelectScene: (sceneId: string) => void;
  onSetCodexTab: (tab: "now" | "world" | "memory" | "atlas") => void;
  onToggleBottomPanel: () => void;
};

export function CommandPalette(props: CommandPaletteProps) {
  const {
    session,
    onClose,
    extraCommands = [],
    onCompose,
    onRunStage,
    onRunTick,
    onSelectLine,
    onSelectScene,
    onSetCodexTab,
    onToggleBottomPanel,
  } = props;
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [
      { id: "compose", label: "▶ 生成章节", hint: "Writing · compose", run: () => { onCompose(); onClose(); } },
      { id: "tick", label: "▶ 跑 1 个 tick", hint: "Runtime · manual tick", run: () => { onRunTick(); onClose(); } },
      { id: "run-stage", label: "▶ 推一个新阶段", hint: "Simulation", run: () => { onRunStage(); onClose(); } },
      { id: "bottom", label: "折叠 / 展开底部面板", run: () => { onToggleBottomPanel(); onClose(); } },
      { id: "codex-now", label: "Codex → 当前", run: () => { onSetCodexTab("now"); onClose(); } },
      { id: "codex-world", label: "Codex → 世界", run: () => { onSetCodexTab("world"); onClose(); } },
      { id: "codex-memory", label: "Codex → 记忆", run: () => { onSetCodexTab("memory"); onClose(); } },
      { id: "codex-atlas", label: "Codex → 图谱", run: () => { onSetCodexTab("atlas"); onClose(); } },
    ];

    session?.simulation.lines.forEach((line) => {
      list.push({
        id: `line:${line.lineId}`,
        label: `切到历史线 · ${line.label}`,
        hint: line.kind === "canon" ? "正史" : "分叉",
        run: () => { onSelectLine(line.lineId); onClose(); },
      });
    });

    session?.currentDraft?.sceneDrafts.forEach((scene) => {
      list.push({
        id: `scene:${scene.sceneId}`,
        label: `跳到场景 · ${scene.title}`,
        hint: scene.summary,
        run: () => { onSelectScene(scene.sceneId); onClose(); },
      });
    });

    return list.concat(extraCommands);
  }, [session, extraCommands, onCompose, onRunStage, onRunTick, onSelectLine, onSelectScene, onSetCodexTab, onToggleBottomPanel, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 12);
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q)).slice(0, 20);
  }, [commands, query]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
    if (event.key === "Enter" && filtered[0]) {
      event.preventDefault();
      filtered[0].run();
    }
  }

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <input
          ref={inputRef}
          type="text"
          placeholder="输入命令、场景标题、历史线名…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ul className="command-list">
          {filtered.map((item) => (
            <li key={item.id}>
              <button onClick={item.run}>
                <span>{item.label}</span>
                {item.hint && <small>{item.hint}</small>}
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="empty-state">无匹配命令</li>}
        </ul>
      </div>
    </div>
  );
}
