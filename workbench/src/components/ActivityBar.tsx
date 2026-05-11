import type { ActivityMode, UIState } from "../store";
import { modeOpensBottomPanel, modeToBottomTab, modeToCodexTab } from "../store";

type ActivityItem = { id: ActivityMode; label: string; description: string };

const ACTIVITY_ITEMS: ActivityItem[] = [
  { id: "writing", label: "写", description: "回到正文画布" },
  { id: "simulation", label: "推", description: "运行推演与分叉" },
  { id: "runtime", label: "Runtime", description: "WorldDaemon" },
  { id: "world", label: "世界", description: "草案与解析" },
  { id: "memory", label: "记", description: "事实/表达/伏笔" },
  { id: "atlas", label: "图", description: "Atlas 镜像" },
];

type ActivityBarProps = {
  ui: UIState;
  setUI: (updater: (current: UIState) => UIState) => void;
  onRuntimeOpen?: () => void;
};

export function ActivityBar({ ui, setUI, onRuntimeOpen }: ActivityBarProps) {
  function handleClick(mode: ActivityMode) {
    setUI((current) => {
      const next: UIState = { ...current, activeMode: mode };
      const tab = modeToCodexTab(mode);
      if (tab) next.codexRailTab = tab;
      if (modeOpensBottomPanel(mode)) {
        next.bottomPanelOpen = true;
        next.bottomPanelTab = modeToBottomTab(mode);
      }
      return next;
    });
    if (mode === "runtime") onRuntimeOpen?.();
  }

  if (ui.activityBarCollapsed) {
    return null;
  }

  return (
    <nav className="activity-bar">
      {ACTIVITY_ITEMS.map((item) => (
        <button
          key={item.id}
          className={ui.activeMode === item.id ? "active" : ""}
          onClick={() => handleClick(item.id)}
          title={item.description}
        >
          <span>{item.label}</span>
          <small>{item.description}</small>
        </button>
      ))}
    </nav>
  );
}
