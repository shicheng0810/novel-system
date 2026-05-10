import { startTransition, useEffect, useState } from "react";

import type { NarrativeLens, NarrativeDraft } from "@novel";

import { workbenchApi } from "./api";
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
  WorkbenchWorkspace,
  WorldDraftPreview,
} from "./contracts";
import { sampleWorld } from "./sampleWorld";

type LensFormState = {
  focusCharacterIds: string;
  stageId: string;
  chapterGoal: string;
  sceneCount: "3" | "4" | "5" | "6" | "7" | "8";
  targetMin: string;
  targetMax: string;
  factConstraint: "strict" | "medium-expansion";
};

type SimulationFormState = {
  stageLabel: string;
  focusCharacterIds: string;
  intervention: string;
  qimenPattern: string;
  qimenLocationFocus: string;
  qimenEventType: string;
  allowHardDecision: boolean;
};

type AiSettingsFormState = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: string;
  thinkingMode: "enabled" | "disabled";
  reasoningEffort: "high" | "max";
  contextWindowTokens: string;
  maxOutputTokens: string;
};

type MemorySelection =
  | { kind: "fact"; id: string }
  | { kind: "expression"; id: string }
  | { kind: "foreshadow"; id: string }
  | { kind: "revision"; id: string };

const WORKSPACES: Array<{ id: WorkbenchWorkspace; label: string; description: string }> = [
  { id: "writing", label: "写作", description: "选历史线并写章" },
  { id: "simulation", label: "推演", description: "推进阶段与管理分叉" },
  { id: "runtime", label: "Runtime", description: "WorldDaemon 与 SimulationRun" },
  { id: "world", label: "世界", description: "编辑草案并预览解析" },
  { id: "memory", label: "记忆", description: "查看事实、表达、伏笔、修订" },
  { id: "atlas", label: "Atlas", description: "浏览只读知识镜像" },
];

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

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function pickMemoryDetail(memory: MemoryPanelPayload | null, selection: MemorySelection | null) {
  if (!memory || !selection) {
    return null;
  }
  if (selection.kind === "fact") {
    return memory.factEntries.find((entry) => entry.id === selection.id) ?? null;
  }
  if (selection.kind === "expression") {
    return memory.expressionEntries.find((entry) => entry.id === selection.id) ?? null;
  }
  if (selection.kind === "foreshadow") {
    return memory.foreshadowEntries.find((entry) => entry.id === selection.id) ?? null;
  }
  return memory.revisionEntries.find((entry) => entry.id === selection.id) ?? null;
}

