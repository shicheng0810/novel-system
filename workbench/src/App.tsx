import { startTransition, useEffect, useState } from "react";

import type { NarrativeLens } from "@novel";

import { workbenchApi } from "./api";
import { AiSettingsPanel, type AiSettingsFormState } from "./components/AiSettingsPanel";
import { ActivityBar } from "./components/ActivityBar";
import { BottomPanel, type SimulationFormState } from "./components/BottomPanel";
import { CodexRail } from "./components/CodexRail";
import { CommandPalette } from "./components/CommandPalette";
import { type LensFormState } from "./components/LensDrawer";
import { type MemorySelection } from "./components/codex/MemoryTab";
import { StatusBar } from "./components/StatusBar";
import { Topbar } from "./components/Topbar";
import { WritingCanvas } from "./components/WritingCanvas";
import type {
  AiSettingsPayload,
  AtlasFilePayload,
  AtlasTreeNode,
  MemoryPanelPayload,
  RunDetailResponse,
  RuntimeDaemonResponse,
  SaveAiSettingsRequest,
  SimulationRunSummary,
  WorkbenchSessionState,
  WorldDraftPreview,
} from "./contracts";
import { sampleWorld } from "./sampleWorld";
import { defaultUIState, LAST_SCENE_STORAGE_KEY, type UIState } from "./store";

const DEFAULT_AI_SETTINGS = {
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-v4-pro",
  timeoutMs: 600000,
  thinkingMode: "enabled" as const,
  reasoningEffort: "high" as const,
  contextWindowTokens: 1000000,
  maxOutputTokens: 384000,
};

