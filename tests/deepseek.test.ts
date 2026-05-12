import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test, vi } from "vitest";

import {
  AiSettingsStore,
  buildNarrativeSourcePack,
  DeepSeekWritingProvider,
  WorldHistoryEngine,
  createDefaultWritingProvider,
  draftNarrativeWithDeepSeek,
  expandScenesWithDeepSeek,
  parseWorldDraft,
  resolveDeepSeekConfig,
  simulateStageWithDeepSeek,
  validateDeepSeekConnection,
} from "../src/index";

const sampleDraft = `
# 世界设定
题材：东方玄幻/修仙
时间尺度：阶段
修炼体系：灵海、化罡、真传
世界规则：
- 玄脉共鸣会放大角色的欲望与执念
- 宗门资源稀缺时，外门与真传的矛盾会激化

# 势力
- 青岳宗：名门正宗，控制地火丹炉
- 幽潮殿：潜伏北荒，以夺取玄脉为目标

# 地点
- 外门山城：青岳宗外门弟子聚居之地
- 地火丹谷：炼丹重地，失守会引发大乱

# 角色
- 林焰 | faction=青岳宗 | role=外门弟子 | traits=倔强,护短,求突破 | goal=拿到真传名额 | stance=守宗 | resource=赤纹残图
- 苏雪 | faction=青岳宗 | role=丹谷执事 | traits=冷静,克制,重情 | goal=守住丹谷与门规 | stance=守宗 | resource=地火炉令
- 韩渡 | faction=幽潮殿 | role=潜伏者 | traits=隐忍,野心,善谋 | goal=夺取玄脉坐标 | stance=夺脉 | resource=潮息秘符

# 关系
- 林焰 <-> 苏雪 | status=盟友 | history=苏雪曾暗中保下林焰 | tension=信任下的压抑情愫
- 林焰 <-> 韩渡 | status=宿敌 | history=两人在矿脉试炼中结仇 | tension=谁先拿到玄脉线索
- 苏雪 <-> 韩渡 | status=戒备 | history=苏雪怀疑丹谷有内应 | tension=规则与渗透的攻防

# 单角色锚点
- 林焰 | cannot=提前死亡 | must_trend=在压力中成长 | stage_goal=接近真传名额
- 苏雪 | cannot=无因失守底线 | must_trend=在规则与情感之间摇摆 | stage_goal=守住丹谷
- 韩渡 | cannot=突然改邪归正 | must_trend=逐步逼近玄脉 | stage_goal=抢到关键线索

# 关系锚点
- 林焰 <-> 苏雪 | boundary=不能无因反目成仇 | trend=盟友走向紧绷
- 林焰 <-> 韩渡 | boundary=不能突然并肩结盟 | trend=竞争升级为公开冲突
- 苏雪 <-> 韩渡 | boundary=不能无因互信 | trend=猜疑加深
`;

const originalEnv = {
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseUrl: process.env.DEEPSEEK_BASE_URL,
  structuredBaseUrl: process.env.DEEPSEEK_STRUCTURED_BASE_URL,
  model: process.env.DEEPSEEK_MODEL,
  timeoutMs: process.env.DEEPSEEK_TIMEOUT_MS,
  localAppData: process.env.LOCALAPPDATA,
};
const tempDirs: string[] = [];

function createFixture() {
  const engine = new WorldHistoryEngine(parseWorldDraft(sampleDraft));
  const stageResult = engine.runStage({
    stageLabel: "外门试炼",
    focusCharacterIds: ["林焰", "苏雪"],
  });
  const recommended = stageResult.branchEvaluations.find((branch) => branch.recommended);
  const input = {
    line: engine.getLine(recommended?.branchId),
    lens: {
      focusCharacterIds: ["苏雪"],
      style: "omniscient-web",
      stageRange: [stageResult.canonStage.id],
      chapterGoal: "展示外门试炼这一章里三方势力的第一轮正面碰撞",
      sceneCount: 4 as const,
      targetLength: [1500, 2500] as [number, number],
      factConstraint: "medium-expansion" as const,
    },
  };
  return { engine, stageResult, recommended, input };
}

function buildPlannerResponse(stageId: string) {
  return {
    chapterGoal: "展示试炼开局时三方首次正面咬合",
    stageRange: [stageId],
    mainConflict: "林焰与韩渡围绕玄脉线索的第一次公开逼迫",
    secondaryConflict: "苏雪必须在门规和护人之间做取舍",
    closingHook: "丹谷异火提前躁动，把真正的追杀压到下一章。",
    sceneOrder: ["scene-1", "scene-2", "scene-3", "scene-4"],
    summary: "章节计划已成形",
  };
}