export function App() {
  const [workspace, setWorkspace] = useState<WorkbenchWorkspace>("writing");
  const [session, setSession] = useState<WorkbenchSessionState | null>(null);
  const [draftEditorText, setDraftEditorText] = useState(sampleWorld);
  const [draftPreview, setDraftPreview] = useState<WorldDraftPreview | null>(null);
  const [memoryPanel, setMemoryPanel] = useState<MemoryPanelPayload | null>(null);
  const [atlasTree, setAtlasTree] = useState<AtlasTreeNode[]>([]);
  const [atlasFile, setAtlasFile] = useState<AtlasFilePayload | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<MemorySelection | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [rewriteInstruction, setRewriteInstruction] = useState("强化冲突与对白");
  const [lensForm, setLensForm] = useState<LensFormState>(lensToForm({
    focusCharacterIds: ["苏雪"],
    style: "omniscient-web",
    stageRange: [],
    chapterGoal: "",
    sceneCount: 5,
    targetLength: [2800, 3300],
    factConstraint: "medium-expansion",
  }));
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
  const selectedScene =
    activeDraft?.sceneDrafts.find((scene) => scene.sceneId === selectedSceneId) ?? activeDraft?.sceneDrafts[0];
  const selectedLine = session?.simulation.selectedLine;
  const memoryDetail = pickMemoryDetail(memoryPanel, selectedMemory);
  const isDraftApplied = session ? draftEditorText === session.appliedDraftText : false;
  const runtimeDaemon = session?.runtimeDaemon;
  const runtimeStateLabel = runtimeDaemon?.active
    ? "running"
    : runtimeDaemon?.paused
      ? "paused"
      : runtimeDaemon?.failed
        ? "failed"
        : runtimeDaemon?.completed
          ? "completed"
          : "idle";

  const syncSession = (nextSession: WorkbenchSessionState, options?: { replaceEditor?: boolean }) => {
    startTransition(() => {
      setSession(nextSession);
      setLensForm(lensToForm(nextSession.lens));
      setAiSettingsForm((current) => ({
        ...aiSettingsToForm(nextSession.aiSettings),
        apiKey: current.apiKey,
      }));
      setSelectedSceneId(nextSession.selectedSceneId ?? nextSession.currentDraft?.sceneDrafts[0]?.sceneId ?? "");
      if (options?.replaceEditor) {
        setDraftEditorText(nextSession.appliedDraftText);
        setDraftPreview(nextSession.worldPreview);
      }
    });
  };

  async function refreshMemory(lineId?: string) {
    if (!session && !lineId) {
      return;
    }
    const payload = await workbenchApi.memory(lineId ?? session!.selectedLineId);
    setMemoryPanel(payload);
  }

  async function refreshAtlas(lineId?: string, preferredPath?: string) {
    if (!session && !lineId) {
      return;
    }
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
        if (cancelled) {
          return;
        }
        syncSession(nextSession, { replaceEditor: true });
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "无法加载 Studio 会话");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }
    if (workspace === "memory") {
      void refreshMemory();
    }
    if (workspace === "atlas") {
      void refreshAtlas();
    }
  }, [workspace, session?.selectedLineId]);

  useEffect(() => {
    if (!session?.runtimeDaemon?.active) {
      return;
    }
    const timer = window.setInterval(() => {
      void workbenchApi.runtimeStatus().then((response) => {
        syncSession(response.session);
        void refreshRuns();
      });
    }, 1200);
    return () => window.clearInterval(timer);
  }, [session?.runtimeDaemon?.active]);

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
      if (!session) {
        return;
      }
      const response = await workbenchApi.compose({
        lineId: session.selectedLineId,
        lens: buildLensRequest(lensForm),
      });
      syncSession(response.session);
    });
  }

  async function handleCritique() {
    await runAction("复核正文", async () => {
      if (!session?.currentDraft) {
        return;
      }
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
      if (!session?.currentDraft) {
        return;
      }
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
      if (!session?.currentDraft || !selectedSceneId || !rewriteInstruction.trim()) {
        return;
      }
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
      if (!session?.currentDraft) {
        return;
      }
      if (!window.confirm("确认将当前场景写入表达记忆，并触发当前历史线的 Atlas 编译？")) {
        return;
      }
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

  async function handleRunStage() {
    await runAction("推进阶段", async () => {
      const response = await workbenchApi.runStage({
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
      });
      syncSession(response.session);
      setWorkspace("simulation");
    });
  }

  async function handleRunAuto() {
    await runAction("连续自动推进", async () => {
      const response = await workbenchApi.runAuto({
        targetStageCount: Number(autoRunTarget) || 1,
        stageLabel: simulationForm.stageLabel.trim() || "自动推进",
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
      });
      syncSession(response.session);
      setWorkspace("simulation");
    });
  }

  async function refreshRuns() {
    const response = await workbenchApi.listRuns();
    setRuntimeRuns(response.runs);
  }

  async function runRuntimeTick() {
    await runAction("WorldDaemon Tick", async () => {
      setRuntimeBusy(true);
      try {
        const response = await workbenchApi.runDaemonTick({
          directive: {
            stageLabel: simulationForm.stageLabel.trim() || "世界自动推进",
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
          },
        });
        syncSession(response.session);
        await refreshRuns();
        setSelectedRun(await workbenchApi.getRunDetail(response.runId));
        setWorkspace("runtime");
      } finally {
        setRuntimeBusy(false);
      }
    });
  }

  function runtimeDirective() {
    return {
      stageLabel: simulationForm.stageLabel.trim() || "世界后台推演",
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

  async function syncRuntimeResponse(response: RuntimeDaemonResponse) {
    syncSession(response.session);
    await refreshRuns();
    const lastRunId = response.runtime.lastRunId ?? response.runtime.runIds.at(-1);
    if (lastRunId) {
      setSelectedRun(await workbenchApi.getRunDetail(lastRunId));
    }
  }

  async function handleStartRuntime() {
    await runAction("启动后台 Runtime", async () => {
      const response = await workbenchApi.startRuntime({
        targetTicks: Number(autoRunTarget) || 1,
        directive: runtimeDirective(),
      });
      await syncRuntimeResponse(response);
      setWorkspace("runtime");
    });
  }

  async function handlePauseRuntime() {
    await runAction("暂停后台 Runtime", async () => {
      const response = await workbenchApi.pauseRuntime();
      await syncRuntimeResponse(response);
      setWorkspace("runtime");
    });
  }

  async function handleResumeRuntime() {
    await runAction("恢复后台 Runtime", async () => {
      const response = await workbenchApi.resumeRuntime();
      await syncRuntimeResponse(response);
      setWorkspace("runtime");
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
      if (!window.confirm("清空后整个 Studio 会重新锁定，是否继续？")) {
        return;
      }
      const cleared = await workbenchApi.clearAiSettings();
      syncSession(cleared.session, { replaceEditor: true });
      setAiSettingsForm(aiSettingsToForm());
      setSettingsMessage("本机 DeepSeek 配置已清空，Studio 已重新锁定。");
      setShowSettings(false);
    });
  }

  async function handlePromoteBranch(branchId: string) {
    await runAction("扶正分叉", async () => {
      if (!window.confirm("确认将这条分叉扶正为当前正史？旧正史会被归档。")) {
        return;
      }
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
      if (!window.confirm("应用后会重建当前会话，并清空现有推演与写作上下文。是否继续？")) {
        return;
      }
      const response = await workbenchApi.applyWorld(draftEditorText);
      syncSession(response.session, { replaceEditor: true });
      setMemoryPanel(null);
      setAtlasTree([]);
      setAtlasFile(null);
      setSelectedMemory(null);
      setWorkspace("world");
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
      if (!session) {
        return;
      }
      const response = await workbenchApi.compileAtlas(session.selectedLineId);
      syncSession(response.session);
      await refreshAtlas(session.selectedLineId);
    });
  }

  function renderWritingWorkspace() {
    return (
      <section className="workspace-panel">
        <header className="panel-header home-header">
          <div>
            <p className="eyebrow">Writing Studio</p>
            <h1>从活动历史线直接生成章节，不让正文越界改史。</h1>
            <p className="panel-copy">
              这里把 line 选择、章节 lens、正文、critic 和局部重写放在同一条操作链上。写作层只消费
              已确认历史，不反向改写真相。
            </p>
          </div>
          <div className="action-group">
            <button onClick={handleCompose} disabled={pendingAction !== null}>
              生成章节
            </button>
            <button className="ghost" onClick={handleCritique} disabled={!activeDraft || pendingAction !== null}>
              重新复核
            </button>
          </div>
        </header>

        <section className="context-band">
          <div>
            <span className="context-label">当前阶段</span>
            <strong>{session?.selectedStageId ?? "尚未选择"}</strong>
          </div>
          <div>
            <span className="context-label">推荐分叉</span>
            <strong>
              {session?.simulation.latestBranchEvaluations.find((branch) => branch.recommended)?.title ?? "暂无"}
            </strong>
          </div>
          <div>
            <span className="context-label">世界压强</span>
            <strong>{activeDraft?.sourcePack.worldPressureSummary ?? "先运行推演或生成正文后可见"}</strong>
          </div>
        </section>

        <div className="section-grid writing-grid">
          <article className="studio-card compact-card">
            <div className="card-heading">
              <h2>历史线</h2>
              <span>{session?.simulation.lines.length ?? 0} 条</span>
            </div>
            <div className="line-switcher">
              {session?.simulation.lines.map((line) => (
                <button
                  key={line.lineId}
                  className={line.lineId === session.selectedLineId ? "active" : ""}
                  onClick={() => void handleSelectLine(line.lineId)}
                >
                  <span>{line.label}</span>
                  <small>{line.kind === "canon" ? "正史" : line.recommended ? "推荐分叉" : "分叉"}</small>
                </button>
              ))}
            </div>
          </article>

          <article className="studio-card compact-card">
            <div className="card-heading">
              <h2>章节 Lens</h2>
              <span>写作边界</span>
            </div>
            <div className="form-grid">
              <label>
                焦点角色
                <input
                  value={lensForm.focusCharacterIds}
                  onChange={(event) =>
                    setLensForm((current) => ({ ...current, focusCharacterIds: event.target.value }))
                  }
                />
              </label>
              <label>
                阶段
                <select
                  value={lensForm.stageId}
                  onChange={(event) => setLensForm((current) => ({ ...current, stageId: event.target.value }))}
                >
                  <option value="">自动</option>
                  {session?.simulation.stages.map((stage) => (
                    <option key={stage.canonStageId} value={stage.canonStageId}>
                      {stage.stageLabel}
                    </option>
                  ))}
                </select>
              </label>
              <label className="span-2">
                章节目标
                <input
                  value={lensForm.chapterGoal}
                  onChange={(event) => setLensForm((current) => ({ ...current, chapterGoal: event.target.value }))}
                />
              </label>
              <label>
                场景数
                <select
                  value={lensForm.sceneCount}
                  onChange={(event) =>
                    setLensForm((current) => ({ ...current, sceneCount: event.target.value as LensFormState["sceneCount"] }))
                  }
                >
                  <option value="3">3 场景</option>
                  <option value="4">4 场景</option>
                  <option value="5">5 beat</option>
                  <option value="6">6 beat</option>
                  <option value="7">7 beat</option>
                  <option value="8">8 beat</option>
                </select>
              </label>
              <label>
                事实约束
                <select
                  value={lensForm.factConstraint}
                  onChange={(event) =>
                    setLensForm((current) => ({
                      ...current,
                      factConstraint: event.target.value as "strict" | "medium-expansion",
                    }))
                  }
                >
                  <option value="medium-expansion">中度扩写</option>
                  <option value="strict">严格保真</option>
                </select>
              </label>
              <label>
                最小字数
                <input
                  value={lensForm.targetMin}
                  onChange={(event) => setLensForm((current) => ({ ...current, targetMin: event.target.value }))}
                />
              </label>
              <label>
                最大字数
                <input
                  value={lensForm.targetMax}
                  onChange={(event) => setLensForm((current) => ({ ...current, targetMax: event.target.value }))}
                />
              </label>
            </div>
          </article>
        </div>

        <div className="section-grid writing-main-grid">
          <article className="studio-card chapter-card">
            <div className="card-heading">
              <h2>{activeDraft?.plan.chapterTitle ?? activeDraft?.plan.chapterGoal ?? "尚未生成章节"}</h2>
              <span>{activeDraft ? `${activeDraft.chapterText.length} 字` : "等待生成"}</span>
            </div>
            <div className="summary-grid">
              <div>
                <span className="context-label">主冲突</span>
                <p>{activeDraft?.plan.mainConflict ?? "等待蓝图"}</p>
              </div>
              <div>
                <span className="context-label">副冲突</span>
                <p>{activeDraft?.plan.secondaryConflict ?? "等待蓝图"}</p>
              </div>
              <div>
                <span className="context-label">章末钩子</span>
                <p>{activeDraft?.plan.closingHook ?? "等待蓝图"}</p>
              </div>
            </div>

            <div className="scene-strip">
              {activeDraft?.sceneDrafts.map((scene) => (
                <button
                  key={scene.sceneId}
                  className={scene.sceneId === selectedSceneId ? "active" : ""}
                  onClick={() => setSelectedSceneId(scene.sceneId)}
                >
                  <span>{scene.title}</span>
                  <small>{scene.summary}</small>
                </button>
              ))}
            </div>

            <div className="scene-reader">
              <header>
                <h3>{selectedScene?.title ?? "选择一个场景"}</h3>
                <p>{selectedScene?.summary ?? "当前还没有可用场景。"}</p>
              </header>
              <pre>{selectedScene?.text ?? "先生成章节，再在这里查看正文。"} </pre>
            </div>
            <div className="scene-reader">
              <header>
                <h3>完整章节</h3>
                <p>{activeDraft ? `${activeDraft.sceneDrafts.length} 个场景已装配` : "等待场景草稿。"}</p>
              </header>
              <pre>{activeDraft?.chapterText ?? "所有场景写完后，在这里生成完整章节正文。"} </pre>
            </div>
          </article>

          <article className="studio-card compact-card">
            <div className="card-heading">
              <h2>局部重写与终稿</h2>
              <span>{activeDraft?.review.passed ? "Critic 已通过" : "待复核"}</span>
            </div>
            <label className="stacked-field">
              当前指令
              <textarea
                value={rewriteInstruction}
                onChange={(event) => setRewriteInstruction(event.target.value)}
              />
            </label>
            <div className="action-stack">
              <button onClick={handleAssembleChapter} disabled={!activeDraft || pendingAction !== null}>
                生成完整章节
              </button>
              <button onClick={handleRewrite} disabled={!selectedScene || pendingAction !== null}>
                只重写当前场景
              </button>
              <button className="ghost" onClick={handleConfirmFinal} disabled={!selectedScene || pendingAction !== null}>
                确认当前场景为作者终稿
              </button>
            </div>
            <div className="critic-panel">
              <h3>Critic 报告</h3>
              <ul className="plain-list">
                {activeDraft?.review.issues.map((issue) => <li key={issue}>{issue}</li>)}
                {activeDraft?.review.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                {activeDraft?.review.styleNotes.map((note) => <li key={note}>{note}</li>)}
                {!activeDraft && <li>生成正文后，这里会显示一致性、节奏和语言层反馈。</li>}
              </ul>
            </div>
          </article>
        </div>
      </section>
    );
  }

  function renderSimulationWorkspace() {
    return (
      <section className="workspace-panel">
        <header className="panel-header">
          <div>
            <p className="eyebrow">Simulation Console</p>
            <h1>推进阶段、比较分叉，并把值得的历史扶正。</h1>
          </div>
          <div className="action-group">
            <button className="ghost" onClick={handleRunAuto} disabled={pendingAction !== null}>
              {session?.simulationAutoRun?.active ? "继续下一阶段" : "开始连续推进"}
            </button>
            <button onClick={handleRunStage} disabled={pendingAction !== null}>
              运行新阶段
            </button>
          </div>
        </header>

        <div className="section-grid simulation-grid">
          <article className="studio-card compact-card">
            <div className="card-heading">
              <h2>阶段输入</h2>
              <span>世界先于叙事</span>
            </div>
            <div className="form-grid">
              <label>
                阶段名
                <input
                  value={simulationForm.stageLabel}
                  onChange={(event) =>
                    setSimulationForm((current) => ({ ...current, stageLabel: event.target.value }))
                  }
                />
              </label>
              <label>
                焦点角色
                <input
                  value={simulationForm.focusCharacterIds}
                  onChange={(event) =>
                    setSimulationForm((current) => ({ ...current, focusCharacterIds: event.target.value }))
                  }
                />
              </label>
              <label className="span-2">
                外部干预
                <textarea
                  value={simulationForm.intervention}
                  onChange={(event) =>
                    setSimulationForm((current) => ({ ...current, intervention: event.target.value }))
                  }
                />
              </label>
              <div className="span-2 details-wrap">
                <details>
                  <summary>高级设置：奇门覆写</summary>
                  <div className="form-grid nested-grid">
                    <label>
                      奇门局
                      <input
                        value={simulationForm.qimenPattern}
                        onChange={(event) =>
                          setSimulationForm((current) => ({ ...current, qimenPattern: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      空间焦点
                      <input
                        value={simulationForm.qimenLocationFocus}
                        onChange={(event) =>
                          setSimulationForm((current) => ({ ...current, qimenLocationFocus: event.target.value }))
                        }
                      />
                    </label>
                    <label className="span-2">
                      事件类型
                      <input
                        value={simulationForm.qimenEventType}
                        onChange={(event) =>
                          setSimulationForm((current) => ({ ...current, qimenEventType: event.target.value }))
                        }
                      />
                    </label>
                    <label className="checkbox-field span-2">
                      <input
                        type="checkbox"
                        checked={simulationForm.allowHardDecision}
                        onChange={(event) =>
                          setSimulationForm((current) => ({ ...current, allowHardDecision: event.target.checked }))
                        }
                      />
                      允许强局进入硬裁决
                    </label>
                  </div>
                </details>
              </div>
            </div>
          </article>

          <article className="studio-card compact-card">
            <div className="card-heading">
              <h2>连续自动推进</h2>
              <span>{session?.simulationAutoRun?.active ? "已停在审阅点" : "待启动"}</span>
            </div>
            <div className="form-grid">
              <label>
                目标阶段数
                <input value={autoRunTarget} onChange={(event) => setAutoRunTarget(event.target.value)} />
              </label>
              <div className="stacked-field">
                <span>当前进度</span>
                <strong>
                  {session?.simulationAutoRun
                    ? `${session.simulationAutoRun.completedStages}/${session.simulationAutoRun.targetStages}`
                    : "0/0"}
                </strong>
              </div>
              <div className="span-2 muted-block">
                {session?.simulationAutoRun?.active
                  ? `上一步已停在 ${session.simulationAutoRun.lastStageLabel ?? "当前阶段"}，可以先审阅结果，再继续下一阶段。`
                  : "自动推进会在后端推进到目标阶段数，遇到需要作者确认的 CanonGate 会停下。"}
              </div>
            </div>
          </article>

          <article className="studio-card">
            <div className="card-heading">
              <h2>阶段时间线</h2>
              <span>{session?.simulation.stages.length ?? 0} 个阶段</span>
            </div>
            <div className="timeline-list">
              {session?.simulation.stages.map((stage) => (
                <article className="timeline-item" key={stage.canonStageId}>
                  <header>
                    <div>
                      <strong>{stage.stageLabel}</strong>
                      <small>{stage.canonStageId}</small>
                    </div>
                    <span>{stage.focusCharacterIds.join("、")}</span>
                  </header>
                  {stage.intervention && <p className="muted-copy">{stage.intervention}</p>}
                  <table className="branch-table">
                    <thead>
                      <tr>
                        <th>分支</th>
                        <th>门槛</th>
                        <th>总分</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stage.branchEvaluations.map((branch) => (
                        <tr key={branch.branchId}>
                          <td>
                            <strong>{branch.title}</strong>
                            <small>{branch.recommended ? "推荐" : "观察线"}</small>
                          </td>
                          <td>{branch.passesConsistencyGate ? "通过" : "失真"}</td>
                          <td>{branch.scores.total.toFixed(1)}</td>
                          <td>
                            <div className="table-actions">
                              <button className="ghost" onClick={() => void handleSelectLine(branch.branchId)}>
                                跟拍
                              </button>
                              <button onClick={() => void handlePromoteBranch(branch.branchId)}>扶正</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </article>
              ))}
            </div>
          </article>
        </div>
      </section>
    );
  }

  function renderRuntimeWorkspace() {
    return (
      <section className="workspace-panel">
        <header className="panel-header">
          <div>
            <p className="eyebrow">Runtime Console</p>
            <h1>WorldDaemon 按 checkpoint 推进世界，并把每次 SimulationRun 留档。</h1>
          </div>
          <div className="action-group">
            <button className="ghost" onClick={() => void handleStartRuntime()} disabled={pendingAction !== null || runtimeDaemon?.active}>
              启动后台推演
            </button>
            <button className="ghost" onClick={() => void handlePauseRuntime()} disabled={pendingAction !== null || !runtimeDaemon?.active}>
              暂停
            </button>
            <button className="ghost" onClick={() => void handleResumeRuntime()} disabled={pendingAction !== null || !runtimeDaemon?.paused}>
              恢复
            </button>
            <button className="ghost" onClick={() => void refreshRuns()} disabled={pendingAction !== null}>
              刷新 Runs
            </button>
            <button className="ghost" onClick={() => void refreshRuntimeStatus()} disabled={pendingAction !== null}>
              刷新状态
            </button>
            <button onClick={() => void runRuntimeTick()} disabled={pendingAction !== null || runtimeBusy}>
              {runtimeBusy ? "Tick 中" : "Manual Tick"}
            </button>
          </div>
        </header>

        <div className="runtime-grid">
          <article className="studio-card compact-card">
            <div className="card-heading">
              <h2>Backend Runtime</h2>
              <span>{runtimeStateLabel}</span>
            </div>
            <dl className="compact-list">
              <dt>Progress</dt>
              <dd>
                {runtimeDaemon
                  ? `${runtimeDaemon.completedTicks}/${runtimeDaemon.targetTicks}`
                  : "0/0"}
              </dd>
              <dt>Last Stage</dt>
              <dd>{runtimeDaemon?.lastStageLabel ?? "none"}</dd>
              <dt>Pause</dt>
              <dd>{runtimeDaemon?.pauseReason ?? "none"}</dd>
              <dt>Autonomy</dt>
              <dd>never auto-promote</dd>
              <dt>Checkpoint</dt>
              <dd>every step</dd>
              <dt>World</dt>
              <dd>workbench-world</dd>
            </dl>
          </article>

          <article className="studio-card compact-card">
            <div className="card-heading">
              <h2>Simulation Runs</h2>
              <span>{runtimeRuns.length}</span>
            </div>
            <div className="run-list">
              {runtimeRuns.map((run) => (
                <button key={run.runId} onClick={() => void openRun(run.runId)}>
                  <span>{run.stageLabel}</span>
                  <small>
                    {run.status} · {run.stepCount} steps
                  </small>
                </button>
              ))}
              {runtimeRuns.length === 0 && <p className="empty-state">No runs yet.</p>}
            </div>
          </article>

          <article className="studio-card runtime-detail">
            <div className="card-heading">
              <h2>{selectedRun?.run.runId ?? "Run Detail"}</h2>
              <span>{selectedRun?.run.status ?? "none"}</span>
            </div>
            <pre className="json-preview">{selectedRun ? formatJson(selectedRun) : "Select or create a run."}</pre>
          </article>
        </div>
      </section>
    );
  }

  function renderWorldWorkspace() {
    const preview = draftPreview ?? session?.worldPreview;
    return (
      <section className="workspace-panel">
        <header className="panel-header">
          <div>
            <p className="eyebrow">World Draft</p>
            <h1>用 Markdown 编辑世界草案，再按需应用到当前会话。</h1>
          </div>
          <div className="action-group">
            <button className="ghost" onClick={() => setDraftEditorText(sampleWorld)}>
              加载示例
            </button>
            <button className="ghost" onClick={() => void handleResetWorld()}>
              重置编辑区
            </button>
            <button className="ghost" onClick={() => void handleWorldPreview()}>
              预览解析
            </button>
            <button onClick={() => void handleApplyWorld()}>应用到当前会话</button>
          </div>
        </header>

        <div className="section-grid world-grid">
          <article className="studio-card editor-card">
            <div className="card-heading">
              <h2>Markdown 草案</h2>
              <span>{isDraftApplied ? "已应用" : "未应用"}</span>
            </div>
            <textarea
              className="world-editor"
              value={draftEditorText}
              onChange={(event) => setDraftEditorText(event.target.value)}
            />
          </article>

          <article className="studio-card">
            <div className="card-heading">
              <h2>解析预览</h2>
              <span>
                {preview?.ok ? `${preview.counts.characters} 角色 / ${preview.counts.relationships} 关系` : "等待解析"}
              </span>
            </div>
            {!preview?.ok && <p className="error-copy">{preview?.error ?? "当前还没有可用预览。"}</p>}
            {preview?.ok && (
              <div className="world-preview">
                <section>
                  <h3>世界</h3>
                  <p>{preview.worldSpec?.genre}</p>
                  <p>{preview.worldSpec?.cultivationSystem}</p>
                  <ul className="plain-list">
                    {preview.worldSpec?.worldRules.map((rule) => <li key={rule}>{rule}</li>)}
                  </ul>
                </section>
                <section>
                  <h3>角色</h3>
                  <ul className="plain-list">
                    {preview.characters.map((character) => (
                      <li key={character.id}>
                        <strong>{character.name}</strong>
                        <span>{character.faction} · {character.role}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>关系</h3>
                  <ul className="plain-list">
                    {preview.relationships.map((relationship) => (
                      <li key={relationship.id}>
                        <strong>{relationship.left} / {relationship.right}</strong>
                        <span>{relationship.status}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3>锚点</h3>
                  <ul className="plain-list">
                    {preview.characterAnchors.map((anchor) => (
                      <li key={anchor.characterId}>
                        <strong>{anchor.characterId}</strong>
                        <span>{anchor.stageGoal}</span>
                      </li>
                    ))}
                  </ul>
                  <ul className="plain-list">
                    {preview.relationshipAnchors.map((anchor) => (
                      <li key={anchor.relationshipId}>
                        <strong>{anchor.relationshipId}</strong>
                        <span>{anchor.trend}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            )}
          </article>
        </div>
      </section>
    );
  }

  function renderMemoryWorkspace() {
    return (
      <section className="workspace-panel">
        <header className="panel-header">
          <div>
            <p className="eyebrow">Structured Memory</p>
            <h1>事实、表达、伏笔、修订，全部按当前历史线隔离展示。</h1>
          </div>
          <button className="ghost" onClick={() => void refreshMemory()}>
            刷新记忆
          </button>
        </header>

        <div className="memory-columns">
          <article className="studio-card compact-card">
            <div className="card-heading"><h2>事实</h2><span>{memoryPanel?.factEntries.length ?? 0}</span></div>
            <ul className="memory-list">
              {memoryPanel?.factEntries.map((entry) => (
                <li key={entry.id}>
                  <button onClick={() => setSelectedMemory({ kind: "fact", id: entry.id })}>{entry.summary}</button>
                </li>
              ))}
            </ul>
          </article>
          <article className="studio-card compact-card">
            <div className="card-heading"><h2>表达</h2><span>{memoryPanel?.expressionEntries.length ?? 0}</span></div>
            <ul className="memory-list">
              {memoryPanel?.expressionEntries.map((entry) => (
                <li key={entry.id}>
                  <button onClick={() => setSelectedMemory({ kind: "expression", id: entry.id })}>
                    {entry.summary}
                  </button>
                </li>
              ))}
            </ul>
          </article>
          <article className="studio-card compact-card">
            <div className="card-heading"><h2>伏笔</h2><span>{memoryPanel?.foreshadowEntries.length ?? 0}</span></div>
            <ul className="memory-list">
              {memoryPanel?.foreshadowEntries.map((entry) => (
                <li key={entry.id}>
                  <button onClick={() => setSelectedMemory({ kind: "foreshadow", id: entry.id })}>
                    {entry.summary}
                  </button>
                </li>
              ))}
            </ul>
          </article>
          <article className="studio-card compact-card">
            <div className="card-heading"><h2>修订</h2><span>{memoryPanel?.revisionEntries.length ?? 0}</span></div>
            <ul className="memory-list">
              {memoryPanel?.revisionEntries.map((entry) => (
                <li key={entry.id}>
                  <button onClick={() => setSelectedMemory({ kind: "revision", id: entry.id })}>{entry.summary}</button>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    );
  }

  function renderAtlasWorkspace() {
    return (
      <section className="workspace-panel">
        <header className="panel-header">
          <div>
            <p className="eyebrow">Atlas</p>
            <h1>浏览当前历史线的只读知识镜像，并手动触发编译。</h1>
          </div>
          <button onClick={() => void handleCompileAtlas()} disabled={pendingAction !== null}>
            编译当前历史线 Atlas
          </button>
        </header>

        <div className="section-grid atlas-grid">
          <article className="studio-card compact-card">
            <div className="card-heading">
              <h2>文件树</h2>
              <span>{atlasTree.length}</span>
            </div>
            <ul className="plain-list atlas-tree">
              {atlasTree.map((node) => (
                <li key={node.path}>
                  {node.kind === "file" ? (
                    <button
                      className={atlasFile?.path === node.path ? "active" : ""}
                      onClick={() =>
                        void runAction("加载 Atlas 文件", async () => {
                          if (!session) {
                            return;
                          }
                          setAtlasFile(await workbenchApi.atlasFile(session.selectedLineId, node.path));
                        })
                      }
                    >
                      {node.path}
                    </button>
                  ) : (
                    <span>{node.path}</span>
                  )}
                </li>
              ))}
            </ul>
          </article>
          <article className="studio-card">
            <div className="card-heading">
              <h2>{atlasFile?.path ?? "Markdown 预览"}</h2>
              <span>{session?.atlasUpdatedFiles.length ?? 0} 个最近更新</span>
            </div>
            <pre className="atlas-preview">{atlasFile?.content ?? "先编译或选择一个 Atlas 文件。"} </pre>
          </article>
        </div>
      </section>
    );
  }

  function renderInspector() {
    if (workspace === "writing") {
      return (
        <>
          <section className="inspector-card">
            <h2>硬事实</h2>
            <ul className="plain-list">
              {activeDraft?.sourcePack.hardFacts.map((fact) => <li key={fact}>{fact}</li>)}
              {!activeDraft && <li>生成正文后，这里会显示当前章节的硬事实。</li>}
            </ul>
          </section>
          <section className="inspector-card">
            <h2>禁止动作</h2>
            <ul className="plain-list">
              {activeDraft?.sourcePack.forbiddenMoves.map((move) => <li key={move}>{move}</li>)}
              {!activeDraft && <li>当前还没有可用的写作约束。</li>}
            </ul>
          </section>
        </>
      );
    }

    if (workspace === "simulation") {
      return (
        <>
          <section className="inspector-card">
            <h2>当前历史线</h2>
            <p>{selectedLine?.label ?? "未选中"}</p>
            <p>{selectedLine?.kind === "canon" ? "正史" : "分叉"}</p>
          </section>
          <section className="inspector-card">
            <h2>最近一次 AI 推演</h2>
            <p>{session?.latestSimulationRun?.summary ?? "当前还没有推演记录。"}</p>
            <p>
              {session?.latestSimulationRun?.requestMode ?? "未记录"} /{" "}
              {session?.latestSimulationRun?.finishReason ?? "未记录"}
            </p>
          </section>
          <section className="inspector-card">
            <h2>扶正记录</h2>
            <ul className="plain-list">
              {session?.simulation.branchHistory.map((entry) => (
                <li key={`${entry.branchId}-${entry.promotedAtStageId}`}>
                  {entry.branchId} · {entry.promotedAtStageId}
                </li>
              ))}
              {session?.simulation.branchHistory.length === 0 && <li>当前还没有扶正记录。</li>}
            </ul>
          </section>
        </>
      );
    }

    if (workspace === "runtime") {
      return (
        <>
          <section className="inspector-card">
            <h2>Run 状态</h2>
            <p>{selectedRun?.run.status ?? "未选择 run"}</p>
            <p>{selectedRun ? `${selectedRun.run.steps.length} steps` : "无 step"}</p>
          </section>
          <section className="inspector-card">
            <h2>Gate Decisions</h2>
            <pre>{formatJson(selectedRun?.gateDecisions ?? [])}</pre>
          </section>
        </>
      );
    }

    if (workspace === "world") {
      return (
        <>
          <section className="inspector-card">
            <h2>草案状态</h2>
            <p>{isDraftApplied ? "编辑器内容已应用到当前会话" : "编辑器内容尚未应用到当前会话"}</p>
          </section>
          <section className="inspector-card">
            <h2>预览统计</h2>
            <pre>{formatJson(draftPreview ?? session?.worldPreview ?? {})}</pre>
          </section>
        </>
      );
    }

    if (workspace === "memory") {
      return (
        <section className="inspector-card">
          <h2>条目详情</h2>
          <pre>{memoryDetail ? formatJson(memoryDetail) : "选择一条记忆条目后，这里会显示完整溯源。"} </pre>
        </section>
      );
    }

    return (
      <>
        <section className="inspector-card">
          <h2>最近更新</h2>
          <ul className="plain-list">
            {session?.atlasUpdatedFiles.map((file) => <li key={file}>{file}</li>)}
            {session?.atlasUpdatedFiles.length === 0 && <li>当前还没有 Atlas 编译输出。</li>}
          </ul>
        </section>
        <section className="inspector-card">
          <h2>文件详情</h2>
          <pre>{atlasFile ? formatJson(atlasFile) : "选择一个 Atlas 文件后，这里会显示元信息。"} </pre>
        </section>
      </>
    );
  }

  function renderAiSettingsPanel() {
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
              value={aiSettingsForm.apiKey}
              onChange={(event) => setAiSettingsForm((current) => ({ ...current, apiKey: event.target.value }))}
            />
          </label>
          <label className="span-2">
            Base URL
            <input
              value={aiSettingsForm.baseUrl}
              onChange={(event) => setAiSettingsForm((current) => ({ ...current, baseUrl: event.target.value }))}
            />
          </label>
          <label>
            Model
            <input
              value={aiSettingsForm.model}
              onChange={(event) => setAiSettingsForm((current) => ({ ...current, model: event.target.value }))}
            />
          </label>
          <label>
            Timeout (ms)
            <input
              value={aiSettingsForm.timeoutMs}
              onChange={(event) => setAiSettingsForm((current) => ({ ...current, timeoutMs: event.target.value }))}
            />
          </label>
          <label>
            Thinking
            <select
              value={aiSettingsForm.thinkingMode}
              onChange={(event) =>
                setAiSettingsForm((current) => ({
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
              value={aiSettingsForm.reasoningEffort}
              onChange={(event) =>
                setAiSettingsForm((current) => ({
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
              value={aiSettingsForm.contextWindowTokens}
              onChange={(event) =>
                setAiSettingsForm((current) => ({ ...current, contextWindowTokens: event.target.value }))
              }
            />
          </label>
          <label>
            Max output tokens
            <input
              value={aiSettingsForm.maxOutputTokens}
              onChange={(event) =>
                setAiSettingsForm((current) => ({ ...current, maxOutputTokens: event.target.value }))
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
          <button onClick={() => void handleSaveAiSettings()} disabled={pendingAction !== null}>
            保存并校验
          </button>
          {session?.aiSettings?.configured && (
            <button className="ghost" onClick={() => void handleClearAiSettings()} disabled={pendingAction !== null}>
              清空设置
            </button>
          )}
          <button className="ghost" onClick={() => setShowSettings(false)}>
            关闭
          </button>
        </div>
      </div>
    );
  }

  function renderLockedState() {
    return (
      <div className="locked-shell">
        <section className="locked-card">
          <p className="eyebrow">DeepSeek Required</p>
          <h1>先配置 DeepSeek，Studio 才会解锁。</h1>
          <p className="panel-copy">
            这个工作台现在已经改成 AI 主导全流程。没有有效的 API key，写作、推演、分叉评估和自动推进都不会开放。
          </p>
          {renderAiSettingsPanel()}
        </section>
      </div>
    );
  }

  if (isLoading) {
    return <div className="loading-shell">正在载入作者 Studio…</div>;
  }

  if (session?.locked) {
    return (
      <div className="studio-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">World History Engine / Studio</p>
            <strong>世界史真相核与中文修仙写作台</strong>
          </div>
          <div className="topbar-meta">
            <span>Studio 已锁定</span>
            <span>{session.aiSettings?.configured ? "已保存配置" : "未配置 AI"}</span>
          </div>
        </header>
        {error && <div className="error-banner">{error}</div>}
        {pendingAction && <div className="status-banner">处理中：{pendingAction}</div>}
        {settingsMessage && <div className="status-banner">{settingsMessage}</div>}
        {renderLockedState()}
      </div>
    );
  }

  return (
    <div className="studio-shell">
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
          <button className="ghost" onClick={() => setShowSettings((current) => !current)}>
            AI 设置
          </button>
        </div>
      </header>

      <div className="studio-frame">
        <nav className="rail">
          {WORKSPACES.map((item) => (
            <button
              key={item.id}
              className={workspace === item.id ? "active" : ""}
              onClick={() => {
                setWorkspace(item.id);
                if (item.id === "runtime") {
                  void refreshRuns();
                }
              }}
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
            </button>
          ))}
        </nav>

        <main className="main-stage">
          {error && <div className="error-banner">{error}</div>}
          {pendingAction && <div className="status-banner">处理中：{pendingAction}</div>}
          {settingsMessage && <div className="status-banner">{settingsMessage}</div>}
          {workspace === "writing" && renderWritingWorkspace()}
          {workspace === "simulation" && renderSimulationWorkspace()}
          {workspace === "runtime" && renderRuntimeWorkspace()}
          {workspace === "world" && renderWorldWorkspace()}
          {workspace === "memory" && renderMemoryWorkspace()}
          {workspace === "atlas" && renderAtlasWorkspace()}
        </main>

        <aside className="inspector">
          {showSettings ? renderAiSettingsPanel() : renderInspector()}
        </aside>
      </div>
    </div>
  );
}
