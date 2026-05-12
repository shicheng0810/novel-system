import type { WorkbenchSessionState } from "../contracts";

type TopbarProps = {
  session: WorkbenchSessionState | null;
  isDraftApplied: boolean;
  onToggleSettings: () => void;
  onOpenCommandPalette: () => void;
};

export function Topbar({ session, isDraftApplied, onToggleSettings, onOpenCommandPalette }: TopbarProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">World History Engine / Studio</p>
        <strong>世界史真相核与中文修仙写作台</strong>
      </div>
      <div className="topbar-meta">
        <span>{session?.providerName ?? "provider 未知"}</span>
        <span>{session?.aiSettings?.configured ? `DeepSeek：${session.aiSettings.model}` : "DeepSeek 未配置"}</span>
        <span>活动历史线：{session?.selectedLineId ?? "canon"}</span>
        <span>阶段数：{session?.simulation.stages.length ?? 0}</span>
        <span>{isDraftApplied ? "草案已应用" : "草案未应用"}</span>
        <button className="ghost" onClick={onOpenCommandPalette} title="⌘K">
          ⌘K
        </button>
        <button className="ghost" onClick={onToggleSettings}>
          AI 设置
        </button>
      </div>
    </header>
  );
}
