import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test } from "vitest";

import { LocalCharacterAgentProvider } from "../src/agents/provider";
import { WorldDaemon, WorldHistoryEngine, parseWorldDraft } from "../src/index";
import { buildMetaphysicsFrame } from "../src/metaphysics/frame";
import { SimulationRunStore } from "../src/run-store";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

test("local character agent emits candidates without canon write permission", () => {
  const parsed = parseWorldDraft(daemonDraft);
  const frame = buildMetaphysicsFrame({
    runId: "run-agent",
    parsed,
    stageNumber: 1,
    directive: { stageLabel: "外门试炼", focusCharacterIds: ["林焰"] },
  });
  const provider = new LocalCharacterAgentProvider();
  const candidates = provider.generateCandidates({
    parsed,
    frame,
    directive: { stageLabel: "外门试炼", focusCharacterIds: ["林焰"] },
  });

  expect(candidates[0].characterId).toBe("林焰");
  expect(candidates[0].violatesKnownAnchor).toBe(false);
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

describe("WorldDaemon", () => {
  test("runs a manual tick and persists a completed run", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "novel-daemon-"));
    tempDirs.push(rootDir);
    const runStore = new SimulationRunStore({ rootDir });
    const daemon = new WorldDaemon({
      engine: new WorldHistoryEngine(parseWorldDraft(daemonDraft)),
      runStore,
      config: {
        worldId: "daemon-world",
        tickPolicy: { mode: "manual", maxTicksPerRun: 1 },
        autonomy: {
          autoPromote: "never",
          requireAuthorOnCanonRisk: false,
          requireAuthorOnHardDecision: true,
        },
        storage: { runRoot: rootDir, checkpointEveryStep: true },
      },
    });

    const result = await daemon.tick({
      reason: "manual",
      requestedBy: "test",
      directive: { stageLabel: "外门试炼", focusCharacterIds: ["林焰"] },
    });

    expect(result.status).toBe("completed");
    const runs = await runStore.listRuns();
    expect(runs[0].runId).toBe(result.runId);
  });

  test("pauses when CanonGate asks for author action", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "novel-daemon-"));
    tempDirs.push(rootDir);
    const runStore = new SimulationRunStore({ rootDir });
    const daemon = new WorldDaemon({
      engine: new WorldHistoryEngine(parseWorldDraft(daemonDraft)),
      runStore,
      config: {
        worldId: "daemon-world",
        tickPolicy: { mode: "manual", maxTicksPerRun: 1 },
        autonomy: {
          autoPromote: "never",
          requireAuthorOnCanonRisk: true,
          requireAuthorOnHardDecision: true,
        },
        storage: { runRoot: rootDir, checkpointEveryStep: true },
      },
    });

    const result = await daemon.tick({
      reason: "manual",
      requestedBy: "test",
      directive: {
        stageLabel: "外门试炼",
        focusCharacterIds: ["林焰"],
        qimenOverride: {
          pattern: "惊门迫宫",
          locationFocus: "外门山城",
          eventType: "危机爆发",
          strongSituationScore: 3,
          allowHardDecision: true,
        },
      },
    });

    if (result.status === "paused") {
      const resumed = await daemon.resume(result.runId);
      expect(resumed.status).toBe("completed");
    } else {
      expect(result.status).toBe("completed");
    }
  });

  test("propagates author-gate policy into high-risk CanonGate decisions", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "novel-daemon-gate-"));
    tempDirs.push(rootDir);
    const runStore = new SimulationRunStore({ rootDir });
    const daemon = new WorldDaemon({
      engine: new WorldHistoryEngine(parseWorldDraft(daemonDraft)),
      runStore,
      config: {
        worldId: "daemon-world",
        tickPolicy: { mode: "manual", maxTicksPerRun: 1 },
        autonomy: {
          autoPromote: "never",
          requireAuthorOnCanonRisk: true,
          requireAuthorOnHardDecision: true,
        },
        storage: { runRoot: rootDir, checkpointEveryStep: true },
      },
    });

    const result = await daemon.tick({
      reason: "manual",
      requestedBy: "test",
      directive: {
        stageLabel: "外门试炼",
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

    expect(result.status).toBe("paused");
    expect(result.canonDecision?.result).toBe("ask-author");
    const run = await runStore.loadRun(result.runId);
    expect(run.status).toBe("paused");
  });
});
