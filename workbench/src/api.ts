import type {
  ApplyWorldDraftRequest,
  AtlasFilePayload,
  AtlasTreeNode,
  ComposeResponse,
  ConfirmAuthorFinalRequest,
  ConfirmFinalResponse,
  MemoryPanelPayload,
  PromoteBranchRequest,
  ListRunsResponse,
  RunDaemonTickRequest,
  RunDaemonTickResponse,
  RuntimeDaemonResponse,
  RuntimeStartRequest,
  RunDetailResponse,
  RunAutoStagesRequest,
  RunStageRequest,
  SaveAiSettingsRequest,
  WorkbenchRequest,
  WorkbenchSessionState,
  WorldDraftPreview,
} from "./contracts";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json()) as T | { error?: string };
  if (!response.ok) {
    const errorPayload = payload && typeof payload === "object" ? (payload as { error?: string }) : {};
    throw new Error(errorPayload.error ? errorPayload.error : `Request failed: ${response.status}`);
  }
  return payload as T;
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const workbenchApi = {
  session() {
    return requestJson<WorkbenchSessionState>("/api/session");
  },
  parseWorld(draftText: string) {
    return postJson<{ draftText: string; preview: WorldDraftPreview }>("/api/world/parse", { draftText });
  },
  applyWorld(draftText: string | ApplyWorldDraftRequest) {
    const request = typeof draftText === "string" ? { draftText } : draftText;
    return postJson<{ session: WorkbenchSessionState }>("/api/world/apply", request);
  },
  resetWorld() {
    return postJson<{ draftText: string; preview: WorldDraftPreview }>("/api/world/reset", {});
  },
  compose(request: WorkbenchRequest) {
    return postJson<ComposeResponse>("/api/writing/compose", request);
  },
  assemble(request: WorkbenchRequest) {
    return postJson<ComposeResponse>("/api/writing/assemble", request);
  },
  critique(request: WorkbenchRequest) {
    return postJson<ComposeResponse>("/api/writing/critique", request);
  },
  rewrite(request: WorkbenchRequest) {
    return postJson<ComposeResponse>("/api/writing/rewrite", request);
  },
  confirmFinal(request: ConfirmAuthorFinalRequest) {
    return postJson<ConfirmFinalResponse>("/api/writing/confirm-final", request);
  },
  runStage(request: RunStageRequest) {
    return postJson<{ result: unknown; runRecord?: unknown; session: WorkbenchSessionState }>("/api/simulation/run-stage", request);
  },
  runAuto(request: RunAutoStagesRequest) {
    return postJson<{
      result?: unknown;
      autoRun: NonNullable<WorkbenchSessionState["simulationAutoRun"]>;
      session: WorkbenchSessionState;
    }>("/api/simulation/run-auto", request);
  },
  runDaemonTick(request: RunDaemonTickRequest) {
    return postJson<RunDaemonTickResponse>("/api/runtime/tick", request);
  },
  startRuntime(request: RuntimeStartRequest) {
    return postJson<RuntimeDaemonResponse>("/api/runtime/start", request);
  },
  pauseRuntime() {
    return postJson<RuntimeDaemonResponse>("/api/runtime/pause", {});
  },
  resumeRuntime() {
    return postJson<RuntimeDaemonResponse>("/api/runtime/resume", {});
  },
  runtimeStatus() {
    return requestJson<RuntimeDaemonResponse>("/api/runtime/status");
  },
  listRuns() {
    return requestJson<ListRunsResponse>("/api/runs");
  },
  getRunDetail(runId: string) {
    return requestJson<RunDetailResponse>(`/api/runs/${encodeURIComponent(runId)}`);
  },
  selectLine(lineId: string) {
    return postJson<{ session: WorkbenchSessionState }>("/api/simulation/select-line", { lineId });
  },
  promoteBranch(branchId: string | PromoteBranchRequest) {
    const request = typeof branchId === "string" ? { branchId } : branchId;
    return postJson<{ session: WorkbenchSessionState }>("/api/simulation/promote-branch", request);
  },
  memory(lineId?: string) {
    return requestJson<MemoryPanelPayload>(`/api/memory${query({ lineId })}`);
  },
  compileAtlas(lineId?: string) {
    return postJson<{ lineId: string; updatedFiles: string[]; session: WorkbenchSessionState }>("/api/atlas/compile", {
      lineId,
    });
  },
  atlasTree(lineId?: string) {
    return requestJson<{ lineId: string; tree: AtlasTreeNode[] }>(`/api/atlas/tree${query({ lineId })}`);
  },
  atlasFile(lineId: string | undefined, path: string) {
    return requestJson<AtlasFilePayload>(`/api/atlas/file${query({ lineId, path })}`);
  },
  validateAiSettings(request: SaveAiSettingsRequest) {
    return postJson<{
      settings: unknown;
      validation: { ok: true; model: string; requestMode: "plain-text"; finishReason: string };
    }>("/api/settings/ai/validate", request);
  },
  saveAiSettings(request: SaveAiSettingsRequest) {
    return postJson<{ settings: unknown; session: WorkbenchSessionState }>("/api/settings/ai", request);
  },
  clearAiSettings() {
    return requestJson<{ settings: unknown; session: WorkbenchSessionState }>("/api/settings/ai", { method: "DELETE" });
  },
};
