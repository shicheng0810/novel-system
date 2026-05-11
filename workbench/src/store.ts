import type { WorkbenchWorkspace } from "./contracts";

export type ActivityMode = WorkbenchWorkspace;

export type CodexRailTab = "now" | "world" | "memory" | "atlas";

export type BottomPanelTab = "simulation" | "ticks";

export type UIState = {
  activeMode: ActivityMode;
  codexRailTab: CodexRailTab;
  bottomPanelOpen: boolean;
  bottomPanelTab: BottomPanelTab;
  railCollapsed: boolean;
  activityBarCollapsed: boolean;
  lastOpenedSceneId: string | null;
  showCommandPalette: boolean;
  typewriterMode: boolean;
  lensDrawerOpen: boolean;
};

export const LAST_SCENE_STORAGE_KEY = "workbench:lastOpenedSceneId";

export function defaultUIState(): UIState {
  return {
    activeMode: "writing",
    codexRailTab: "now",
    bottomPanelOpen: false,
    bottomPanelTab: "simulation",
    railCollapsed: false,
    activityBarCollapsed: false,
    lastOpenedSceneId:
      typeof window !== "undefined" ? window.localStorage.getItem(LAST_SCENE_STORAGE_KEY) : null,
    showCommandPalette: false,
    typewriterMode: false,
    lensDrawerOpen: false,
  };
}

export function modeToCodexTab(mode: ActivityMode): CodexRailTab | null {
  if (mode === "world") return "world";
  if (mode === "memory") return "memory";
  if (mode === "atlas") return "atlas";
  if (mode === "writing") return "now";
  return null;
}

export function modeOpensBottomPanel(mode: ActivityMode): boolean {
  return mode === "simulation" || mode === "runtime";
}

export function modeToBottomTab(mode: ActivityMode): BottomPanelTab {
  return mode === "runtime" ? "ticks" : "simulation";
}
