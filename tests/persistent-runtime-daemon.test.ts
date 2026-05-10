import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
  NovelRuntimeKernel,
  PersistentRuntimeDaemon,
  SimulationRunStore,
  WorldHistoryEngine,
  parseWorldDraft,
} from "../src/index";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const daemonDraft = `
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

describe("PersistentRuntimeDaemon", () => {
  test("continues through multiple ticks without another frontend call", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "novel-persistent-runtime-"));
    tempDirs.push(rootDir);
    const engine = new WorldHistoryEngine(parseWorldDraft(daemonDraft));
    const runStore = new SimulationRunStore({ rootDir });
    const kernel = new NovelRuntimeKernel({
      engine,
      runStore,
      config: {
        worldId: "persistent-runtime-world",
        tickPolicy: { mode: "manual", maxTicksPerRun: 1 },
        autonomy: {
          autoPromote: "never",
          requireAuthorOnCanonRisk: false,
          requireAuthorOnHardDecision: true,
        },
        storage: { runRoot: rootDir, checkpointEveryStep: true },
      },
    });
    const daemon = new PersistentRuntimeDaemon({
      kernel,
      defaultDirective: { stageLabel: "后台持续推演", focusCharacterIds: ["林焰"] },
    });

    daemon.start({
      targetTicks: 3,
      reason: "scheduled",
      requestedBy: "daemon",
      directive: { stageLabel: "后台持续推演", focusCharacterIds: ["林焰"] },
    });
    const snapshot = await daemon.waitForIdle();

    expect(snapshot.completed).toBe(true);
    expect(snapshot.completedTicks).toBe(3);
    expect(snapshot.runIds).toHaveLength(3);
    expect(engine.getCanonLine().stages).toHaveLength(3);
  });

  test("pauses when CanonGate requires author action", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "novel-persistent-runtime-gate-"));
    tempDirs.push(rootDir);
    const engine = new WorldHistoryEngine(parseWorldDraft(daemonDraft));
    const runStore = new SimulationRunStore({ rootDir });
    const kernel = new NovelRuntimeKernel({
      engine,
      runStore,
      config: {
        worldId: "persistent-runtime-world",
        tickPolicy: { mode: "manual", maxTicksPerRun: 1 },
        autonomy: {
          autoPromote: "never",
          requireAuthorOnCanonRisk: true,
          requireAuthorOnHardDecision: true,
        },
        storage: { runRoot: rootDir, checkpointEveryStep: true },
      },
    });
    const daemon = new PersistentRuntimeDaemon({
      kernel,
      defaultDirective: { stageLabel: "后台持续推演", focusCharacterIds: ["林焰"] },
    });

    daemon.start({
      targetTicks: 3,
      reason: "scheduled",
      requestedBy: "daemon",
      directive: {
        stageLabel: "后台高风险推演",
        focusCharacterIds: ["林焰"],
        qimenOverride: {
          pattern: "开门强局",
          locationFocus: "外门山城",
          eventType: "危机爆发",
          strongSituationScore: 3,
          allowHardDecision: true,
        },
      },
    });
    const snapshot = await daemon.waitForIdle();

    expect(snapshot.active).toBe(false);
    expect(snapshot.paused).toBe(true);
    expect(snapshot.completedTicks).toBe(0);
    expect(snapshot.runIds).toHaveLength(1);
    expect(snapshot.pauseReason).toContain("CanonGate");
    expect(engine.getCanonLine().stages).toHaveLength(1);
  });
});