function buildSceneCardResponse(plannerResponse: ReturnType<typeof buildPlannerResponse>) {
  return {
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
}

function buildChapterText() {
  return Array.from({ length: 6 }, (_, index) => {
    const sceneNumber = index + 1;
    return `【第${sceneNumber}场：试炼推进】外门山城的气机一层层绷紧，林焰、苏雪与韩渡都被这一段局势拽进同一张盘面。` +
      "叙述不贴死单一人物，而是沿着众人的判断往前压，写清谁在进、谁在退、谁在暗中换手。" +
      "奇门主压落在山城这一线，灵压翻涌之间，所有人的动作都被放大成可见的锋芒。" +
      "石阶两侧的符灯被风压吹得齐齐低伏，旁观弟子终于意识到这不是寻常试炼，而是宗门资源、旧怨与暗线第一次撞在明处。" +
      "苏雪压住执事堂的躁动，林焰把锋芒藏进半步退让，韩渡则借人群遮住手中潮息秘符的微光。" +
      "山道外传来第二阵钟声，执事们开始清点试炼名册，谁也不敢再把这场冲突当作少年意气。" +
      "每一次目光错开，都像在给下一轮逼迫预留位置，局面因此越收越窄。" +
      "高处观台上的长老没有出声，只让玉牌继续悬着，等三方自己把底牌逼出来。" +
      "所有人都知道下一步不能再退。" +
      "这一场没有改写既定结果，只把已发生的冲突扩成更可读的近身碰撞，并在尾声把下一章的火线抬起来。";
  }).join("\n\n");
}

function buildCompactChapterText() {
  return Array.from({ length: 4 }, (_, index) => {
    const sceneNumber = index + 1;
    return `【第${sceneNumber}场：试炼推进】外门山城的气机绷紧，林焰、苏雪与韩渡被同一段局势推到明处。` +
      "叙述沿众人的判断往前压，写清谁在进、谁在退、谁在暗中换手。" +
      "奇门主压落在山城这一线，灵压翻涌，动作都被放大成锋芒。" +
      "苏雪压住场面，林焰把锋芒藏进半步退让，韩渡借人群遮住潮息秘符的微光。" +
      "钟声落下后，执事们开始清点名册，局面越收越窄。" +
      "观台无人出声，只等三方自己把底牌逼出来。" +
      "所有人都知道下一步不能再退。" +
      "风声压低。" +
      "这一场不改写结果，只把既定冲突推成近身碰撞，并在尾声抬起下一章的火线。";
  }).join("\n\n");
}

function buildReviewerResponse() {
  return {
    passed: true,
    issues: [],
    warnings: [],
    styleNotes: ["章节维持全知旁观群像视角。", "章节保留了当前空间焦点。"],
    factCoverage: 0.75,
    suggestedRewrites: ["继续沿当前节奏推进下一章。"],
  };
}

function collectStrictSchemaRequiredMismatches(schema: unknown, path = "$"): string[] {
  if (!schema || typeof schema !== "object") {
    return [];
  }
  const record = schema as Record<string, unknown>;
  const mismatches: string[] = [];
  if (record.type === "object" && record.properties && typeof record.properties === "object") {
    const propertyKeys = Object.keys(record.properties as Record<string, unknown>).sort();
    const requiredKeys = Array.isArray(record.required) ? [...record.required].map(String).sort() : [];
    if (propertyKeys.join("\u0000") !== requiredKeys.join("\u0000")) {
      mismatches.push(`${path}: properties=${propertyKeys.join(",")} required=${requiredKeys.join(",")}`);
    }
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === "properties" && value && typeof value === "object") {
      for (const [propertyKey, propertyValue] of Object.entries(value as Record<string, unknown>)) {
        mismatches.push(...collectStrictSchemaRequiredMismatches(propertyValue, `${path}.${propertyKey}`));
      }
    } else if (key === "items") {
      mismatches.push(...collectStrictSchemaRequiredMismatches(value, `${path}[]`));
    }
  }

  return mismatches;
}

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

function structuredToolResponseWithArguments(toolName: string, argumentsText: string, finishReason = "tool_calls") {
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
                  arguments: argumentsText,
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

function jsonModeResponse(payload: unknown) {
  return new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify(payload),
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

afterEach(() => {
  return Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))).then(() => {
  if (originalEnv.apiKey === undefined) {
    delete process.env.DEEPSEEK_API_KEY;
  } else {
    process.env.DEEPSEEK_API_KEY = originalEnv.apiKey;
  }
  if (originalEnv.baseUrl === undefined) {
    delete process.env.DEEPSEEK_BASE_URL;
  } else {
    process.env.DEEPSEEK_BASE_URL = originalEnv.baseUrl;
  }
  if (originalEnv.structuredBaseUrl === undefined) {
    delete process.env.DEEPSEEK_STRUCTURED_BASE_URL;
  } else {
    process.env.DEEPSEEK_STRUCTURED_BASE_URL = originalEnv.structuredBaseUrl;
  }
  if (originalEnv.model === undefined) {
    delete process.env.DEEPSEEK_MODEL;
  } else {
    process.env.DEEPSEEK_MODEL = originalEnv.model;
  }
  if (originalEnv.timeoutMs === undefined) {
    delete process.env.DEEPSEEK_TIMEOUT_MS;
  } else {
    process.env.DEEPSEEK_TIMEOUT_MS = originalEnv.timeoutMs;
  }
  if (originalEnv.localAppData === undefined) {
    delete process.env.LOCALAPPDATA;
  } else {
    process.env.LOCALAPPDATA = originalEnv.localAppData;
  }
  });
});

