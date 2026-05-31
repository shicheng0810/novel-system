// UI-only state (collapses, panels, modals). Not persisted to disk in v3
// (Phase 7 may add localStorage hydration for `railCollapsed` etc.).

import { create } from "zustand";

export type ActivityMode = "writing" | "world" | "memory" | "atlas" | "runtime";
export type CodexRailTab = "now" | "world" | "memory" | "atlas";

// Decision resolution intent — frontend-only stub.
// TODO: when backend lands /api/decisions/{id}/resolve, useEventStore.resolveDecision()
// should POST and only mark resolved on 2xx. Until then, this is in-memory only.
export type DecisionResolution = "uphold" | "return";

type UIState = {
  activeMode: ActivityMode;
  codexRailTab: CodexRailTab;
  railCollapsed: boolean;
  bottomPanelOpen: boolean;
  showCommandPalette: boolean;
  showSettings: boolean;
  typewriterMode: boolean;
  statusBarExpanded: boolean;
  // Persisted across BottomPanel open/close + tab switches.
  focusIds: string[];
  // Map of decisionId → resolution intent. Frontend-only until backend wired.
  decisionResolutions: Record<string, DecisionResolution>;
  // P1-D · Atlas folder disclosure state, keyed by full folder path.
  atlasExpanded: Record<string, boolean>;
  // P1-D · Currently selected atlas file path; persisted across tab switches.
  atlasSelected: string | null;
  // P1-E · Map chapterId → scrollTop, so switching chapters preserves reading position.
  chapterScrollPositions: Record<string, number>;
  setMode: (mode: ActivityMode) => void;
  setCodexTab: (tab: CodexRailTab) => void;
  toggleRail: () => void;
  toggleBottomPanel: () => void;
  toggleCommandPalette: () => void;
  toggleSettings: () => void;
  toggleStatusBar: () => void;
  setFocusIds: (ids: string[]) => void;
  toggleFocusId: (id: string) => void;
  recordDecisionResolution: (id: string, resolution: DecisionResolution) => void;
  toggleAtlasExpanded: (path: string) => void;
  setAtlasSelected: (path: string | null) => void;
  saveChapterScroll: (chapterId: string, top: number) => void;
};

export const useUIStore = create<UIState>((set) => ({
  activeMode: "writing",
  codexRailTab: "now",
  railCollapsed: false,
  bottomPanelOpen: false,
  showCommandPalette: false,
  showSettings: false,
  typewriterMode: false,
  statusBarExpanded: false,
  focusIds: [],
  decisionResolutions: {},
  atlasExpanded: {},
  atlasSelected: null,
  chapterScrollPositions: {},

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
  toggleStatusBar: () => set((s) => ({ statusBarExpanded: !s.statusBarExpanded })),
  setFocusIds: (ids) => set({ focusIds: ids }),
  toggleFocusId: (id) =>
    set((s) => ({
      focusIds: s.focusIds.includes(id) ? s.focusIds.filter((x) => x !== id) : [...s.focusIds, id],
    })),
  recordDecisionResolution: (id, resolution) =>
    set((s) => ({ decisionResolutions: { ...s.decisionResolutions, [id]: resolution } })),
  toggleAtlasExpanded: (path) =>
    set((s) => ({ atlasExpanded: { ...s.atlasExpanded, [path]: !s.atlasExpanded[path] } })),
  setAtlasSelected: (path) => set({ atlasSelected: path }),
  saveChapterScroll: (chapterId, top) =>
    set((s) => ({ chapterScrollPositions: { ...s.chapterScrollPositions, [chapterId]: top } })),
}));
