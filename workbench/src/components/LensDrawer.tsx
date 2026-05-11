import type { WorkbenchSessionState } from "../contracts";

export type LensFormState = {
  focusCharacterIds: string;
  stageId: string;
  chapterGoal: string;
  sceneCount: "3" | "4" | "5" | "6" | "7" | "8";
  targetMin: string;
  targetMax: string;
  factConstraint: "strict" | "medium-expansion";
};

type LensDrawerProps = {
  lensForm: LensFormState;
  setLensForm: (updater: (current: LensFormState) => LensFormState) => void;
  session: WorkbenchSessionState | null;
  open: boolean;
  onToggle: () => void;
};

export function LensDrawer({ lensForm, setLensForm, session, open, onToggle }: LensDrawerProps) {
  return (
    <article className={`studio-card compact-card lens-drawer ${open ? "open" : "collapsed"}`}>
      <div className="card-heading">
        <h2>章节 Lens</h2>
        <button className="ghost lens-toggle" onClick={onToggle} title="折叠 / 展开">
          {open ? "收起 ▲" : "📐 调参"}
        </button>
      </div>
      {open && (
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
                setLensForm((current) => ({
                  ...current,
                  sceneCount: event.target.value as LensFormState["sceneCount"],
                }))
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
      )}
    </article>
  );
}
