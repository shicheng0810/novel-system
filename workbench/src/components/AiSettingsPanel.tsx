import type { WorkbenchSessionState } from "../contracts";

const DEFAULT_AI_SETTINGS = {
  reasoningEffort: "high" as const,
};

export type AiSettingsFormState = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: string;
  thinkingMode: "enabled" | "disabled";
  reasoningEffort: "high" | "max";
  contextWindowTokens: string;
  maxOutputTokens: string;
};

type AiSettingsPanelProps = {
  session: WorkbenchSessionState | null;
  form: AiSettingsFormState;
  setForm: (updater: (current: AiSettingsFormState) => AiSettingsFormState) => void;
  pendingAction: string | null;
  onSave: () => void;
  onClear: () => void;
  onClose: () => void;
};

export function AiSettingsPanel({
  session,
  form,
  setForm,
  pendingAction,
  onSave,
  onClear,
  onClose,
}: AiSettingsPanelProps) {
  return (
    <div className="settings-panel">
      <div className="card-heading">
        <h2>AI 设置</h2>
        <span>{session?.aiSettings?.configured ? "已保存到本机" : "尚未配置"}</span>
      </div>
      <div className="form-grid">
        <label className="span-2">
          API Key
          <input
            type="password"
            placeholder={session?.aiSettings?.apiKeyMasked ?? "sk-..."}
            value={form.apiKey}
            onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
          />
        </label>
        <label className="span-2">
          Base URL
          <input
            value={form.baseUrl}
            onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))}
          />
        </label>
        <label>
          Model
          <input
            value={form.model}
            onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
          />
        </label>
        <label>
          Timeout (ms)
          <input
            value={form.timeoutMs}
            onChange={(event) => setForm((current) => ({ ...current, timeoutMs: event.target.value }))}
          />
        </label>
        <label>
          Thinking
          <select
            value={form.thinkingMode}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                thinkingMode: event.target.value as "enabled" | "disabled",
              }))
            }
          >
            <option value="enabled">enabled</option>
            <option value="disabled">disabled</option>
          </select>
        </label>
        <label>
          Effort
          <select
            value={form.reasoningEffort}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                reasoningEffort: event.target.value as "high" | "max",
              }))
            }
          >
            <option value="max">max</option>
            <option value="high">high</option>
          </select>
        </label>
        <label>
          Context tokens
          <input
            value={form.contextWindowTokens}
            onChange={(event) =>
              setForm((current) => ({ ...current, contextWindowTokens: event.target.value }))
            }
          />
        </label>
        <label>
          Max output tokens
          <input
            value={form.maxOutputTokens}
            onChange={(event) =>
              setForm((current) => ({ ...current, maxOutputTokens: event.target.value }))
            }
          />
        </label>
        <div className="span-2 muted-block">
          {session?.aiSettings?.configured
            ? `当前已保存：${session.aiSettings.apiKeyMasked} / ${session.aiSettings.model} / ${session.aiSettings.baseUrl} / ${session.aiSettings.reasoningEffort ?? DEFAULT_AI_SETTINGS.reasoningEffort}`
            : "配置会保存到本机，重启后仍会沿用；浏览器前端不会直接接触你的 key。"}
        </div>
      </div>
      <div className="action-group">
        <button onClick={onSave} disabled={pendingAction !== null}>
          保存并校验
        </button>
        {session?.aiSettings?.configured && (
          <button className="ghost" onClick={onClear} disabled={pendingAction !== null}>
            清空设置
          </button>
        )}
        <button className="ghost" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  );
}
