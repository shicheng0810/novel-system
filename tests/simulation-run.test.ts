import { mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test } from "vitest";

import { WorldHistoryEngine, buildSimulationJob, parseWorldDraft } from "../src/index";
import type { ArtifactRef, SimulationRun, SimulationStep } from "../src/runtime-types";
import { SimulationRunStore } from "../src/run-store";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("runtime types", () => {
  test("describe simulation runs with artifact references", () => {
    const artifact: ArtifactRef = {
      refId: "input.directive",
      path: ".novel-system/runs/run-1/input/directive.json",
      kind: "json",
    };

    const step: SimulationStep = {
      stepId: "step-1",
      kind: "load-context",
      status: "completed",
      startedAt: "2026-05-08T00:00:00.000Z",
      endedAt: "2026-05-08T00:00:01.000Z",
      inputRefs: [],
      outputRefs: [artifact.refId],
    };

    const run: SimulationRun = {
      runId: "run-1",
      worldId: "default-world",
      lineId: "canon",
      status: "running",
      createdAt: "2026-05-08T00:00:00.000Z",
      updatedAt: "2026-05-08T00:00:01.000Z",
      directive: { stageLabel: "丹谷风波", focusCharacterIds: ["苏雪"] },
      steps: [step],
      artifacts: {
        rootDir: ".novel-system/runs/run-1",
        refs: [artifact],
      },
    };

    expect(run.artifacts.refs[0].kind).toBe("json");
  });
});

describe("SimulationRunStore", () => {
  test("creates immutable run roots and persists manifest artifacts", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "novel-runs-"));
    tempDirs.push(rootDir);

    const store = new SimulationRunStore({ rootDir });
    const run = await store.createRun({
      worldId: "world-a",
      lineId: "canon",
      directive: { stageLabel: "丹谷风波", focusCharacterIds: ["苏雪"] },
    });

    expect(run.runId).toMatch(/^run-/);
    expect(run.artifacts.rootDir).toContain(run.runId);

    const loaded = await store.loadRun(run.runId);
    expect(loaded.directive.stageLabel).toBe("丹谷风波");

    const manifest = JSON.parse(readFileSync(join(run.artifacts.rootDir, "manifest.json"), "utf8"));
    expect(manifest.runId).toBe(run.runId);
  });
});

const storeDraft = `
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

test("SimulationJob persists a run when a store is provided", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "novel-runs-"));
  tempDirs.push(rootDir);
  const runStore = new SimulationRunStore({ rootDir });
  const engine = new WorldHistoryEngine(parseWorldDraft(storeDraft));
  const job = buildSimulationJob({
    engine,
    directives: [{ stageLabel: "外门试炼", focusCharacterIds: ["林焰"] }],
    runStore,
    worldId: "test-world",
  });

  const result = await job.run();
  expect(result.runRecords[0].outputRef).toMatch(/^run-/);

  const runs = await runStore.listRuns();
  expect(runs).toHaveLength(1);
  expect(runs[0].stageLabel).toBe("外门试炼");
});
