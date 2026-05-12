import { useRef, useState } from "react";

import { api } from "../../lib/api";
import { useSessionStore } from "../../stores/useSessionStore";
import { sampleWorld } from "../../sampleWorld";

type Status = "idle" | "loading" | "success" | "error";

export function WorldUploader() {
  const worldId = useSessionStore((s) => s.worldId);
  const refresh = useSessionStore((s) => s.refresh);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function apply(markdown: string, source: string) {
    setStatus("loading");
    setMessage("");
    try {
      const resp = await api.applyWorldDraft({ worldId, markdown });
      await refresh();
      const characters = (resp.parsed as { characters?: unknown[] })?.characters ?? [];
      setStatus("success");
      setMessage(`已加载 · ${characters.length} 角色 · 来源 ${source}`);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  async function onLoadSample() {
    await apply(sampleWorld, "示例世界");
  }

  async function onApplyTextarea() {
    const md = textareaRef.current?.value.trim();
    if (!md) {
      setStatus("error");
      setMessage("请粘贴 Markdown 内容");
      return;
    }
    await apply(md, "粘贴文本");
  }

  async function onUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await apply(text, file.name);
  }

  return (
    <section className="world-uploader">
      <h3>加载世界 Markdown</h3>
      <p className="world-uploader__hint">
        粘贴 Markdown 文本、上传 <code>.md</code> 文件，或一键加载内置示例（青岳宗 / 林焰 / 苏雪 / 韩渡）。
      </p>
      <div className="world-uploader__actions">
        <button type="button" onClick={onLoadSample} disabled={status === "loading"}>
          ▶ 加载示例世界
        </button>
        <label className="world-uploader__file ghost">
          上传 .md
          <input
            type="file"
            accept=".md,text/markdown"
            onChange={onUploadFile}
            disabled={status === "loading"}
          />
        </label>
      </div>
      <textarea
        ref={textareaRef}
        className="world-uploader__textarea"
        placeholder="或直接粘贴 # 世界设定 / # 角色 / # 关系 / ..."
        rows={8}
      />
      <button type="button" className="ghost" onClick={onApplyTextarea} disabled={status === "loading"}>
        提交粘贴的 Markdown
      </button>
      {status !== "idle" && (
        <div className={`world-uploader__status world-uploader__status--${status}`}>
          {status === "loading" ? "加载中…" : message}
        </div>
      )}
    </section>
  );
}
