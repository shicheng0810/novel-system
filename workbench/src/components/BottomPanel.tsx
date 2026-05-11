import type { RunDetailResponse, SimulationRunSummary, WorkbenchSessionState } from "../contracts";
import type { BottomPanelTab, UIState } from "../store";

export type SimulationFormState = {
  stageLabel: string;
  focusCharacterIds: string;
  intervention: string;
  qimenPattern: string;
  qimenLocationFocus: string;
  qimenEventType: string;
  allowHardDecision: boolean;
};

type BottomPanelProps = {
  ui: UIState;
  setUI: (updater: (current: UIState) => UIState) => void;
  session: WorkbenchSessionState | null;
  // Simulation
  simulationForm: SimulationFormState;
  setSimulationForm: (updater: (current: SimulationFormState) => SimulationFormState) => void;
  autoRunTarget: string;
  setAutoRunTarget: (value: string) => void;
  pendingAction: string | null;
  onRunStage: () => void;
  onRunAuto: () => void;
  onPromoteBranch: (branchId: string) => void;
  onSelectLine: (lineId: string) => void;
  // Runtime
  runs: SimulationRunSummary[];
  selectedRun: RunDetailResponse | null;
  runtimeBusy: boolean;
  onStartRuntime: () => void;
  onPauseRuntime: () => void;
  onResumeRuntime: () => void;
  onRefreshRuns: () => void;
  onRefreshRuntimeStatus: () => void;
  onRunTick: () => void;
  onOpenRun: (runId: string) => void;
};

const TABS: Array<{ id: BottomPanelTab; label: string }> = [
  { id: "simulation", label: "推演" },
  { id: "ticks", label: "Runtime" },
];

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function BottomPanel(props: BottomPanelProps) {
  const { ui, setUI, session } = props;
  const daemon = session?.runtimeDaemon;
  const stageCount = session?.simulation.stages.length ?? 0;
  const recommended = session?.simulation.latestBranchEvaluations.find((b) => b.recommended);

  const collapsedSummary = daemon?.active
    ? `推演 · ${daemon.completedTicks}/${daemon.targetTicks} ticks · ${daemon.lastStageLabel ?? "运行中"}`
    : `推演 · ${stageCount} 阶段${recommended ? ` · ★ ${recommended.title}` : ""}`;

  function togglePanel() {
    setUI((current) => ({ ...current, bottomPanelOpen: !current.bottomPanelOpen }));
  }

  if (!ui.bottomPanelOpen) {
    return (
      <section className="bottom-panel collapsed">
        <button className="bottom-panel-header" onClick={togglePanel}>
          <span>{collapsedSummary}</span>
          <span className="bottom-panel-toggle">展开 ▲</span>
        </button>
      </section>
    );
  }

  return (
    <section className="bottom-panel open">
      <header className="bottom-panel-header bottom-panel-header-open">
        <nav className="bottom-panel-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={ui.bottomPanelTab === tab.id ? "active" : ""}
              onClick={() => setUI((current) => ({ ...current, bottomPanelTab: tab.id }))}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <button className="ghost" onClick={togglePanel}>
          折叠 ▼
        </button>
      </header>

      {ui.bottomPanelTab === "simulation" && <SimulationBody {...props} />}
      {ui.bottomPanelTab === "ticks" && <RuntimeBody {...props} />}
    </section>
  );
}

function SimulationBody(props: BottomPanelProps) {
  const {
    session,
    simulationForm,
    setSimulationForm,
    autoRunTarget,
    setAutoRunTarget,
    pendingAction,
    onRunStage,
    onRunAuto,
    onPromoteBranch,
    onSelectLine,
  } = props;

  return (
    <div className="bottom-panel-body simulation-body">
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
        <div className="action-stack">
          <button className="ghost" onClick={onRunAuto} disabled={pendingAction !== null}>
            {session?.simulationAutoRun?.active ? "继续下一阶段" : "开始连续推进"}
          </button>
          <button onClick={onRunStage} disabled={pendingAction !== null}>
            运行新阶段
          </button>
          <label className="inline-target">
            目标
            <input value={autoRunTarget} onChange={(event) => setAutoRunTarget(event.target.value)} />
          </label>
          <span className="codex-meta">
            {session?.simulationAutoRun
              ? `${session.simulationAutoRun.completedStages}/${session.simulationAutoRun.targetStages}`
              : "0/0"}
          </span>
        </div>
      </article>

      <article className="studio-card timeline-card">
        <div className="card-heading">
          <h2>阶段时间线</h2>
          <span>{session?.simulation.stages.length ?? 0} 阶段</span>
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
                          <button className="ghost" onClick={() => onSelectLine(branch.branchId)}>
                            跟拍
                          </button>
                          <button onClick={() => onPromoteBranch(branch.branchId)}>扶正</button>
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
  );
}

function RuntimeBody(props: BottomPanelProps) {
  const {
    session,
    runs,
    selectedRun,
    runtimeBusy,
    pendingAction,
    onStartRuntime,
    onPauseRuntime,
    onResumeRuntime,
    onRefreshRuns,
    onRefreshRuntimeStatus,
    onRunTick,
    onOpenRun,
  } = props;

  const daemon = session?.runtimeDaemon;
  const runtimeStateLabel = daemon?.active
    ? "running"
    : daemon?.paused
      ? "paused"
      : daemon?.failed
        ? "failed"
        : daemon?.completed
          ? "completed"
          : "idle";

  return (
    <div className="bottom-panel-body runtime-body">
      <article className="studio-card compact-card">
        <div className="card-heading">
          <h2>Backend Runtime</h2>
          <span>{runtimeStateLabel}</span>
        </div>
        <dl className="compact-list">
          <dt>Progress</dt>
          <dd>{daemon ? `${daemon.completedTicks}/${daemon.targetTicks}` : "0/0"}</dd>
          <dt>Last Stage</dt>
          <dd>{daemon?.lastStageLabel ?? "none"}</dd>
          <dt>Pause</dt>
          <dd>{daemon?.pauseReason ?? "none"}</dd>
        </dl>
        <div className="action-stack">
          <button className="ghost" onClick={onStartRuntime} disabled={pendingAction !== null || daemon?.active}>
            启动
          </button>
          <button className="ghost" onClick={onPauseRuntime} disabled={pendingAction !== null || !daemon?.active}>
            暂停
          </button>
          <button className="ghost" onClick={onResumeRuntime} disabled={pendingAction !== null || !daemon?.paused}>
            恢复
          </button>
          <button className="ghost" onClick={onRefreshRuns} disabled={pendingAction !== null}>
            刷新 Runs
          </button>
          <button className="ghost" onClick={onRefreshRuntimeStatus} disabled={pendingAction !== null}>
            刷新状态
          </button>
          <button onClick={onRunTick} disabled={pendingAction !== null || runtimeBusy}>
            {runtimeBusy ? "Tick 中" : "Manual Tick"}
          </button>
        </div>
      </article>

      <article className="studio-card compact-card">
        <div className="card-heading">
          <h2>Simulation Runs</h2>
          <span>{runs.length}</span>
        </div>
        <div className="run-list">
          {runs.map((run) => (
            <button key={run.runId} onClick={() => onOpenRun(run.runId)}>
              <span>{run.stageLabel}</span>
              <small>
                {run.status} · {run.stepCount} steps
              </small>
            </button>
          ))}
          {runs.length === 0 && <p className="empty-state">No runs yet.</p>}
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
  );
}