describe("deepseek narrative integration", () => {
  test("requires a DeepSeek API key before live generation", () => {
    expect(() => resolveDeepSeekConfig({ apiKey: "" })).toThrow(/DEEPSEEK_API_KEY/);
  });

  test("defaults to DeepSeek V4 Pro high-effort long-context settings", () => {
    const directory = mkdtempSync(join(tmpdir(), "novel-ai-settings-v4-default-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;
    delete process.env.DEEPSEEK_MODEL;
    delete process.env.DEEPSEEK_BASE_URL;
    delete process.env.DEEPSEEK_TIMEOUT_MS;
    delete process.env.DEEPSEEK_THINKING_MODE;
    delete process.env.DEEPSEEK_REASONING_EFFORT;
    delete process.env.DEEPSEEK_CONTEXT_WINDOW_TOKENS;
    delete process.env.DEEPSEEK_MAX_OUTPUT_TOKENS;

    const config = resolveDeepSeekConfig({
      apiKey: "test-key",
      fetchImpl: vi.fn<typeof fetch>(),
    });

    expect(config.model).toBe("deepseek-v4-pro");
    expect(config.timeoutMs).toBe(600000);
    expect(config.thinkingMode).toBe("enabled");
    expect(config.reasoningEffort).toBe("high");
    expect(config.contextWindowTokens).toBe(1000000);
    expect(config.maxOutputTokens).toBe(384000);
  });

  test("persists studio ai settings under LOCALAPPDATA and uses them for config resolution", async () => {
    const directory = mkdtempSync(join(tmpdir(), "novel-ai-settings-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_BASE_URL;
    delete process.env.DEEPSEEK_MODEL;
    delete process.env.DEEPSEEK_TIMEOUT_MS;

    const store = new AiSettingsStore();
    await store.save({
      apiKey: "stored-key",
      baseUrl: "https://example.deepseek.proxy",
      model: "deepseek-reasoner",
      timeoutMs: 222000,
      thinkingMode: "enabled",
      reasoningEffort: "max",
      contextWindowTokens: 1000000,
      maxOutputTokens: 384000,
    });

    const config = resolveDeepSeekConfig({
      fetchImpl: vi.fn<typeof fetch>(),
    });

    expect(store.filePath).toContain("WorldHistoryEngine");
    expect(store.filePath).toContain("studio-config.json");
    expect(config.apiKey).toBe("stored-key");
    expect(config.baseUrl).toBe("https://example.deepseek.proxy");
    expect(config.model).toBe("deepseek-reasoner");
    expect(config.timeoutMs).toBe(222000);
    expect(config.thinkingMode).toBe("enabled");
    expect(config.reasoningEffort).toBe("max");
    expect(config.contextWindowTokens).toBe(1000000);
    expect(config.maxOutputTokens).toBe(384000);
  });

  test("derives structured endpoint from saved custom base url unless explicitly overridden", async () => {
    const directory = mkdtempSync(join(tmpdir(), "novel-ai-settings-custom-base-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_BASE_URL;
    delete process.env.DEEPSEEK_STRUCTURED_BASE_URL;

    const store = new AiSettingsStore();
    await store.save({
      apiKey: "stored-key",
      baseUrl: "https://proxy.example/deepseek",
      model: "deepseek-v4-pro",
      timeoutMs: 222000,
    });

    const config = resolveDeepSeekConfig({
      fetchImpl: vi.fn<typeof fetch>(),
    });

    expect(config.baseUrl).toBe("https://proxy.example/deepseek");
    expect(config.structuredBaseUrl).toBe("https://proxy.example/deepseek/beta");
  });

  test("sends DeepSeek V4 thinking controls and omits temperature for max-effort thinking", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(textResponse("pong"));

    await validateDeepSeekConnection({
      apiKey: "test-key",
      fetchImpl,
      model: "deepseek-v4-pro",
      thinkingMode: "enabled",
      reasoningEffort: "max",
    });

    const request = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body ?? "{}")) as Record<string, unknown>;
    expect(request.model).toBe("deepseek-v4-pro");
    expect(request.thinking).toEqual({ type: "enabled" });
    expect(request.reasoning_effort).toBe("max");
    expect(request.temperature).toBeUndefined();
  });

  test("uses a larger long-context output budget for simulation requests", async () => {
    const { engine, stageResult } = createFixture();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      structuredToolResponse("emit_simulation_stage", {
        canon: {
          event: {
            title: "AI 正史推进",
            summary: "世界推演继续推进。",
            participants: ["林焰"],
            tags: ["conflict"],
            stateChanges: ["林焰继续逼近真传名额"],
          },
          characterUpdates: [],
          relationshipUpdates: [],
        },
        branches: [
          {
            title: "分支一",
            event: {
              title: "林焰抢先破局",
              summary: "林焰先行压过韩渡。",
              participants: ["林焰"],
              tags: ["branch"],
              stateChanges: ["林焰进度上升"],
            },
            spectacle: 7,
            pacing: 7,
            reasons: ["主动推进"],
            risks: [],
            recommended: true,
            characterUpdates: [],
            relationshipUpdates: [],
          },
          {
            title: "分支二",
            event: {
              title: "韩渡反设埋伏",
              summary: "韩渡拖慢试炼节奏。",
              participants: ["韩渡"],
              tags: ["branch"],
              stateChanges: ["韩渡压力下降"],
            },
            spectacle: 6,
            pacing: 6,
            reasons: ["反向施压"],
            risks: [],
            recommended: false,
            characterUpdates: [],
            relationshipUpdates: [],
          },
        ],
      }),
    );

    await simulateStageWithDeepSeek(
      {
        parsed: engine.getParsedWorld(),
        canonLine: engine.getCanonLine(),
        directive: {
          stageLabel: "外门试炼",
          focusCharacterIds: ["林焰"],
        },
        nextStageNumber: 2,
      },
      {
        apiKey: "test-key",
        fetchImpl,
        maxRetries: 0,
      },
    );

    const request = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body ?? "{}")) as Record<string, unknown>;
    expect(request.max_tokens).toBe(64000);
  });

  test("sends DeepSeek-compatible strict schemas for simulation tool calls", async () => {
    const { engine } = createFixture();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      structuredToolResponse("emit_simulation_stage", {
        canon: {
          event: {
            title: "AI 正史推进",
            summary: "世界推演继续推进。",
            participants: ["林焰"],
            tags: ["conflict"],
            stateChanges: ["林焰继续逼近真传名额"],
          },
          characterUpdates: [],
          relationshipUpdates: [],
        },
        branches: [
          {
            title: "分支一",
            event: {
              title: "林焰抢先破局",
              summary: "林焰先行压过韩渡。",
              participants: ["林焰"],
              tags: ["branch"],
              stateChanges: ["林焰进度上升"],
            },
            spectacle: 7,
            pacing: 7,
            reasons: ["主动推进"],
            risks: [],
            recommended: true,
            characterUpdates: [],
            relationshipUpdates: [],
          },
          {
            title: "分支二",
            event: {
              title: "韩渡反设埋伏",
              summary: "韩渡拖慢试炼节奏。",
              participants: ["韩渡"],
              tags: ["branch"],
              stateChanges: ["韩渡压力下降"],
            },
            spectacle: 6,
            pacing: 6,
            reasons: ["反向施压"],
            risks: [],
            recommended: false,
            characterUpdates: [],
            relationshipUpdates: [],
          },
        ],
      }),
    );

    await simulateStageWithDeepSeek(
      {
        parsed: engine.getParsedWorld(),
        canonLine: engine.getCanonLine(),
        directive: {
          stageLabel: "外门试炼",
          focusCharacterIds: ["林焰"],
        },
        nextStageNumber: 2,
      },
      {
        apiKey: "test-key",
        fetchImpl,
        maxRetries: 0,
      },
    );

    const request = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body ?? "{}")) as {
      tools?: Array<{ function?: { parameters?: unknown } }>;
    };
    const schema = request.tools?.[0]?.function?.parameters;
    expect(collectStrictSchemaRequiredMismatches(schema)).toEqual([]);
  });

  test("uses strict tool calls for structured stages and plain text for prose generation", async () => {
    const directory = mkdtempSync(join(tmpdir(), "novel-ai-settings-draft-default-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;
    delete process.env.DEEPSEEK_MODEL;
    delete process.env.DEEPSEEK_THINKING_MODE;
    delete process.env.DEEPSEEK_REASONING_EFFORT;

    const { input, stageResult } = createFixture();
    const plannerResponse = buildPlannerResponse(stageResult.canonStage.id);
    const sceneCardResponse = buildSceneCardResponse(plannerResponse);
    const chapterText = buildChapterText();
    const reviewerResponse = buildReviewerResponse();

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(structuredToolResponse("emit_chapter_plan", plannerResponse))
      .mockResolvedValueOnce(structuredToolResponse("emit_scene_cards", sceneCardResponse))
      .mockResolvedValueOnce(textResponse(chapterText))
      .mockResolvedValueOnce(structuredToolResponse("emit_review_report", reviewerResponse));

    const narrative = await draftNarrativeWithDeepSeek(
      input,
      {
        apiKey: "test-key",
        fetchImpl,
        maxRetries: 0,
      },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(4);

    const plannerUrl = String(fetchImpl.mock.calls[0]?.[0]);
    const sceneUrl = String(fetchImpl.mock.calls[1]?.[0]);
    const composerUrl = String(fetchImpl.mock.calls[2]?.[0]);
    const reviewerUrl = String(fetchImpl.mock.calls[3]?.[0]);
    expect(plannerUrl).toContain("/beta/chat/completions");
    expect(sceneUrl).toContain("/beta/chat/completions");
    expect(composerUrl).toContain("/chat/completions");
    expect(composerUrl).not.toContain("/beta/");
    expect(reviewerUrl).toContain("/beta/chat/completions");

    const plannerRequest = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body ?? "{}")) as Record<string, unknown>;
    const sceneRequest = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body ?? "{}")) as Record<string, unknown>;
    const composerRequest = JSON.parse(String(fetchImpl.mock.calls[2]?.[1]?.body ?? "{}")) as Record<string, unknown>;

    expect(plannerRequest.thinking).toEqual({ type: "disabled" });
    expect(plannerRequest.reasoning_effort).toBeUndefined();
    expect(plannerRequest.temperature).toBe(0.7);
    expect(plannerRequest.response_format).toBeUndefined();
    expect(plannerRequest.tool_choice).toBe("auto");
    expect(Array.isArray(plannerRequest.tools)).toBe(true);
    expect((plannerRequest.tools as Array<{ function: { strict?: boolean } }>)[0]?.function.strict).toBe(true);

    expect(sceneRequest.thinking).toEqual({ type: "disabled" });
    expect(sceneRequest.tool_choice).toBe("auto");
    expect(plannerRequest.max_tokens).toBe(2048);
    expect(sceneRequest.max_tokens).toBe(3600);
    expect(composerRequest.max_tokens).toBe(4200);
    expect(composerRequest.thinking).toEqual({ type: "enabled" });
    expect(composerRequest.reasoning_effort).toBe("high");
    expect(composerRequest.temperature).toBeUndefined();
    expect(composerRequest.tools).toBeUndefined();
    expect(composerRequest.messages).toBeDefined();

    expect(narrative.sceneIds).toHaveLength(4);
    expect(narrative.chapterText).toContain("林焰");
    expect(narrative.chapterText).toContain("苏雪");
    expect(narrative.chapterText).toContain("韩渡");
    expect(narrative.review.passed).toBe(true);
    expect(narrative.runRecords.map((record) => record.step)).toEqual([
      "planner",
      "scene-card",
      "composer",
      "reviewer",
    ]);
    expect(narrative.runRecords[0]?.requestMode).toBe("structured-tool");
    expect(narrative.runRecords[2]?.requestMode).toBe("plain-text");
  });

  test("uses saved custom base url for structured and prose calls", async () => {
    const directory = mkdtempSync(join(tmpdir(), "novel-ai-settings-custom-call-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_BASE_URL;
    delete process.env.DEEPSEEK_STRUCTURED_BASE_URL;

    const { input, stageResult } = createFixture();
    const plannerResponse = buildPlannerResponse(stageResult.canonStage.id);
    const sceneCardResponse = buildSceneCardResponse(plannerResponse);
    const chapterText = buildChapterText();
    const reviewerResponse = buildReviewerResponse();
    const store = new AiSettingsStore();
    await store.save({
      apiKey: "stored-key",
      baseUrl: "https://proxy.example/deepseek",
      model: "deepseek-v4-pro",
      timeoutMs: 222000,
    });

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(structuredToolResponse("emit_chapter_plan", plannerResponse))
      .mockResolvedValueOnce(structuredToolResponse("emit_scene_cards", sceneCardResponse))
      .mockResolvedValueOnce(textResponse(chapterText))
      .mockResolvedValueOnce(structuredToolResponse("emit_review_report", reviewerResponse));

    await draftNarrativeWithDeepSeek(input, {
      fetchImpl,
      maxRetries: 0,
    });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe("https://proxy.example/deepseek/beta/chat/completions");
    expect(String(fetchImpl.mock.calls[1]?.[0])).toBe("https://proxy.example/deepseek/beta/chat/completions");
    expect(String(fetchImpl.mock.calls[2]?.[0])).toBe("https://proxy.example/deepseek/chat/completions");
    expect(String(fetchImpl.mock.calls[3]?.[0])).toBe("https://proxy.example/deepseek/beta/chat/completions");
  });

  test("passes lens target length and memory pack into DeepSeek prose prompt", async () => {
    const { input, stageResult } = createFixture();
    const lens = {
      ...input.lens,
      targetLength: [900, 1100] as [number, number],
    };
    const line = input.line;
    const sourcePack = buildNarrativeSourcePack({ line, lens });
    const plan = buildPlannerResponse(stageResult.canonStage.id);
    const sceneCards = buildSceneCardResponse(plan).sceneCards;
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(textResponse(buildCompactChapterText()));
    const provider = new DeepSeekWritingProvider({
      apiKey: "test-key",
      fetchImpl,
      maxRetries: 0,
    });

    await provider.synthesizeProse(
      {
        line,
        lens,
        sourcePack,
        memoryPack: {
          lineId: line.lineId,
          factEntries: [
            {
              id: "fact-1",
              lineId: line.lineId,
              stageId: stageResult.canonStage.id,
              eventId: "event-1",
              summary: "作者已确认：林焰在上一章最后选择沉默蓄势。",
              characterIds: ["林焰"],
              relationshipKeys: [],
              factionNames: ["青岳宗"],
              locationNames: ["外门山城"],
            },
          ],
          expressionEntries: [
            {
              id: "expr-1",
              lineId: line.lineId,
              sceneId: "scene-1",
              stageId: stageResult.canonStage.id,
              eventIds: ["event-1"],
              characterIds: ["林焰"],
              relationshipKeys: [],
              summary: "作者定稿语气：压住怒意，短句推进。",
              text: "林焰没有立刻拔剑，只把指节压在残图边缘。",
              toneTags: ["克制"],
              voiceTags: ["短句"],
              conflictTags: ["蓄势"],
              hookTags: ["残图"],
              source: "author-final",
              active: true,
            },
          ],
          foreshadowEntries: [
            {
              id: "hook-1",
              lineId: line.lineId,
              stageId: stageResult.canonStage.id,
              summary: "残图边缘的裂纹还没有解释。",
              eventIds: ["event-1"],
              characterIds: ["林焰"],
              status: "open",
            },
          ],
          revisionEntries: [
            {
              id: "rev-1",
              lineId: line.lineId,
              sceneId: "scene-1",
              replacedExpressionId: "old-expr",
              replacementExpressionId: "expr-1",
              summary: "删除直白怒吼，改成压抑蓄势。",
            },
          ],
        },
      },
      plan,
      sceneCards,
    );

    const request = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body ?? "{}")) as {
      messages?: Array<{ role: string; content: string }>;
    };
    const userPrompt = request.messages?.find((message) => message.role === "user")?.content ?? "";
    expect(userPrompt).toContain("900-1100 字");
    expect(userPrompt).toContain("章节标题");
    expect(userPrompt).toContain("至少 6 个自然段");
    expect(userPrompt).toContain("最后 20% 必须写到章末钩子");
    expect(userPrompt).toContain("每个自然段都必须改变知识、权力、关系、风险或欲望");
    expect(userPrompt).toContain("作者已确认：林焰在上一章最后选择沉默蓄势。");
    expect(userPrompt).toContain("作者定稿语气：压住怒意，短句推进。");
    expect(userPrompt).toContain("残图边缘的裂纹还没有解释。");
    expect(userPrompt).toContain("删除直白怒吼，改成压抑蓄势。");
  });

  test("enriches scene participants when DeepSeek omits mentioned active characters", async () => {
    const { input, stageResult } = createFixture();
    const line = input.line;
    const sourcePack = buildNarrativeSourcePack({ line, lens: input.lens });
    const plan = buildPlannerResponse(stageResult.canonStage.id);
    const sceneCardResponse = buildSceneCardResponse(plan);
    sceneCardResponse.sceneCards[0].participants = ["苏雪"];
    sceneCardResponse.sceneCards[0].sceneGoal = "苏雪稳住场面，同时确认林焰与韩渡的动作";
    sceneCardResponse.sceneCards[0].conflict = "林焰退让观察，韩渡趁乱试探";
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(structuredToolResponse("emit_scene_cards", sceneCardResponse));
    const provider = new DeepSeekWritingProvider({
      apiKey: "test-key",
      fetchImpl,
      maxRetries: 0,
    });

    const sceneCards = await provider.expandScenes(
      {
        line,
        lens: input.lens,
        sourcePack,
        memoryPack: undefined,
      },
      plan,
    );

    expect(sceneCards[0]?.participants).toEqual(["苏雪", "林焰", "韩渡"]);
    const request = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body ?? "{}")) as {
      messages?: Array<{ role: string; content: string }>;
    };
    const userPrompt = request.messages?.find((message) => message.role === "user")?.content ?? "";
    expect(userPrompt).toContain("不要只填写焦点角色");
  });

  test("repairs DeepSeek prose when the first compose pass exceeds the lens target length", async () => {
    // Length-repair LLM loop is opt-in via NOVEL_LENGTH_REPAIR_ATTEMPTS env var
    // (default: 0, hardFit local truncation handles overlength chapters).
    const prevEnv = process.env.NOVEL_LENGTH_REPAIR_ATTEMPTS;
    process.env.NOVEL_LENGTH_REPAIR_ATTEMPTS = "3";
    try {
    const { input, stageResult } = createFixture();
    const lens = {
      ...input.lens,
      targetLength: [900, 1100] as [number, number],
    };
    const line = input.line;
    const sourcePack = buildNarrativeSourcePack({ line, lens });
    const plan = buildPlannerResponse(stageResult.canonStage.id);
    const sceneCards = buildSceneCardResponse(plan).sceneCards;
    const repairedText = buildCompactChapterText();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(textResponse(buildChapterText()))
      .mockResolvedValueOnce(textResponse(repairedText));
    const provider = new DeepSeekWritingProvider({
      apiKey: "test-key",
      fetchImpl,
      maxRetries: 0,
    });

    const draft = await provider.synthesizeProse(
      {
        line,
        lens,
        sourcePack,
        memoryPack: undefined,
      },
      plan,
      sceneCards,
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const repairRequest = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body ?? "{}")) as {
      messages?: Array<{ role: string; content: string }>;
      thinking?: { type: string };
      reasoning_effort?: string;
    };
    const repairPrompt = repairRequest.messages?.find((message) => message.role === "user")?.content ?? "";
    expect(repairPrompt).toContain("目标必须落在 900-1100 字");
    expect(repairPrompt).toContain("原正文");
    expect(repairRequest.thinking).toEqual({ type: "disabled" });
    expect(repairRequest.reasoning_effort).toBeUndefined();
    expect(draft.chapterText).toContain("尾声抬起下一章的火线");
    expect(draft.chapterText.split(/\n{2,}/).filter((paragraph) => paragraph.trim())).toHaveLength(6);
    expect(draft.chapterText.length).toBeGreaterThanOrEqual(900);
    expect(draft.chapterText.length).toBeLessThanOrEqual(1100);
    expect(draft.sceneDrafts).toHaveLength(4);
    expect(draft.runRecords[0]?.conclusion).toContain("校准长度");
    } finally {
      if (prevEnv === undefined) delete process.env.NOVEL_LENGTH_REPAIR_ATTEMPTS;
      else process.env.NOVEL_LENGTH_REPAIR_ATTEMPTS = prevEnv;
    }
  });

  test("keeps repairing DeepSeek prose until it satisfies the lens target length", async () => {
    const prevEnv = process.env.NOVEL_LENGTH_REPAIR_ATTEMPTS;
    process.env.NOVEL_LENGTH_REPAIR_ATTEMPTS = "3";
    try {
    const { input, stageResult } = createFixture();
    const lens = {
      ...input.lens,
      targetLength: [900, 1100] as [number, number],
    };
    const line = input.line;
    const sourcePack = buildNarrativeSourcePack({ line, lens });
    const plan = buildPlannerResponse(stageResult.canonStage.id);
    const sceneCards = buildSceneCardResponse(plan).sceneCards;
    const stillTooLong = `${buildCompactChapterText()}${buildCompactChapterText().slice(0, 360)}`;
    const repairedText = buildCompactChapterText();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(textResponse(buildChapterText()))
      .mockResolvedValueOnce(textResponse(stillTooLong))
      .mockResolvedValueOnce(textResponse(repairedText));
    const provider = new DeepSeekWritingProvider({
      apiKey: "test-key",
      fetchImpl,
      maxRetries: 0,
    });

    const draft = await provider.synthesizeProse(
      {
        line,
        lens,
        sourcePack,
        memoryPack: undefined,
      },
      plan,
      sceneCards,
    );

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(draft.chapterText).toContain("尾声抬起下一章的火线");
    expect(draft.chapterText.split(/\n{2,}/).filter((paragraph) => paragraph.trim())).toHaveLength(6);
    expect(draft.chapterText.length).toBeGreaterThanOrEqual(900);
    expect(draft.chapterText.length).toBeLessThanOrEqual(1100);
    } finally {
      if (prevEnv === undefined) delete process.env.NOVEL_LENGTH_REPAIR_ATTEMPTS;
      else process.env.NOVEL_LENGTH_REPAIR_ATTEMPTS = prevEnv;
    }
  });

  test("falls back to json mode when strict tool calls do not return valid tool arguments", async () => {
    const { input, stageResult } = createFixture();
    const plannerResponse = buildPlannerResponse(stageResult.canonStage.id);
    const sceneCardResponse = buildSceneCardResponse(plannerResponse);
    const chapterText = buildChapterText();
    const reviewerResponse = buildReviewerResponse();

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content: "",
                  reasoning_content: "no tool calls returned",
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(jsonModeResponse(plannerResponse))
      .mockResolvedValueOnce(structuredToolResponse("emit_scene_cards", sceneCardResponse))
      .mockResolvedValueOnce(textResponse(chapterText))
      .mockResolvedValueOnce(structuredToolResponse("emit_review_report", reviewerResponse));

    const narrative = await draftNarrativeWithDeepSeek(
      input,
      {
        apiKey: "test-key",
        fetchImpl,
        maxRetries: 0,
      },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(5);
    const fallbackUrl = String(fetchImpl.mock.calls[1]?.[0]);
    const fallbackRequest = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body ?? "{}")) as Record<string, unknown>;
    expect(fallbackUrl).toContain("/chat/completions");
    expect(fallbackUrl).not.toContain("/beta/");
    expect(fallbackRequest.response_format).toEqual({ type: "json_object" });
    expect(narrative.plan.chapterGoal).toBe(plannerResponse.chapterGoal);
    expect(narrative.runRecords[0]?.fallbackUsed).toBe("json-fallback");
  });

  test("allocates enough json-fallback output budget for seven scene cards", async () => {
    const { input, stageResult } = createFixture();
    const plan = {
      ...buildPlannerResponse(stageResult.canonStage.id),
      sceneOrder: Array.from({ length: 7 }, (_, index) => `scene-${index + 1}`),
    };
    const sceneCards = plan.sceneOrder.map((id, index) => ({
      id,
      order: index + 1,
      location: `地点${index + 1}`,
      time: `时刻${index + 1}`,
      participants: ["林焰", "苏雪", "韩渡"],
      sceneGoal: `推进第${index + 1}层冲突`,
      conflict: index % 2 === 0 ? plan.mainConflict : plan.secondaryConflict,
      hardFacts: [`硬事实${index + 1}`],
      softExpansionBudget: ["补足场间过渡", "补足动作细节", "补足心理压力"],
      transitionIn: `承接第${index}场余波`,
      transitionOut: `压向第${index + 2}场转折`,
      focusCue: "全知视角贴近关键判断",
    }));
    let fallbackMaxTokens = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => {
      const request = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      if (request.response_format) {
        fallbackMaxTokens = Number(request.max_tokens);
        return fallbackMaxTokens >= 5600
          ? jsonModeResponse({ sceneCards })
          : textResponse("{", "length");
      }
      return textResponse("");
    });

    const result = await expandScenesWithDeepSeek(
      {
        ...input,
        lens: {
          ...input.lens,
          sceneCount: 7,
        },
        plan,
      },
      {
        apiKey: "test-key",
        fetchImpl,
        maxRetries: 0,
      },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fallbackMaxTokens).toBeGreaterThanOrEqual(5600);
    expect(result.sceneCards).toHaveLength(7);
    expect(result.runRecord.fallbackUsed).toBe("json-fallback");
  });

  test("accepts recoverable strict-tool arguments even when DeepSeek ends with finish_reason length", async () => {
    const { input, stageResult } = createFixture();
    const plannerResponse = buildPlannerResponse(stageResult.canonStage.id);
    const sceneCardResponse = buildSceneCardResponse(plannerResponse);
    const chapterText = buildChapterText();
    const reviewerResponse = buildReviewerResponse();

    const malformedPlannerArguments = JSON.stringify(plannerResponse).replace("\"stageRange\":", "\"stageRange:");

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        structuredToolResponseWithArguments("emit_chapter_plan", malformedPlannerArguments, "length"),
      )
      .mockResolvedValueOnce(structuredToolResponse("emit_scene_cards", sceneCardResponse))
      .mockResolvedValueOnce(textResponse(chapterText))
      .mockResolvedValueOnce(structuredToolResponse("emit_review_report", reviewerResponse));

    const narrative = await draftNarrativeWithDeepSeek(
      input,
      {
        apiKey: "test-key",
        fetchImpl,
        maxRetries: 0,
      },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(narrative.plan.chapterGoal).toBe(plannerResponse.chapterGoal);
    expect(narrative.runRecords[0]?.requestMode).toBe("structured-tool");
    expect(narrative.runRecords[0]?.finishReason).toBe("length");
    expect(narrative.runRecords[0]?.fallbackUsed).toBeUndefined();
  });

  test("fails fast when DeepSeek composer ends because of token truncation", async () => {
    const { input, stageResult } = createFixture();
    const plannerResponse = buildPlannerResponse(stageResult.canonStage.id);
    const sceneCardResponse = buildSceneCardResponse(plannerResponse);

    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(structuredToolResponse("emit_chapter_plan", plannerResponse))
      .mockResolvedValueOnce(structuredToolResponse("emit_scene_cards", sceneCardResponse))
      .mockResolvedValueOnce(textResponse("正文被截断", "length"));

    await expect(
      draftNarrativeWithDeepSeek(
        input,
        {
          apiKey: "test-key",
          fetchImpl,
        },
      ),
    ).rejects.toThrow(/finish reason length/i);
  });

  test("creates a deepseek provider by default when the api key is configured", () => {
    process.env.DEEPSEEK_API_KEY = "configured-key";
    process.env.DEEPSEEK_MODEL = "deepseek-reasoner";

    const provider = createDefaultWritingProvider({
      deepseek: {
        apiKey: "configured-key",
        fetchImpl: vi.fn<typeof fetch>(),
      },
    });

    expect(provider).toBeInstanceOf(DeepSeekWritingProvider);
  });

  test("returns an unconfigured provider when the api key is missing", () => {
    const directory = mkdtempSync(join(tmpdir(), "novel-ai-settings-empty-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;
    delete process.env.DEEPSEEK_API_KEY;

    const provider = createDefaultWritingProvider();

    expect(provider.name).toBe("deepseek-unconfigured-provider");
    expect(provider.modelName).toBe("deepseek-v4-pro");
  });

  test("creates a deepseek provider from saved local ai settings even without env vars", async () => {
    const directory = mkdtempSync(join(tmpdir(), "novel-ai-settings-provider-"));
    tempDirs.push(directory);
    process.env.LOCALAPPDATA = directory;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_BASE_URL;
    delete process.env.DEEPSEEK_MODEL;
    delete process.env.DEEPSEEK_TIMEOUT_MS;

    const store = new AiSettingsStore();
    await store.save({
      apiKey: "stored-key",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-reasoner",
      timeoutMs: 180000,
    });

    const provider = createDefaultWritingProvider({
      deepseek: {
        fetchImpl: vi.fn<typeof fetch>(),
      },
    });

    expect(provider).toBeInstanceOf(DeepSeekWritingProvider);
  });
});
