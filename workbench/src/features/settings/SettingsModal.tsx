import { useEffect, useState } from "react";

import { api } from "../../lib/api";
import { useUIStore } from "../../stores/useUIStore";

type Form = {
  apiKey: string;
  baseUrl: string;
  model: string;
  thinkingMode: "enabled" | "disabled";
  reasoningEffort: "low" | "medium" | "high" | "max";
  maxOutputTokens: number;
  embeddingApiKey: string;
  embeddingBaseUrl: string;
  embeddingModel: string;
  embeddingDim: number;
};

const EMPTY: Form = {
  apiKey: "",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-v4-pro",
  thinkingMode: "enabled",
  reasoningEffort: "high",
  maxOutputTokens: 12000,
  embeddingApiKey: "",
  embeddingBaseUrl: "https://api.openai.com/v1",
  embeddingModel: "text-embedding-3-small",
  embeddingDim: 1536,
};

export function SettingsModal() {
  const open = useUIStore((s) => s.showSettings);
  const close = useUIStore((s) => s.toggleSettings);
  const [form, setForm] = useState<Form>(EMPTY);
  const [savedMask, setSavedMask] = useState<string>("");
  const [savedEmbeddingMask, setSavedEmbeddingMask] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setStatus("idle");
    setMessage("");
    void api.settingsAiGet().then((r) => {
      setSavedMask(r.apiKeyMask ?? "");
      setSavedEmbeddingMask(r.embeddingApiKeyMask ?? "");
      setForm((prev) => ({
        ...prev,
        apiKey: "", // never echo the saved key
        baseUrl: r.baseUrl ?? prev.baseUrl,
        model: r.model ?? prev.model,
        thinkingMode: (r.thinkingMode as Form["thinkingMode"]) ?? prev.thinkingMode,
        reasoningEffort: (r.reasoningEffort as Form["reasoningEffort"]) ?? prev.reasoningEffort,
        maxOutputTokens: r.maxOutputTokens ?? prev.maxOutputTokens,
        embeddingApiKey: "",
        embeddingBaseUrl: r.embeddingBaseUrl ?? prev.embeddingBaseUrl,
        embeddingModel: r.embeddingModel ?? prev.embeddingModel,
        embeddingDim: r.embeddingDim ?? prev.embeddingDim,
      }));
    });
  }, [open]);

  async function onSave() {
    setStatus("saving");
    try {
      // Only include keys actually set in the form so existing fields aren't blanked.
      const payload: Record<string, unknown> = {
        baseUrl: form.baseUrl,
        model: form.model,
        thinkingMode: form.thinkingMode,
        reasoningEffort: form.reasoningEffort,
        maxOutputTokens: form.maxOutputTokens,
        embeddingBaseUrl: form.embeddingBaseUrl,
        embeddingModel: form.embeddingModel,
        embeddingDim: form.embeddingDim,
      };
      if (form.apiKey) payload.apiKey = form.apiKey;
      if (form.embeddingApiKey) payload.embeddingApiKey = form.embeddingApiKey;
      await api.settingsAiSave(payload);
      setStatus("saved");
      setMessage("已保存 · LLM + embedder 已重建");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  if (!open) return null;

  return (
    <div className="settings__overlay" onMouseDown={close}>
      <div className="settings__modal" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h3>AI 设置</h3>
          <button type="button" className="ghost" onClick={close}>关闭</button>
        </header>

        <section>
          <h4>DeepSeek</h4>
          <label>
            API Key {savedMask && <span className="muted">（当前 {savedMask}，留空保留）</span>}
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="sk-..."
            />
          </label>
          <label>Base URL <input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} /></label>
          <label>Model <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></label>
          <label>
            Thinking
            <select value={form.thinkingMode} onChange={(e) => setForm({ ...form, thinkingMode: e.target.value as Form["thinkingMode"] })}>
              <option value="enabled">enabled</option>
              <option value="disabled">disabled</option>
            </select>
          </label>
          <label>
            Reasoning effort
            <select value={form.reasoningEffort} onChange={(e) => setForm({ ...form, reasoningEffort: e.target.value as Form["reasoningEffort"] })}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="max">max</option>
            </select>
          </label>
          <label>Max output tokens <input type="number" value={form.maxOutputTokens} onChange={(e) => setForm({ ...form, maxOutputTokens: Number(e.target.value) })} /></label>
        </section>

        <section>
          <h4>Embedding (可选)</h4>
          <label>
            API Key {savedEmbeddingMask && <span className="muted">（当前 {savedEmbeddingMask}，留空保留）</span>}
            <input type="password" value={form.embeddingApiKey} onChange={(e) => setForm({ ...form, embeddingApiKey: e.target.value })} />
          </label>
          <label>Base URL <input value={form.embeddingBaseUrl} onChange={(e) => setForm({ ...form, embeddingBaseUrl: e.target.value })} /></label>
          <label>Model <input value={form.embeddingModel} onChange={(e) => setForm({ ...form, embeddingModel: e.target.value })} /></label>
          <label>Dim <input type="number" value={form.embeddingDim} onChange={(e) => setForm({ ...form, embeddingDim: Number(e.target.value) })} /></label>
        </section>

        <footer>
          <button type="button" onClick={onSave} disabled={status === "saving"}>
            {status === "saving" ? "保存中…" : "保存"}
          </button>
          {message && <span className={`settings__status settings__status--${status}`}>{message}</span>}
        </footer>
      </div>
    </div>
  );
}