function splitCsv(value: string): string[] {
  return value
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function lensToForm(lens: NarrativeLens): LensFormState {
  return {
    focusCharacterIds: lens.focusCharacterIds.join("、"),
    stageId: lens.stageRange[0] ?? "",
    chapterGoal: lens.chapterGoal ?? "",
    sceneCount: String(lens.sceneCount ?? 5) as LensFormState["sceneCount"],
    targetMin: String(lens.targetLength?.[0] ?? 2800),
    targetMax: String(lens.targetLength?.[1] ?? 3300),
    factConstraint: lens.factConstraint ?? "medium-expansion",
  };
}

function defaultSimulationForm(): SimulationFormState {
  return {
    stageLabel: "新阶段",
    focusCharacterIds: "林焰",
    intervention: "",
    qimenPattern: "",
    qimenLocationFocus: "",
    qimenEventType: "",
    allowHardDecision: false,
  };
}

function aiSettingsToForm(settings?: AiSettingsPayload): AiSettingsFormState {
  return {
    apiKey: "",
    baseUrl: settings?.baseUrl ?? DEFAULT_AI_SETTINGS.baseUrl,
    model: settings?.model ?? DEFAULT_AI_SETTINGS.model,
    timeoutMs: String(settings?.timeoutMs ?? DEFAULT_AI_SETTINGS.timeoutMs),
    thinkingMode: settings?.thinkingMode ?? DEFAULT_AI_SETTINGS.thinkingMode,
    reasoningEffort: settings?.reasoningEffort ?? DEFAULT_AI_SETTINGS.reasoningEffort,
    contextWindowTokens: String(settings?.contextWindowTokens ?? DEFAULT_AI_SETTINGS.contextWindowTokens),
    maxOutputTokens: String(settings?.maxOutputTokens ?? DEFAULT_AI_SETTINGS.maxOutputTokens),
  };
}

function buildAiSettingsRequest(form: AiSettingsFormState): SaveAiSettingsRequest {
  return {
    apiKey: form.apiKey.trim(),
    baseUrl: form.baseUrl.trim() || DEFAULT_AI_SETTINGS.baseUrl,
    model: form.model.trim() || DEFAULT_AI_SETTINGS.model,
    timeoutMs: Number(form.timeoutMs) || DEFAULT_AI_SETTINGS.timeoutMs,
    thinkingMode: form.thinkingMode,
    reasoningEffort: form.reasoningEffort,
    contextWindowTokens: Number(form.contextWindowTokens) || DEFAULT_AI_SETTINGS.contextWindowTokens,
    maxOutputTokens: Number(form.maxOutputTokens) || DEFAULT_AI_SETTINGS.maxOutputTokens,
  };
}

function buildLensRequest(form: LensFormState): Partial<NarrativeLens> {
  const targetMin = Number(form.targetMin) || 2800;
  const targetMax = Number(form.targetMax) || Math.max(targetMin, 3300);
  return {
    focusCharacterIds: splitCsv(form.focusCharacterIds),
    stageRange: form.stageId ? [form.stageId] : [],
    chapterGoal: form.chapterGoal.trim(),
    sceneCount: Number(form.sceneCount) as 3 | 4 | 5 | 6 | 7 | 8,
    targetLength: [Math.min(targetMin, targetMax), Math.max(targetMin, targetMax)],
    factConstraint: form.factConstraint,
  };
}

function pickMemoryDetail(memory: MemoryPanelPayload | null, selection: MemorySelection | null) {
  if (!memory || !selection) return null;
  if (selection.kind === "fact") return memory.factEntries.find((entry) => entry.id === selection.id) ?? null;
  if (selection.kind === "expression")
    return memory.expressionEntries.find((entry) => entry.id === selection.id) ?? null;
  if (selection.kind === "foreshadow")
    return memory.foreshadowEntries.find((entry) => entry.id === selection.id) ?? null;
  return memory.revisionEntries.find((entry) => entry.id === selection.id) ?? null;
}

export function App() {
  const [ui, setUI] = useState<UIState>(defaultUIState());
  const [session, setSession] = useState<WorkbenchSessionState | null>(null);
  const [draftEditorText, setDraftEditorText] = useState(sampleWorld);
  const [draftPreview, setDraftPreview] = useState<WorldDraftPreview | null>(null);
  const [memoryPanel, setMemoryPanel] = useState<MemoryPanelPayload | null>(null);
  const [atlasTree, setAtlasTree] = useState<AtlasTreeNode[]>([]);
  const [atlasFile, setAtlasFile] = useState<AtlasFilePayload | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<MemorySelection | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [rewriteInstruction, setRewriteInstruction] = useState("强化冲突与对白");
  const [lensForm, setLensForm] = useState<LensFormState>(
    lensToForm({
      focusCharacterIds: ["苏雪"],
      style: "omniscient-web",
      stageRange: [],
      chapterGoal: "",
      sceneCount: 5,
      targetLength: [2800, 3300],
      factConstraint: "medium-expansion",
    }),
  );
  const [simulationForm, setSimulationForm] = useState<SimulationFormState>(defaultSimulationForm());
  const [aiSettingsForm, setAiSettingsForm] = useState<AiSettingsFormState>(aiSettingsToForm());
  const [showSettings, setShowSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [autoRunTarget, setAutoRunTarget] = useState("3");
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runtimeRuns, setRuntimeRuns] = useState<SimulationRunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunDetailResponse | null>(null);
  const [runtimeBusy, setRuntimeBusy] = useState(false);

  const activeDraft = session?.currentDraft;
  const memoryDetail = pickMemoryDetail(memoryPanel, selectedMemory);
  const isDraftApplied = session ? draftEditorText === session.appliedDraftText : false;

  const syncSession = (nextSession: WorkbenchSessionState, options?: { replaceEditor?: boolean }) => {
    startTransition(() => {
      setSession(nextSession);
      setLensForm(lensToForm(nextSession.lens));
      setAiSettingsForm((current) => ({
        ...aiSettingsToForm(nextSession.aiSettings),
        apiKey: current.apiKey,
      }));
      const restored = ui.lastOpenedSceneId;
      const sceneFromSession = nextSession.selectedSceneId ?? nextSession.currentDraft?.sceneDrafts[0]?.sceneId ?? "";
      const restoreCandidate = restored && nextSession.currentDraft?.sceneDrafts.some((s) => s.sceneId === restored)
        ? restored
        : sceneFromSession;
      setSelectedSceneId(restoreCandidate);
      if (options?.replaceEditor) {
        setDraftEditorText(nextSession.appliedDraftText);
        setDraftPreview(nextSession.worldPreview);
      }
    });
  };

  async function refreshMemory(lineId?: string) {
    if (!session && !lineId) return;
    const payload = await workbenchApi.memory(lineId ?? session!.selectedLineId);
    setMemoryPanel(payload);
  }

  async function refreshAtlas(lineId?: string, preferredPath?: string) {
    if (!session && !lineId) return;
    const targetLineId = lineId ?? session!.selectedLineId;
    const treePayload = await workbenchApi.atlasTree(targetLineId);
    setAtlasTree(treePayload.tree);
    const nextPath = preferredPath ?? treePayload.tree.find((node) => node.kind === "file")?.path;
    if (nextPath) {
      const filePayload = await workbenchApi.atlasFile(targetLineId, nextPath);
      setAtlasFile(filePayload);
    } else {
      setAtlasFile(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const nextSession = await workbenchApi.session();
        if (cancelled) return;
        syncSession(nextSession, { replaceEditor: true });
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "无法加载 Studio 会话");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    if (ui.codexRailTab === "memory") void refreshMemory();
    if (ui.codexRailTab === "atlas") void refreshAtlas();
  }, [ui.codexRailTab, session?.selectedLineId]);

  useEffect(() => {
    if (!session?.runtimeDaemon?.active) return;
    const timer = window.setInterval(() => {
      void workbenchApi.runtimeStatus().then((response) => {
        syncSession(response.session);
        void refreshRuns();
      });
    }, 1200);
    return () => window.clearInterval(timer);
  }, [session?.runtimeDaemon?.active]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedSceneId) {
      window.localStorage.setItem(LAST_SCENE_STORAGE_KEY, selectedSceneId);
      setUI((current) => ({ ...current, lastOpenedSceneId: selectedSceneId }));
    }
  }, [selectedSceneId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && !event.shiftKey && (event.key === "k" || event.key === "K")) {
        event.preventDefault();
        setUI((current) => ({ ...current, showCommandPalette: !current.showCommandPalette }));
        return;
      }
      if (meta && event.shiftKey && event.key === "\\") {
        event.preventDefault();
        setUI((current) => ({ ...current, activityBarCollapsed: !current.activityBarCollapsed }));
        return;
      }
      if (meta && !event.shiftKey && event.key === "\\") {
        event.preventDefault();
        setUI((current) => ({ ...current, railCollapsed: !current.railCollapsed }));
        return;
      }
      if (meta && event.key === ".") {
        event.preventDefault();
        setUI((current) => ({ ...current, typewriterMode: !current.typewriterMode }));
        return;
      }
      if (event.key === "F11") {
        event.preventDefault();
        if (!document.fullscreenElement) {
          void document.documentElement.requestFullscreen();
        } else {
          void document.exitFullscreen();
        }
        return;
      }
      if (event.key === "Escape") {
        setUI((current) => {
          if (current.showCommandPalette) return { ...current, showCommandPalette: false };
          if (current.bottomPanelOpen) return { ...current, bottomPanelOpen: false };
          return current;
        });
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function runAction(label: string, action: () => Promise<void>) {
    setPendingAction(label);
    setError(null);
    try {
      await action();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : `${label}失败`);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCompose() {
    await runAction("生成章节", async () => {
      if (!session) return;
      const response = await workbenchApi.compose({
        lineId: session.selectedLineId,
        lens: buildLensRequest(lensForm),
      });
      syncSession(response.session);
    });
  }

  async function handleCritique() {
    await runAction("复核正文", async () => {
      if (!session?.currentDraft) return;
      const response = await workbenchApi.critique({
        lineId: session.selectedLineId,
        lens: buildLensRequest(lensForm),
        draft: session.currentDraft,
      });
      syncSession(response.session);
    });
  }

  async function handleAssembleChapter() {
    await runAction("生成完整章节", async () => {
      if (!session?.currentDraft) return;
      const response = await workbenchApi.assemble({
        lineId: session.selectedLineId,
        lens: buildLensRequest(lensForm),
        draft: session.currentDraft,
      });
      syncSession(response.session);
    });
  }

  async function handleRewrite() {
    await runAction("局部重写", async () => {
      if (!session?.currentDraft || !selectedSceneId || !rewriteInstruction.trim()) return;
      const response = await workbenchApi.rewrite({
        lineId: session.selectedLineId,
        draft: session.currentDraft,
        sceneId: selectedSceneId,
        instructions: [rewriteInstruction.trim()],
        lens: buildLensRequest(lensForm),
      });
      syncSession(response.session);
    });
  }

  async function handleConfirmFinal() {
    await runAction("确认终稿", async () => {
      if (!session?.currentDraft) return;
      if (!window.confirm("确认将当前场景写入表达记忆，并触发当前历史线的 Atlas 编译？")) return;
      const response = await workbenchApi.confirmFinal({
        lineId: session.selectedLineId,
        sceneId: selectedSceneId,
        draft: session.currentDraft,
      });
      syncSession(response.session);
      await Promise.all([refreshMemory(session.selectedLineId), refreshAtlas(session.selectedLineId)]);
    });
  }

  async function handleSelectLine(lineId: string) {
    await runAction("切换历史线", async () => {
      const response = await workbenchApi.selectLine(lineId);
      syncSession(response.session);
    });
  }

  function buildDirective() {
    return {
      stageLabel: simulationForm.stageLabel.trim() || "新阶段",
      focusCharacterIds: splitCsv(simulationForm.focusCharacterIds),
      intervention: simulationForm.intervention.trim() || undefined,
      qimenOverride:
        simulationForm.qimenPattern || simulationForm.qimenLocationFocus || simulationForm.qimenEventType
          ? {
              pattern: simulationForm.qimenPattern || undefined,
              locationFocus: simulationForm.qimenLocationFocus || undefined,
              eventType: simulationForm.qimenEventType || undefined,
              allowHardDecision: simulationForm.allowHardDecision,
            }
          : undefined,
    };
  }

  async function handleRunStage() {
    await runAction("推进阶段", async () => {
      const response = await workbenchApi.runStage(buildDirective());
      syncSession(response.session);
      setUI((current) => ({ ...current, bottomPanelOpen: true, bottomPanelTab: "simulation" }));
    });
  }

  async function handleRunAuto() {
    await runAction("连续自动推进", async () => {
      const response = await workbenchApi.runAuto({
        targetStageCount: Number(autoRunTarget) || 1,
        ...buildDirective(),
        stageLabel: simulationForm.stageLabel.trim() || "自动推进",
      });
      syncSession(response.session);
      setUI((current) => ({ ...current, bottomPanelOpen: true, bottomPanelTab: "simulation" }));
    });
  }

  async function refreshRuns() {
    const response = await workbenchApi.listRuns();
    setRuntimeRuns(response.runs);
  }

  async function syncRuntimeResponse(response: RuntimeDaemonResponse) {
    syncSession(response.session);
    await refreshRuns();
    const lastRunId = response.runtime.lastRunId ?? response.runtime.runIds.at(-1);
    if (lastRunId) {
      setSelectedRun(await workbenchApi.getRunDetail(lastRunId));
    }
  }

  async function runRuntimeTick() {
    await runAction("WorldDaemon Tick", async () => {
      setRuntimeBusy(true);
      try {
        const response = await workbenchApi.runDaemonTick({
          directive: { ...buildDirective(), stageLabel: simulationForm.stageLabel.trim() || "世界自动推进" },
        });
        syncSession(response.session);
        await refreshRuns();
        setSelectedRun(await workbenchApi.getRunDetail(response.runId));
        setUI((current) => ({ ...current, bottomPanelOpen: true, bottomPanelTab: "ticks" }));
      } finally {
        setRuntimeBusy(false);
      }
    });
  }

  async function handleStartRuntime() {
    await runAction("启动后台 Runtime", async () => {
      const response = await workbenchApi.startRuntime({
        targetTicks: Number(autoRunTarget) || 1,
        directive: { ...buildDirective(), stageLabel: simulationForm.stageLabel.trim() || "世界后台推演" },
      });
      await syncRuntimeResponse(response);
      setUI((current) => ({ ...current, bottomPanelOpen: true, bottomPanelTab: "ticks" }));
    });
  }

  async function handlePauseRuntime() {
    await runAction("暂停后台 Runtime", async () => {
      const response = await workbenchApi.pauseRuntime();
      await syncRuntimeResponse(response);
    });
  }

  async function handleResumeRuntime() {
    await runAction("恢复后台 Runtime", async () => {
      const response = await workbenchApi.resumeRuntime();
      await syncRuntimeResponse(response);
    });
  }

  async function refreshRuntimeStatus() {
    await runAction("刷新 Runtime 状态", async () => {
      const response = await workbenchApi.runtimeStatus();
      await syncRuntimeResponse(response);
    });
  }

  async function openRun(runId: string) {
    await runAction("加载 SimulationRun", async () => {
      setSelectedRun(await workbenchApi.getRunDetail(runId));
    });
  }

  async function handleSaveAiSettings() {
    await runAction("保存 AI 设置", async () => {
      const request = buildAiSettingsRequest(aiSettingsForm);
      if (!request.apiKey && !session?.aiSettings?.configured) {
        throw new Error("请先填写 DeepSeek API key。");
      }
      const validation = await workbenchApi.validateAiSettings(request);
      const saved = await workbenchApi.saveAiSettings(request);
      syncSession(saved.session, { replaceEditor: true });
      setAiSettingsForm((current) => ({ ...current, apiKey: "" }));
      setSettingsMessage(`DeepSeek 校验通过，模型 ${validation.validation.model} 已保存到本机。`);
      setShowSettings(false);
    });
  }

  async function handleClearAiSettings() {
    await runAction("清空 AI 设置", async () => {
      if (!window.confirm("清空后整个 Studio 会重新锁定，是否继续？")) return;
      const cleared = await workbenchApi.clearAiSettings();
      syncSession(cleared.session, { replaceEditor: true });
      setAiSettingsForm(aiSettingsToForm());
      setSettingsMessage("本机 DeepSeek 配置已清空，Studio 已重新锁定。");
      setShowSettings(false);
    });
  }

  async function handlePromoteBranch(branchId: string) {
    await runAction("扶正分叉", async () => {
      if (!window.confirm("确认将这条分叉扶正为当前正史？旧正史会被归档。")) return;
      const response = await workbenchApi.promoteBranch(branchId);
      syncSession(response.session);
    });
  }

  async function handleWorldPreview() {
    await runAction("预览草案解析", async () => {
      const preview = await workbenchApi.parseWorld(draftEditorText);
      setDraftPreview(preview.preview);
    });
  }

  async function handleApplyWorld() {
    await runAction("应用世界草案", async () => {
      if (!window.confirm("应用后会重建当前会话，并清空现有推演与写作上下文。是否继续？")) return;
      const response = await workbenchApi.applyWorld(draftEditorText);
      syncSession(response.session, { replaceEditor: true });
      setMemoryPanel(null);
      setAtlasTree([]);
      setAtlasFile(null);
      setSelectedMemory(null);
    });
  }

  async function handleResetWorld() {
    await runAction("重置编辑区", async () => {
      const payload = await workbenchApi.resetWorld();
      setDraftEditorText(payload.draftText);
      setDraftPreview(payload.preview);
    });
  }

  async function handleCompileAtlas() {
    await runAction("编译 Atlas", async () => {
      if (!session) return;
      const response = await workbenchApi.compileAtlas(session.selectedLineId);
      syncSession(response.session);
      await refreshAtlas(session.selectedLineId);
    });
  }

  async function handleOpenAtlasFile(path: string) {
    await runAction("加载 Atlas 文件", async () => {
      if (!session) return;
      setAtlasFile(await workbenchApi.atlasFile(session.selectedLineId, path));
    });
  }

  function handleRuntimeRailOpen() {
    void refreshRuns();
  }

  if (isLoading) {
    return <div className="loading-shell">正在载入作者 Studio…</div>;
  }

  if (session?.locked) {
    return (
      <div className="studio-shell locked">
        <Topbar
          session={session}
          isDraftApplied={isDraftApplied}
          onToggleSettings={() => setShowSettings((current) => !current)}
          onOpenCommandPalette={() => setUI((current) => ({ ...current, showCommandPalette: true }))}
        />
        {error && <div className="error-banner">{error}</div>}
        {pendingAction && <div className="status-banner">处理中：{pendingAction}</div>}
        {settingsMessage && <div className="status-banner">{settingsMessage}</div>}
        <div className="locked-shell">
          <section className="locked-card">
            <p className="eyebrow">DeepSeek Required</p>
            <h1>先配置 DeepSeek，Studio 才会解锁。</h1>
            <p className="panel-copy">
              这个工作台现在已经改成 AI 主导全流程。没有有效的 API key，写作、推演、分叉评估和自动推进都不会开放。
            </p>
            <AiSettingsPanel
              session={session}
              form={aiSettingsForm}
              setForm={setAiSettingsForm}
              pendingAction={pendingAction}
              onSave={() => void handleSaveAiSettings()}
              onClear={() => void handleClearAiSettings()}
              onClose={() => setShowSettings(false)}
            />
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="studio-shell">
      <Topbar
        session={session}
        isDraftApplied={isDraftApplied}
        onToggleSettings={() => setShowSettings((current) => !current)}
        onOpenCommandPalette={() => setUI((current) => ({ ...current, showCommandPalette: true }))}
      />

      {error && <div className="error-banner">{error}</div>}
      {settingsMessage && <div className="status-banner">{settingsMessage}</div>}

      <div className="studio-frame">
        <ActivityBar ui={ui} setUI={setUI} onRuntimeOpen={handleRuntimeRailOpen} />

        <main className="canvas-area">
          {showSettings && (
            <AiSettingsPanel
              session={session}
              form={aiSettingsForm}
              setForm={setAiSettingsForm}
              pendingAction={pendingAction}
              onSave={() => void handleSaveAiSettings()}
              onClear={() => void handleClearAiSettings()}
              onClose={() => setShowSettings(false)}
            />
          )}
          <WritingCanvas
            ui={ui}
            setUI={setUI}
            session={session}
            activeDraft={activeDraft}
            selectedSceneId={selectedSceneId}
            setSelectedSceneId={setSelectedSceneId}
            lensForm={lensForm}
            setLensForm={setLensForm}
            rewriteInstruction={rewriteInstruction}
            setRewriteInstruction={setRewriteInstruction}
            pendingAction={pendingAction}
            onCompose={() => void handleCompose()}
            onCritique={() => void handleCritique()}
            onAssemble={() => void handleAssembleChapter()}
            onRewrite={() => void handleRewrite()}
            onConfirmFinal={() => void handleConfirmFinal()}
            onSelectLine={(lineId) => void handleSelectLine(lineId)}
            onRunTick={() => void runRuntimeTick()}
            onOpenCommandPalette={() => setUI((current) => ({ ...current, showCommandPalette: true }))}
          />
          <BottomPanel
            ui={ui}
            setUI={setUI}
            session={session}
            simulationForm={simulationForm}
            setSimulationForm={setSimulationForm}
            autoRunTarget={autoRunTarget}
            setAutoRunTarget={setAutoRunTarget}
            pendingAction={pendingAction}
            onRunStage={() => void handleRunStage()}
            onRunAuto={() => void handleRunAuto()}
            onPromoteBranch={(branchId) => void handlePromoteBranch(branchId)}
            onSelectLine={(lineId) => void handleSelectLine(lineId)}
            runs={runtimeRuns}
            selectedRun={selectedRun}
            runtimeBusy={runtimeBusy}
            onStartRuntime={() => void handleStartRuntime()}
            onPauseRuntime={() => void handlePauseRuntime()}
            onResumeRuntime={() => void handleResumeRuntime()}
            onRefreshRuns={() => void refreshRuns()}
            onRefreshRuntimeStatus={() => void refreshRuntimeStatus()}
            onRunTick={() => void runRuntimeTick()}
            onOpenRun={(runId) => void openRun(runId)}
          />
        </main>

        <CodexRail
          ui={ui}
          setUI={setUI}
          session={session}
          activeDraft={activeDraft}
          draftEditorText={draftEditorText}
          draftPreview={draftPreview}
          isDraftApplied={isDraftApplied}
          onLoadSample={() => setDraftEditorText(sampleWorld)}
          onResetWorld={() => void handleResetWorld()}
          onPreviewWorld={() => void handleWorldPreview()}
          onApplyWorld={() => void handleApplyWorld()}
          onDraftEditorChange={setDraftEditorText}
          memory={memoryPanel}
          selectedMemory={selectedMemory}
          setSelectedMemory={setSelectedMemory}
          memoryDetail={memoryDetail}
          onRefreshMemory={() => void refreshMemory()}
          atlasTree={atlasTree}
          atlasFile={atlasFile}
          onCompileAtlas={() => void handleCompileAtlas()}
          onOpenAtlasFile={(path) => void handleOpenAtlasFile(path)}
          pendingAction={pendingAction}
        />
      </div>

      <StatusBar session={session} runs={runtimeRuns} pendingAction={pendingAction} setUI={setUI} />

      {ui.showCommandPalette && (
        <CommandPalette
          session={session}
          onClose={() => setUI((current) => ({ ...current, showCommandPalette: false }))}
          onCompose={() => void handleCompose()}
          onRunStage={() => void handleRunStage()}
          onRunTick={() => void runRuntimeTick()}
          onSelectLine={(lineId) => void handleSelectLine(lineId)}
          onSelectScene={setSelectedSceneId}
          onSetCodexTab={(tab) => setUI((current) => ({ ...current, codexRailTab: tab }))}
          onToggleBottomPanel={() => setUI((current) => ({ ...current, bottomPanelOpen: !current.bottomPanelOpen }))}
        />
      )}
    </div>
  );
}
