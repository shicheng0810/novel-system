import { useEffect, useRef, useState } from "react";

export type SlashCommand = {
  id: string;
  label: string;
  hint?: string;
  run: (textarea: HTMLTextAreaElement) => void;
};

type InlineSlashMenuProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  commands: SlashCommand[];
  className?: string;
};

export function InlineSlashMenu({
  value,
  onChange,
  placeholder = "在这里继续写…输入 / 触发命令",
  commands,
  className,
}: InlineSlashMenuProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const filtered = filter
    ? commands.filter((c) => c.label.toLowerCase().includes(filter.toLowerCase()))
    : commands;

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value;
    onChange(next);
    const caret = event.target.selectionStart ?? next.length;
    const before = next.slice(0, caret);
    const match = before.match(/(^|\s)\/(\w*)$/);
    if (match) {
      setMenuOpen(true);
      setFilter(match[2] ?? "");
    } else {
      setMenuOpen(false);
      setFilter("");
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!menuOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setMenuOpen(false);
      return;
    }
    if (event.key === "Enter" && filtered[0]) {
      event.preventDefault();
      runCommand(filtered[0]);
    }
  }

  function runCommand(cmd: SlashCommand) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const caret = textarea.selectionStart;
    const before = textarea.value.slice(0, caret);
    const trimmed = before.replace(/(^|\s)\/\w*$/, "$1");
    const after = textarea.value.slice(caret);
    onChange(trimmed + after);
    setMenuOpen(false);
    setFilter("");
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(trimmed.length, trimmed.length);
      cmd.run(textarea);
    }, 0);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (event: MouseEvent) => {
      if (!textareaRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div className={`inline-slash-wrap ${className ?? ""}`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      {menuOpen && filtered.length > 0 && (
        <ul className="inline-slash-menu">
          {filtered.slice(0, 8).map((cmd) => (
            <li key={cmd.id}>
              <button onClick={() => runCommand(cmd)}>
                <span>/{cmd.id}</span>
                <small>{cmd.label}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
