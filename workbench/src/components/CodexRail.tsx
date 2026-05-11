import type { NarrativeDraft } from "@novel";

import type {
  AtlasFilePayload,
  AtlasTreeNode,
  MemoryPanelPayload,
  WorkbenchSessionState,
  WorldDraftPreview,
} from "../contracts";
import type { CodexRailTab, UIState } from "../store";
import { NowTab } from "./codex/NowTab";
import { WorldTab } from "./codex/WorldTab";
import { MemoryTab, type MemorySelection } from "./codex/MemoryTab";
import { AtlasTab } from "./codex/AtlasTab";

type CodexRailProps = {
  ui: UIState;
  setUI: (updater: (current: UIState) => UIState) => void;
  session: WorkbenchSessionState | null;
  activeDraft: NarrativeDraft | undefined;
  // World tab
  draftEditorText: string;
  draftPreview: WorldDraftPreview | null;
  isDraftApplied: boolean;
  onLoadSample: () => void;
  onResetWorld: () => void;
  onPreviewWorld: () => void;
  onApplyWorld: () => void;
  onDraftEditorChange: (value: string) => void;
  // Memory tab
  memory: MemoryPanelPayload | null;
  selectedMemory: MemorySelection | null;
  setSelectedMemory: (selection: MemorySelection | null) => void;
  memoryDetail: unknown;
  onRefreshMemory: () => void;
  // Atlas tab
  atlasTree: AtlasTreeNode[];
  atlasFile: AtlasFilePayload | null;
  onCompileAtlas: () => void;
  onOpenAtlasFile: (path: string) => void;
  // Pending
  pendingAction: string | null;
};

const TABS: Array<{ id: CodexRailTab; label: string }> = [
  { id: "now", label: "当前" },
  { id: "world", label: "世界" },
  { id: "memory", label: "记忆" },
  { id: "atlas", label: "图谱" },
];

export function CodexRail(props: CodexRailProps) {
  const { ui, setUI } = props;

  if (ui.railCollapsed) {
    return (
      <aside className="codex-rail collapsed">
        <button
          className="ghost rail-expand"
          onClick={() => setUI((current) => ({ ...current, railCollapsed: false }))}
          title="⌘\\"
        >
          ◀
        </button>
      </aside>
    );
  }

  return (
    <aside className="codex-rail">
      <nav className="codex-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={ui.codexRailTab === tab.id ? "active" : ""}
            onClick={() => setUI((current) => ({ ...current, codexRailTab: tab.id }))}
          >
            {tab.label}
          </button>
        ))}
        <button
          className="ghost rail-collapse"
          onClick={() => setUI((current) => ({ ...current, railCollapsed: true }))}
          title="⌘\\ 折叠"
        >
          ▶
        </button>
      </nav>

      {ui.codexRailTab === "now" && <NowTab session={props.session} activeDraft={props.activeDraft} />}
      {ui.codexRailTab === "world" && (
        <WorldTab
          session={props.session}
          draftEditorText={props.draftEditorText}
          draftPreview={props.draftPreview}
          isDraftApplied={props.isDraftApplied}
          pendingAction={props.pendingAction}
          onLoadSample={props.onLoadSample}
          onResetWorld={props.onResetWorld}
          onPreviewWorld={props.onPreviewWorld}
          onApplyWorld={props.onApplyWorld}
          onDraftEditorChange={props.onDraftEditorChange}
        />
      )}
      {ui.codexRailTab === "memory" && (
        <MemoryTab
          memory={props.memory}
          selectedMemory={props.selectedMemory}
          setSelectedMemory={props.setSelectedMemory}
          memoryDetail={props.memoryDetail}
          onRefresh={props.onRefreshMemory}
        />
      )}
      {ui.codexRailTab === "atlas" && (
        <AtlasTab
          session={props.session}
          atlasTree={props.atlasTree}
          atlasFile={props.atlasFile}
          pendingAction={props.pendingAction}
          onCompile={props.onCompileAtlas}
          onOpenFile={props.onOpenAtlasFile}
        />
      )}
    </aside>
  );
}
