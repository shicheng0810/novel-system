import { useEffect, useRef, useState } from "react";

import { useDaemonStore } from "../../stores/useDaemonStore";
import { useUIStore } from "../../stores/useUIStore";

export type SlashCommand = {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  run: () => Promise<void> | void;
};

/**
 * SlashMenu hooks into a textarea ref. When the caret enters a position
 * where the most recent char (or line-start) is `/`, the menu opens.
 * Pressing Esc / clicking outside closes. Selected command runs and the
 * `/` is consumed.
 */
export function useSlashMenu(textareaRef: React.RefObject<HTMLTextAreaElement | null>): {
  open: boolean;
  caret: { top: number; left: number };
  commands: SlashCommand[];
  highlight: number;
  setHighlight: (n: number) => void;
  close: () => void;
} {
  const [open, setOpen] = useState(false);
  const [caret, setCaret] = useState({ top: 0, left: 0 });
  const [highlight, setHighlight] = useState(0);
  const togglePalette = useUIStore((s) => s.toggleCommandPalette);
  const step = useDaemonStore((s) => s.step);
  const status = useDaemonStore((s) => s.status);

  const commands: SlashCommand[] = [
    {
      id: "step-tick",
      label: "让 daemon 推 1 步",
      hint: status?.active ? "正在运行 · 请先暂停" : undefined,
      disabled: status?.active === true,
      run: () => void step(),
    },
    {
      id: "open-palette",
      label: "打开命令面板 ⌘K",
      run: () => togglePalette(),
    },
    {
      id: "search-memory",
      label: "搜记忆…（待接续段）",
      disabled: true,
      run: () => {},
    },
    {
      id: "save-fact",
      label: "保存当前段为 fact 记忆（待接续段）",
      disabled: true,
      run: () => {},
    },
  ];

  // Re-clamp highlight when commands shape changes.
  useEffect(() => {
    if (highlight >= commands.length) setHighlight(0);
  }, [commands.length, highlight]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    function onInput() {
      if (!el) return;
      const pos = el.selectionStart ?? 0;
      const before = el.value.slice(0, pos);
      const lineStart = before.lastIndexOf("\n") + 1;
      const lineSoFar = before.slice(lineStart);
      if (lineSoFar === "/" || lineSoFar.endsWith(" /")) {
        const rect = caretPosition(el);
        setCaret(rect);
        setOpen(true);
        setHighlight(0);
      } else if (!lineSoFar.endsWith("/")) {
        setOpen(false);
      }
    }

    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") {
        setOpen(false);
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowDown") {
        setHighlight((h) => (h + 1) % commands.length);
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        setHighlight((h) => (h - 1 + commands.length) % commands.length);
        e.preventDefault();
      } else if (e.key === "Enter") {
        const cmd = commands[highlight];
        if (cmd && !cmd.disabled) {
          void cmd.run();
          setOpen(false);
          // remove the trailing `/`
          if (el) {
            const pos = el.selectionStart ?? 0;
            el.value = el.value.slice(0, pos - 1) + el.value.slice(pos);
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }
        e.preventDefault();
      }
    }

    el.addEventListener("input", onInput);
    el.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("keydown", onKey);
    };
  }, [textareaRef, open, highlight, commands.length]);

  return { open, caret, commands, highlight, setHighlight, close: () => setOpen(false) };
}

export function SlashMenu(props: {
  open: boolean;
  caret: { top: number; left: number };
  commands: SlashCommand[];
  highlight: number;
  setHighlight: (n: number) => void;
  close: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) props.close();
    }
    if (props.open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [props.open]);

  if (!props.open) return null;
  return (
    <div
      ref={rootRef}
      className="slash-menu"
      style={{ top: props.caret.top, left: props.caret.left }}
    >
      <ul>
        {props.commands.map((c, i) => (
          <li
            key={c.id}
            className={`slash-menu__row${i === props.highlight ? " active" : ""}${c.disabled ? " disabled" : ""}`}
            onMouseEnter={() => props.setHighlight(i)}
            onMouseDown={(e) => {
              if (c.disabled) return;
              e.preventDefault();
              void c.run();
              props.close();
            }}
          >
            <span className="slash-menu__label">{c.label}</span>
            {c.hint && <span className="slash-menu__hint">{c.hint}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function caretPosition(el: HTMLTextAreaElement): { top: number; left: number } {
  const rect = el.getBoundingClientRect();
  return { top: rect.bottom + 6 + window.scrollY, left: rect.left + 12 + window.scrollX };
}
