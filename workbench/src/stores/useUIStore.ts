// UI-only state (collapses, panels, modals). Not persisted to disk in v3
// (Phase 7 may add localStorage hydration for `railCollapsed` etc.).

import { create } from "zustand";

export type ActivityMode = "writing" | "world" | "memory" | "atlas" | "runtime";
export type CodexRailTab = "now" | "world" | "memory" | "atlas";

type UIState = {
  activeMode: ActivityMode;
  codexRailTab: CodexRailTab;
  railCollapsed: boolean;
  bottomPanelOpen: boolean;
  showCommandPalette: boolean;
  showSettings: boolean;
  typewriterMode: boolean;
  setMode: (mode: ActivityMode) => void;
  setCodexTab: (tab: CodexRailTab) => void;
  toggleRail: () => void;
  toggleBottomPanel: () => void;
  toggleCommandPalette: () => void;
  toggleSettings: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  activeMode: "writing",
  codexRailTab: "now",
  railCollapsed: false,
  bottomPanelOpen: false,
  showCommandPalette: false,
  showSettings: false,
  typewriterMode: false,

  setMode: (mode) =>
    set((state) => ({
      activeMode: mode,
      codexRailTab:
        mode === "world" ? "world" :
        mode === "memory" ? "memory" :
        mode === "atlas" ? "atlas" : state.codexRailTab,
      bottomPanelOpen: mode === "runtime" ? true : state.bottomPanelOpen,
    })),
  setCodexTab: (tab) => set({ codexRailTab: tab }),
  toggleRail: () => set((s) => ({ railCollapsed: !s.railCollapsed })),
  toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
  toggleCommandPalette: () => set((s) => ({ showCommandPalette: !s.showCommandPalette })),
  toggleSettings: () => set((s) => ({ showSettings: !s.showSettings })),
}));
