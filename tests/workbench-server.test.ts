import { mkdtempSync, readFileSync } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test, vi } from "vitest";

import { createWorkbenchApiHandlers } from "../workbench/src/server";
import { sampleWorld } from "../workbench/src/sampleWorld";
import { LocalWritingModelProvider } from "../src/index";

const tempDirs: string[] = [];
const originalLocalAppData = process.env.LOCALAPPDATA;

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  if (originalLocalAppData === undefined) {
    delete process.env.LOCALAPPDATA;
  } else {
    process.env.LOCALAPPDATA = originalLocalAppData;
  }
});

function structuredToolResponse(toolName: string, payload: unknown, finishReason = "tool_calls") {
  return new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: finishReason,
          message: {
            content: "",
            reasoning_content: `${toolName} reasoning`,
            tool_calls: [
              {
                id: `call-${toolName}`,
                type: "function",
                function: {
                  name: toolName,
                  arguments: JSON.stringify(payload),
                },
              },
            ],
          },
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function textResponse(text: string, finishReason = "stop") {
  return new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: finishReason,
          message: {
            content: text,
          },
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function reviewerToolResponse() {
  return structuredToolResponse("emit_review_report", {
    passed: true,
    issues: [],
    warnings: [],
    styleNotes: ["章节维持全知旁观群像视角。"],
    factCoverage: 0.8,
    suggestedRewrites: [],
  });
}

function simulationToolResponse(payload: unknown) {
  return structuredToolResponse("emit_simulation_stage", payload);
}

describe("workbench api handlers", () => {
  test("can save, read, and clear persisted ai settings through the workbench handlers", async () => {
    const directory = mkdtempSync(join(tmpdir(), "workbench-ai-settings-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;

    const handlers = createWorkbenchApiHandlers({
      rootDir: directory,
    });

    const initial = await handlers.getAiSettings();
    const saved = await handlers.saveAiSettings({
      apiKey: "sk-test-local-key",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-pro",
      timeoutMs: 600000,
      thinkingMode: "enabled",
      reasoningEffort: "max",
      contextWindowTokens: 1000000,
      maxOutputTokens: 384000,
    });
    const fetched = await handlers.getAiSettings();
    const cleared = await handlers.clearAiSettings();

    expect(initial.settings.configured).toBe(false);
    expect(saved.settings.configured).toBe(true);
    expect(saved.settings.apiKeyMasked).toContain("****");
    expect(saved.settings.apiKeyMasked).not.toContain("local-key");
    expect(fetched.settings.baseUrl).toBe("https://api.deepseek.com");
    expect(fetched.settings.model).toBe("deepseek-v4-pro");
    expect(fetched.settings.timeoutMs).toBe(600000);
    expect(fetched.settings.thinkingMode).toBe("enabled");
    expect(fetched.settings.reasoningEffort).toBe("max");
    expect(fetched.settings.contextWindowTokens).toBe(1000000);
    expect(fetched.settings.maxOutputTokens).toBe(384000);
    expect(cleared.settings.configured).toBe(false);

    await handlers.session();
  });

  test("can validate ai settings before saving them", async () => {
    const directory = mkdtempSync(join(tmpdir(), "workbench-ai-validate-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;

    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(textResponse("pong"));
    const handlers = createWorkbenchApiHandlers({
      rootDir: directory,
      deepseek: {
        fetchImpl,
      },
    });

    const validated = await handlers.validateAiSettings({
      apiKey: "sk-validate-test",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-pro",
      timeoutMs: 600000,
      thinkingMode: "enabled",
      reasoningEffort: "max",
      contextWindowTokens: 1000000,
      maxOutputTokens: 384000,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(validated.settings.validated).toBe(true);
    expect(validated.settings.model).toBe("deepseek-v4-pro");
    expect(validated.settings.thinkingMode).toBe("enabled");
    expect(validated.settings.reasoningEffort).toBe("max");
    const request = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body ?? "{}")) as Record<string, unknown>;
    expect(request.thinking).toEqual({ type: "enabled" });
    expect(request.reasoning_effort).toBe("max");
    expect(validated.validation.ok).toBe(true);
    expect(validated.validation.requestMode).toBe("plain-text");

    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(stat(join(directory, "memory", "store.json"))).rejects.toThrow();
  });

  test("exposes session state and can parse/apply world drafts inside the current session", async () => {
    const directory = mkdtempSync(join(tmpdir(), "workbench-session-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;
    const handlers = createWorkbenchApiHandlers({
      rootDir: directory,
    });

    await handlers.saveAiSettings({
      apiKey: "sk-session-test",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-reasoner",
      timeoutMs: 180000,
    });

    const initialSession = await handlers.session();
    const parsed = await handlers.parseWorld({
      draftText: sampleWorld,
    });
    const applied = await handlers.applyWorld({
      draftText: sampleWorld,
    });
    const reset = await handlers.resetWorld();

    expect(initialSession.simulation.stages.length).toBe(0);
    expect(parsed.preview.characters.length).toBeGreaterThan(0);
    expect(applied.session.draftApplied).toBe(true);
    expect(applied.session.aiSettings?.configured).toBe(true);
    expect(applied.session.locked).toBe(false);
    expect(applied.session.simulation.stages).toHaveLength(0);
    expect(applied.session.selectedLineId).toBe("canon");
    expect(reset.draftText).toContain("# 世界设定");
  });

  test("lists simulation runs after a runtime tick", async () => {
    const directory = mkdtempSync(join(tmpdir(), "workbench-runtime-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;
    const handlers = createWorkbenchApiHandlers({
      rootDir: directory,
    });
    await handlers.saveAiSettings({
      apiKey: "sk-runtime-test",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-reasoner",
      timeoutMs: 180000,
    });
    await handlers.applyWorld({ draftText: sampleWorld });

    const tick = await handlers.runDaemonTick({
      directive: { stageLabel: "外门试炼", focusCharacterIds: ["林焰"] },
    });
    expect(tick.runId).toMatch(/^run-/);
    expect(tick.session.selectedStageId).toBe("stage-1");
    expect(tick.session.lens.stageRange).toEqual(["stage-1"]);
    expect(tick.session.simulation.stages).toHaveLength(1);
    expect(tick.session.simulation.latestBranchEvaluations.length).toBeGreaterThan(0);
    expect(tick.session.aiSettings?.configured).toBe(true);
    expect(tick.session.locked).toBe(false);

    const runs = await handlers.listRuns();
    expect(runs.runs.some((run) => run.runId === tick.runId)).toBe(true);
  });

  test("returns persisted CanonGate decisions for runtime run details", async () => {
    const directory = mkdtempSync(join(tmpdir(), "workbench-runtime-detail-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;
    const handlers = createWorkbenchApiHandlers({
      rootDir: directory,
    });
    await handlers.saveAiSettings({
      apiKey: "sk-runtime-detail-test",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-reasoner",
      timeoutMs: 180000,
    });
    await handlers.applyWorld({ draftText: sampleWorld });

    const tick = await handlers.runDaemonTick({
      directive: { stageLabel: "外门试炼", focusCharacterIds: ["林焰"] },
    });
    const detail = await handlers.getRunDetail({ runId: tick.runId });

    expect(detail.gateDecisions.length).toBeGreaterThan(0);
    expect(detail.gateDecisions.every((decision) => decision.decisionId)).toBe(true);
  });

  test("runs stages, selects branch lines, and promotes a branch back into canon", async () => {
    const directory = mkdtempSync(join(tmpdir(), "workbench-simulation-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;
    const handlers = createWorkbenchApiHandlers({
      rootDir: directory,
      deepseek: {
        fetchImpl: vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            simulationToolResponse({
              canon: {
                event: {
                  title: "寒池逼问的正史推进",
                  summary: "寒池禁制提前闭锁，林焰被迫在执法视线里提前亮牌。",
                  participants: ["林焰", "苏雪", "韩渡"],
                  tags: ["conflict"],
                  stateChanges: ["林焰:提前亮牌"],
                },
                characterUpdates: [
                  { characterId: "林焰", lastAction: "提前亮牌", progressDelta: 2, pressureDelta: 2, note: "硬压下先露底牌" },
                ],
                relationshipUpdates: [{ left: "林焰", right: "韩渡", status: "公开冲突", note: "第一次真正撕开脸面" }],
              },
              branches: [
                {
                  title: "正面撕开分支",
                  event: {
                    title: "正面撕开分支",
                    summary: "冲突被推到明面。",
                    participants: ["林焰", "韩渡"],
                    tags: ["branch"],
                    stateChanges: ["林焰:强压"],
                  },
                  spectacle: 8,
                  pacing: 7,
                  reasons: ["冲突更直接"],
                  risks: [],
                  recommended: true,
                  characterUpdates: [{ characterId: "林焰", lastAction: "强压应局", progressDelta: 2, pressureDelta: 2, note: "顶着闭锁继续抢线" }],
                  relationshipUpdates: [{ left: "林焰", right: "韩渡", status: "公开冲突", note: "继续升级" }],
                },
                {
                  title: "稳盘旁压分支",
                  event: {
                    title: "稳盘旁压分支",
                    summary: "场面暂时被压稳。",
                    participants: ["苏雪", "林焰"],
                    tags: ["branch"],
                    stateChanges: ["苏雪:稳盘"],
                  },
                  spectacle: 5,
                  pacing: 5,
                  reasons: ["保留规则空间"],
                  risks: [],
                  recommended: false,
                  characterUpdates: [{ characterId: "苏雪", lastAction: "稳盘应局", progressDelta: 1, pressureDelta: 1, note: "先守后推" }],
                  relationshipUpdates: [{ left: "林焰", right: "苏雪", status: "紧绷盟友", note: "仍站同线" }],
                },
              ],
            }),
          ),
      },
    });

    await handlers.saveAiSettings({
      apiKey: "sk-stage-test",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-reasoner",
      timeoutMs: 180000,
    });

    await handlers.applyWorld({
      draftText: sampleWorld,
    });

    const stageRun = await handlers.runStage({
      stageLabel: "寒池逼问",
      focusCharacterIds: ["林焰"],
      intervention: "寒池禁制突然提前闭锁，外门弟子必须在一炷香内交代去向。",
    });
    const recommended = stageRun.result.branchEvaluations.find((branch) => branch.recommended);
    const selected = await handlers.selectLine({
      lineId: recommended?.branchId ?? "canon",
    });
    const promoted = await handlers.promoteBranch({
      branchId: recommended!.branchId,
    });

    expect(stageRun.result.branchEvaluations.length).toBeGreaterThan(0);
    expect(selected.session.selectedLineId).toBe(recommended?.branchId);
    expect(promoted.session.selectedLineId).toBe("canon");
    expect(promoted.session.simulation.branchHistory.length).toBeGreaterThan(0);
  });

  test("uses ai simulation proposals for stage progression and branch evaluations", async () => {
    const directory = mkdtempSync(join(tmpdir(), "workbench-ai-sim-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;

    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
      simulationToolResponse({
        canon: {
          event: {
            title: "寒池逼问的正史推进",
            summary: "寒池禁制突然闭锁，林焰被逼在众目之下提前亮出残图线索。",
            participants: ["林焰", "苏雪", "韩渡"],
            tags: ["conflict", "trial"],
            stateChanges: ["林焰:被迫提前亮牌", "苏雪:执法压力上升"],
          },
          characterUpdates: [
            { characterId: "林焰", lastAction: "被迫亮牌", progressDelta: 2, pressureDelta: 2, note: "寒池闭锁后只能抢先应局" },
            { characterId: "苏雪", lastAction: "压住场面", progressDelta: 1, pressureDelta: 2, note: "执法压力压到正面" },
            { characterId: "韩渡", lastAction: "旁压试探", progressDelta: 1, pressureDelta: 1, note: "趁乱逼线索" },
          ],
          relationshipUpdates: [
            { left: "林焰", right: "苏雪", status: "紧绷盟友", note: "共抗外压但张力变高" },
            { left: "林焰", right: "韩渡", status: "公开冲突", note: "追线索转成明面碰撞" },
          ],
        },
        branches: [
          {
            title: "寒池强压分支",
            event: {
              title: "寒池强压分支",
              summary: "林焰顶着闭锁禁制硬抢一步，韩渡当场把冲突推成公开逼问。",
              participants: ["林焰", "韩渡"],
              tags: ["branch", "surge"],
              stateChanges: ["林焰:抢先破局", "韩渡:公开施压"],
            },
            spectacle: 9,
            pacing: 8,
            reasons: ["冲突直接抬升", "人物选择仍有根据"],
            risks: [],
            recommended: true,
            characterUpdates: [
              { characterId: "林焰", lastAction: "抢先破局", progressDelta: 3, pressureDelta: 2, note: "顶住硬压抢出先机" },
              { characterId: "韩渡", lastAction: "公开施压", progressDelta: 2, pressureDelta: 1, note: "把牌桌翻到明面" },
            ],
            relationshipUpdates: [
              { left: "林焰", right: "韩渡", status: "公开冲突", note: "彻底撕开遮掩" },
            ],
          },
          {
            title: "寒池拖稳分支",
            event: {
              title: "寒池拖稳分支",
              summary: "苏雪先把寒池秩序稳住，三方都把真正的杀招压到下一轮。",
              participants: ["林焰", "苏雪", "韩渡"],
              tags: ["branch", "cautious"],
              stateChanges: ["苏雪:先稳盘面"],
            },
            spectacle: 6,
            pacing: 5,
            reasons: ["保住规则底盘"],
            risks: ["爽点偏后置"],
            recommended: false,
            characterUpdates: [
              { characterId: "苏雪", lastAction: "稳盘控局", progressDelta: 1, pressureDelta: 1, note: "先守后打" },
            ],
            relationshipUpdates: [
              { left: "林焰", right: "苏雪", status: "紧绷盟友", note: "暂时站在同线" },
            ],
          },
        ],
      }),
    );

    const handlers = createWorkbenchApiHandlers({
      rootDir: directory,
      deepseek: {
        fetchImpl,
      },
    });

    await handlers.saveAiSettings({
      apiKey: "sk-sim-test",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-reasoner",
      timeoutMs: 180000,
    });

    const stageRun = await handlers.runStage({
      stageLabel: "寒池逼问",
      focusCharacterIds: ["林焰"],
      intervention: "寒池禁制突然提前闭锁，外门弟子必须在一炷香内交代去向。",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(stageRun.result.canonStage.events.at(-1)?.title).toBe("寒池逼问的正史推进");
    expect(stageRun.result.canonStage.events.at(-1)?.summary).toContain("林焰被逼在众目之下提前亮出残图线索");
    expect(stageRun.result.branchEvaluations).toHaveLength(2);
    expect(stageRun.result.branchEvaluations[0].title).toBe("寒池强压分支");
    expect(stageRun.result.branchEvaluations.some((branch) => branch.recommended)).toBe(true);
  });

  test("run-auto advances requested ai-driven stages in one call", async () => {
    const directory = mkdtempSync(join(tmpdir(), "workbench-ai-auto-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        simulationToolResponse({
          canon: {
            event: {
              title: "连推一",
              summary: "第一阶段被 AI 推到正面。",
              participants: ["林焰"],
              tags: ["conflict"],
              stateChanges: ["林焰:第一步推进"],
            },
            characterUpdates: [{ characterId: "林焰", lastAction: "推进一步", progressDelta: 1, pressureDelta: 1, note: "首轮连推" }],
            relationshipUpdates: [],
          },
          branches: [
            {
              title: "一号分支",
              event: {
                title: "一号分支",
                summary: "第一阶段的分支。",
                participants: ["林焰"],
                tags: ["branch"],
                stateChanges: ["林焰:分支一"],
              },
              spectacle: 7,
              pacing: 6,
              reasons: ["可观察"],
              risks: [],
              recommended: true,
              characterUpdates: [{ characterId: "林焰", lastAction: "分支推进", progressDelta: 1, pressureDelta: 1, note: "分支一" }],
              relationshipUpdates: [],
            },
            {
              title: "二号分支",
              event: {
                title: "二号分支",
                summary: "第一阶段的第二条分支。",
                participants: ["林焰"],
                tags: ["branch"],
                stateChanges: ["林焰:分支二"],
              },
              spectacle: 5,
              pacing: 5,
              reasons: ["保守观察"],
              risks: [],
              recommended: false,
              characterUpdates: [{ characterId: "林焰", lastAction: "保守推进", progressDelta: 1, pressureDelta: 1, note: "分支二" }],
              relationshipUpdates: [],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        simulationToolResponse({
          canon: {
            event: {
              title: "连推二",
              summary: "第二阶段继续往前压。",
              participants: ["林焰"],
              tags: ["conflict"],
              stateChanges: ["林焰:第二步推进"],
            },
            characterUpdates: [{ characterId: "林焰", lastAction: "推进第二步", progressDelta: 1, pressureDelta: 1, note: "第二轮连推" }],
            relationshipUpdates: [],
          },
          branches: [
            {
              title: "三号分支",
              event: {
                title: "三号分支",
                summary: "第二阶段分支一。",
                participants: ["林焰"],
                tags: ["branch"],
                stateChanges: ["林焰:分支三"],
              },
              spectacle: 8,
              pacing: 6,
              reasons: ["继续抬升"],
              risks: [],
              recommended: true,
              characterUpdates: [{ characterId: "林焰", lastAction: "高压推进", progressDelta: 1, pressureDelta: 2, note: "分支三" }],
              relationshipUpdates: [],
            },
            {
              title: "四号分支",
              event: {
                title: "四号分支",
                summary: "第二阶段分支二。",
                participants: ["林焰"],
                tags: ["branch"],
                stateChanges: ["林焰:分支四"],
              },
              spectacle: 5,
              pacing: 5,
              reasons: ["保守延续"],
              risks: [],
              recommended: false,
              characterUpdates: [{ characterId: "林焰", lastAction: "稳住场面", progressDelta: 1, pressureDelta: 1, note: "分支四" }],
              relationshipUpdates: [],
            },
          ],
        }),
      );

    const handlers = createWorkbenchApiHandlers({
      rootDir: directory,
      deepseek: {
        fetchImpl,
      },
    });

    await handlers.saveAiSettings({
      apiKey: "sk-auto-test",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-reasoner",
      timeoutMs: 180000,
    });

    const result = await handlers.runAuto({
      targetStageCount: 2,
      stageLabel: "连推阶段",
      focusCharacterIds: ["林焰"],
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.autoRun.active).toBe(false);
    expect(result.autoRun.completedStages).toBe(2);
    expect(result.session.simulation.stages).toHaveLength(2);
    expect(result.session.simulation.stages[0].stageLabel).toBe("连推阶段·1");
    expect(result.session.simulation.stages[1].stageLabel).toBe("连推阶段·2");
  });

  test("runtime daemon endpoints start and report backend progress", async () => {
    const directory = mkdtempSync(join(tmpdir(), "workbench-runtime-daemon-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;

    const handlers = createWorkbenchApiHandlers({
      rootDir: directory,
    });

    await handlers.saveAiSettings({
      apiKey: "sk-runtime-test",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-pro",
      timeoutMs: 600000,
    });

    const started = await handlers.startRuntime({
      targetTicks: 2,
      directive: {
        stageLabel: "后台常驻推演",
        focusCharacterIds: ["林焰"],
      },
    });
    expect(started.runtime.targetTicks).toBe(2);

    const status = await handlers.waitForRuntimeIdle();

    expect(status.runtime.completed).toBe(true);
    expect(status.runtime.completedTicks).toBe(2);
    expect(status.session.simulation.stages).toHaveLength(2);
    expect(status.session.simulation.stages[0].stageLabel).toBe("后台常驻推演·1");
    expect(status.session.simulation.stages[1].stageLabel).toBe("后台常驻推演·2");
  });

  test("assembles a complete chapter from existing scene drafts", async () => {
    const directory = mkdtempSync(join(tmpdir(), "workbench-assemble-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;
    const handlers = createWorkbenchApiHandlers({
      rootDir: directory,
      providerFactory: () => new LocalWritingModelProvider(),
    });

    await handlers.saveAiSettings({
      apiKey: "sk-assemble-test",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-pro",
      timeoutMs: 600000,
    });

    const composed = await handlers.compose({
      lens: {
        focusCharacterIds: ["苏雪"],
        style: "omniscient-web",
        stageRange: [],
        chapterGoal: "生成可装配的完整章节",
        sceneCount: 4,
        targetLength: [2800, 3300],
        factConstraint: "medium-expansion",
      },
    });
    const assembled = await handlers.assemble({
      draft: {
        ...composed.draft,
        chapterText: "",
        text: "",
      },
      lens: {
        focusCharacterIds: ["苏雪"],
        style: "omniscient-web",
        stageRange: [],
        chapterGoal: "生成可装配的完整章节",
        sceneCount: 4,
        targetLength: [2800, 3300],
        factConstraint: "medium-expansion",
      },
    });

    expect(assembled.draft.chapterText.length).toBeGreaterThan(0);
    expect(assembled.draft.chapterText).not.toContain("【第1场");
    expect(assembled.draft.sceneDrafts).toHaveLength(composed.draft.sceneDrafts.length);
    expect(assembled.draft.review).toBeDefined();
  });

  test("confirms author-final text into memory and compiles atlas files for the active line", async () => {
    const directory = mkdtempSync(join(tmpdir(), "workbench-memory-atlas-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;
    const plannerResponse = {
      chapterGoal: "展示试炼开局时三方首次正面咬合",
      stageRange: ["stage-1"],
      mainConflict: "林焰与韩渡围绕玄脉线索的第一次公开逼迫",
      secondaryConflict: "苏雪必须在门规和护人之间做取舍",
      closingHook: "丹谷异火提前躁动，把真正的追杀压到下一章。",
      sceneOrder: ["scene-1", "scene-2", "scene-3", "scene-4"],
      summary: "章节计划已成形",
    };
    const sceneCardResponse = {
      sceneCards: [
        {
          id: "scene-1",
          order: 1,
          location: "外门山城山道",
          time: "局起之时",
          participants: ["林焰", "苏雪", "韩渡"],
          sceneGoal: "开场拉局",
          conflict: plannerResponse.mainConflict,
          hardFacts: ["外门试炼：林焰在试炼山道逼近真传名额。"],
          softExpansionBudget: ["允许补场间过渡", "允许补环境描写", "允许补心理判断"],
          transitionIn: "暗流终于翻到明处",
          transitionOut: "于是下一场不再是试探，而是正面挤压",
          focusCue: "先写局，再落到人",
        },
      ],
    };
    const chapterText =
      "【第1场：试炼推进】外门山城的气机一层层绷紧，林焰、苏雪与韩渡都被这一段局势拽进同一张盘面。";
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        simulationToolResponse({
          canon: {
            event: {
              title: "外门试炼的正史推进",
              summary: "外门山城的试炼线被提前点燃，林焰与韩渡第一次真正对冲。",
              participants: ["林焰", "苏雪", "韩渡"],
              tags: ["conflict", "trial"],
              stateChanges: ["林焰:逼近真传名额", "苏雪:承压护线"],
            },
            characterUpdates: [
              { characterId: "林焰", lastAction: "迎压争先", progressDelta: 2, pressureDelta: 1, note: "试炼中抢先一步" },
              { characterId: "苏雪", lastAction: "稳局护线", progressDelta: 1, pressureDelta: 1, note: "护住场面" },
            ],
            relationshipUpdates: [{ left: "林焰", right: "韩渡", status: "公开冲突", note: "玄脉线索转成明面相撞" }],
          },
          branches: [
            {
              title: "强冲试炼分支",
              event: {
                title: "强冲试炼分支",
                summary: "林焰抢先压上去。",
                participants: ["林焰", "韩渡"],
                tags: ["branch"],
                stateChanges: ["林焰:强冲"],
              },
              spectacle: 8,
              pacing: 7,
              reasons: ["冲突更直接"],
              risks: [],
              recommended: true,
              characterUpdates: [{ characterId: "林焰", lastAction: "抢先破局", progressDelta: 2, pressureDelta: 1, note: "强冲试炼" }],
              relationshipUpdates: [{ left: "林焰", right: "韩渡", status: "公开冲突", note: "继续升级" }],
            },
            {
              title: "拖稳试炼分支",
              event: {
                title: "拖稳试炼分支",
                summary: "苏雪先稳住盘面。",
                participants: ["苏雪", "林焰"],
                tags: ["branch"],
                stateChanges: ["苏雪:稳盘"],
              },
              spectacle: 5,
              pacing: 5,
              reasons: ["守住秩序"],
              risks: [],
              recommended: false,
              characterUpdates: [{ characterId: "苏雪", lastAction: "稳盘控局", progressDelta: 1, pressureDelta: 1, note: "拖稳试炼" }],
              relationshipUpdates: [{ left: "林焰", right: "苏雪", status: "紧绷盟友", note: "同线更紧" }],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(structuredToolResponse("emit_chapter_plan", plannerResponse))
      .mockResolvedValueOnce(structuredToolResponse("emit_scene_cards", sceneCardResponse))
      .mockResolvedValueOnce(textResponse(chapterText))
      .mockResolvedValueOnce(textResponse(chapterText))
      .mockResolvedValueOnce(textResponse(chapterText))
      .mockResolvedValueOnce(textResponse(chapterText))
      .mockResolvedValueOnce(reviewerToolResponse());
    const handlers = createWorkbenchApiHandlers({
      rootDir: directory,
      deepseek: {
        apiKey: "test-key",
        fetchImpl,
      },
    });

    await handlers.saveAiSettings({
      apiKey: "test-key",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-reasoner",
      timeoutMs: 180000,
    });

    await handlers.runStage({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰"],
    });

    const composed = await handlers.compose({
      lineId: "canon",
    });
    const confirmed = await handlers.confirmFinal({
      lineId: "canon",
      draft: composed.draft,
    });
    const memory = await handlers.memory({
      lineId: "canon",
    });
    const atlasTree = await handlers.atlasTree({
      lineId: "canon",
    });
    const chapterNode = atlasTree.tree.find((node) => node.path.includes("chapters"));
    const indexNode = atlasTree.tree.find((node) => node.path.endsWith("index.md"));
    const atlasFile = await handlers.atlasFile({
      lineId: "canon",
      path: indexNode?.path ?? "",
    });

    expect(confirmed.updatedFiles.some((file: string) => file.includes("atlas"))).toBe(true);
    expect(memory.expressionEntries.every((entry) => entry.source === "author-final")).toBe(true);
    expect(memory.revisionEntries.length).toBeGreaterThanOrEqual(0);
    expect(chapterNode).toBeTruthy();
    expect(atlasFile.content).toContain("# 正史线 Atlas");
    expect(readFileSync(confirmed.updatedFiles[0], "utf8").length).toBeGreaterThan(0);
  });

  test("reports online mode when deepseek is configured", async () => {
    const directory = mkdtempSync(join(tmpdir(), "workbench-status-"));
    tempDirs.push(directory);
    const handlers = createWorkbenchApiHandlers({
      rootDir: directory,
      deepseek: {
        apiKey: "test-key",
        fetchImpl: vi.fn<typeof fetch>(),
      },
    });

    const status = await handlers.status();

    expect(status.online).toBe(true);
    expect(status.providerName).toBe("deepseek-writing-provider");
  });

  test("reports unconfigured mode when deepseek is missing", async () => {
    const directory = mkdtempSync(join(tmpdir(), "workbench-status-missing-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;
    const handlers = createWorkbenchApiHandlers({
      rootDir: directory,
    });

    const status = await handlers.status();

    expect(status.online).toBe(false);
    expect(status.providerName).toBe("deepseek-unconfigured-provider");
  });

  test("rejects atlas file paths that escape the selected atlas root", async () => {
    const directory = mkdtempSync(join(tmpdir(), "workbench-atlas-path-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;
    const handlers = createWorkbenchApiHandlers({
      rootDir: directory,
    });

    await handlers.saveAiSettings({
      apiKey: "sk-atlas-path-test",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-reasoner",
      timeoutMs: 180000,
    });
    await mkdir(join(directory, "atlas", "canon"), { recursive: true });
    await writeFile(join(directory, "atlas", "canon", "allowed.md"), "lineId: canon", "utf8");
    await writeFile(join(directory, "outside.md"), "outside", "utf8");

    await expect(handlers.atlasFile({ lineId: "canon", path: "../../outside.md" })).rejects.toThrow(/atlas path/i);
    await expect(handlers.atlasFile({ lineId: "canon", path: "allowed.md" })).resolves.toMatchObject({
      path: "allowed.md",
      content: "lineId: canon",
    });
  });

  test("rejects atlas line ids that attempt path traversal", async () => {
    const directory = mkdtempSync(join(tmpdir(), "workbench-atlas-line-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;
    const handlers = createWorkbenchApiHandlers({
      rootDir: directory,
    });

    await handlers.saveAiSettings({
      apiKey: "sk-atlas-line-test",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-reasoner",
      timeoutMs: 180000,
    });
    await mkdir(join(directory, "atlas", "branches"), { recursive: true });

    await expect(handlers.atlasTree({ lineId: "../../.." })).rejects.toThrow(/line id/i);
    await expect(handlers.atlasFile({ lineId: "../../..", path: "outside.md" })).rejects.toThrow(/line id/i);
  });

  test("locks the studio and rejects generation actions when ai settings are missing", async () => {
    const directory = mkdtempSync(join(tmpdir(), "workbench-locked-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;
    const handlers = createWorkbenchApiHandlers({
      rootDir: directory,
    });

    const session = await handlers.session();

    expect(session.locked).toBe(true);
    expect(session.aiSettings?.configured).toBe(false);

    await expect(handlers.compose({ lineId: "canon" })).rejects.toThrow(/DeepSeek/i);
    await expect(
      handlers.runStage({
        stageLabel: "锁定测试",
        focusCharacterIds: ["林焰"],
      }),
    ).rejects.toThrow(/DeepSeek/i);
  });

  test("composes and rewrites a chapter through the local workbench api", async () => {
    const directory = mkdtempSync(join(tmpdir(), "workbench-compose-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;
    const plannerResponse = {
      chapterGoal: "展示试炼开局时三方首次正面咬合",
      stageRange: ["stage-1"],
      mainConflict: "林焰与韩渡围绕玄脉线索的第一次公开逼迫",
      secondaryConflict: "苏雪必须在门规和护人之间做取舍",
      closingHook: "丹谷异火提前躁动，把真正的追杀压到下一章。",
      sceneOrder: ["scene-1", "scene-2", "scene-3", "scene-4"],
      summary: "章节计划已成形",
    };
    const sceneCardResponse = {
      sceneCards: [
        {
          id: "scene-1",
          order: 1,
          location: "外门山城山道",
          time: "局起之时",
          participants: ["林焰", "苏雪", "韩渡"],
          sceneGoal: "开场拉局",
          conflict: plannerResponse.mainConflict,
          hardFacts: ["外门试炼：林焰在试炼山道逼近真传名额。"],
          softExpansionBudget: ["允许补场间过渡", "允许补环境描写", "允许补心理判断"],
          transitionIn: "暗流终于翻到明处",
          transitionOut: "于是下一场不再是试探，而是正面挤压",
          focusCue: "先写局，再落到人",
        },
        {
          id: "scene-2",
          order: 2,
          location: "山城内圈石坪",
          time: "锋芒相抵时",
          participants: ["林焰", "苏雪"],
          sceneGoal: "冲突显化",
          conflict: plannerResponse.secondaryConflict,
          hardFacts: ["林焰与苏雪的盟友关系被推到更紧处。"],
          softExpansionBudget: ["允许补场间过渡", "允许补环境描写", "允许补心理判断"],
          transitionIn: "第一轮试探没有收住",
          transitionOut: "于是场中人都明白，再退就会把主动让出去",
          focusCue: "全知叙述俯视群像，同时贴近关键人物的一瞬判断",
        },
        {
          id: "scene-3",
          order: 3,
          location: "山城偏巷与观台之间",
          time: "压力倒卷时",
          participants: ["韩渡", "苏雪", "林焰"],
          sceneGoal: "局势反转或压力加码",
          conflict: "韩渡借势把局再往前推半步",
          hardFacts: ["韩渡继续逼近玄脉线索。"],
          softExpansionBudget: ["允许补场间过渡", "允许补环境描写", "允许补心理判断"],
          transitionIn: "局面看似定住，真正的反压却在背后抬头",
          transitionOut: "于是本该封死的口子反而被逼出新的缝",
          focusCue: "全知叙述俯视群像，同时贴近关键人物的一瞬判断",
        },
        {
          id: "scene-4",
          order: 4,
          location: "山城高处风口",
          time: "余波未定时",
          participants: ["林焰", "苏雪", "韩渡"],
          sceneGoal: "收束并挂钩下一章",
          conflict: plannerResponse.closingHook,
          hardFacts: ["丹谷异动的余波开始外溢。"],
          softExpansionBudget: ["允许补场间过渡", "允许补环境描写", "允许补心理判断"],
          transitionIn: "所有人都以为此局要收口",
          transitionOut: plannerResponse.closingHook,
          focusCue: "收束当前冲突，并把钩子挂到下一章",
        },
      ],
    };
    const chapterText = Array.from({ length: 6 }, (_, index) => {
      const sceneNumber = index + 1;
      return `【第${sceneNumber}场：试炼推进】外门山城的气机一层层绷紧，林焰、苏雪与韩渡都被这一段局势拽进同一张盘面。` +
        "叙述不贴死单一人物，而是沿着众人的判断往前压，写清谁在进、谁在退、谁在暗中换手。" +
        "尾声把丹谷异火提前躁动的压力抬起来，明确压向下一章。";
    }).join("\n\n");
    const reviewerResponse = {
      passed: true,
      issues: [],
      warnings: [],
      styleNotes: ["章节维持全知旁观群像视角。"],
      factCoverage: 0.8,
      suggestedRewrites: [],
    };
    const rewrittenScene = "【第2场：冲突显化】重写后，这一场的对白更尖，压迫感更重。";

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(structuredToolResponse("emit_chapter_plan", plannerResponse))
      .mockResolvedValueOnce(structuredToolResponse("emit_scene_cards", sceneCardResponse))
      .mockResolvedValueOnce(textResponse(chapterText))
      .mockResolvedValueOnce(textResponse(chapterText))
      .mockResolvedValueOnce(textResponse(chapterText))
      .mockResolvedValueOnce(textResponse(chapterText))
      .mockResolvedValueOnce(structuredToolResponse("emit_review_report", reviewerResponse))
      .mockResolvedValueOnce(textResponse(rewrittenScene));

    const handlers = createWorkbenchApiHandlers({
      rootDir: directory,
      deepseek: {
        apiKey: "test-key",
        fetchImpl,
      },
    });

    await handlers.saveAiSettings({
      apiKey: "test-key",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-reasoner",
      timeoutMs: 180000,
    });

    const composed = await handlers.compose({ lineId: "canon" });
    const untouched = composed.draft.sceneDrafts[0].text;
    const targetSceneId = composed.draft.sceneDrafts[1].sceneId;

    const rewritten = await handlers.rewrite({
      lineId: "canon",
      draft: composed.draft,
      sceneId: targetSceneId,
      instructions: ["强化冲突与对白"],
    });

    expect(composed.online).toBe(true);
    expect(composed.providerName).toBe("deepseek-writing-provider");
    expect(composed.draft.review.passed).toBe(true);
    expect(rewritten.draft.sceneDrafts[0].text).toBe(untouched);
    expect(rewritten.draft.sceneDrafts[1].text).toBe(rewrittenScene);
  });
});
