import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { NovelRuntimeKernel, SimulationRunStore, WorldHistoryEngine, parseWorldDraft } from "../src/index";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const draft = `
# 世界设定
题材：东方玄幻
时间尺度：阶段
修炼体系：灵海
世界规则：
- 玄脉共鸣会放大角色的欲望

# 势力
- 青岳宗：正宗

# 地点
- 外门山城：试炼地

# 角色
- 林焰 | faction=青岳宗 | role=外门弟子 | traits=倔强 | goal=突破 | stance=守宗 | resource=残图

# 关系

# 单角色锚点
- 林焰 | cannot=提前死亡 | must_trend=在压力中成长 | stage_goal=接近真传名额

# 关系锚点
`;

describe("NovelRuntimeKernel", () => {
  test("runs a tick through the runtime session and writes trace artifacts", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "novel-runtime-"));
    tempDirs.push(rootDir);
    const runStore = new SimulationRunStore({ rootDir });
    const kernel = new NovelRuntimeKernel({
      engine: new WorldHistoryEngine(parseWorldDraft(draft)),
      runStore,
      config: {
        worldId: "runtime-world",
        tickPolicy: { mode: "manual", maxTicksPerRun: 1 },
        autonomy: {
          autoPromote: "never",
          requireAuthorOnCanonRisk: false,
          requireAuthorOnHardDecision: true,
        },
        storage: { runRoot: rootDir, checkpointEveryStep: true },
      },
    });

    const result = await kernel.tick({
      reason: "manual",
      requestedBy: "test",
      directive: { stageLabel: "外门试炼", focusCharacterIds: ["林焰"] },
    });

    expect(result.status).toBe("completed");
    expect(kernel.inspectSession().packId).toBeDefined();
    const run = await runStore.loadRun(result.runId);
    const traceRef = run.artifacts.refs.find((ref) => ref.refId === "runtime.trace");
    const syncRef = run.artifacts.refs.find((ref) => ref.refId === "runtime.context-sync");
    expect(traceRef).toBeDefined();
    expect(syncRef).toBeDefined();
    const trace = await readFile(traceRef!.path, "utf8");
    expect(trace).toContain("session-sync");
  });
});
