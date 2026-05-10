import { mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test } from "vitest";

import {
  AtlasCompiler,
  draftNarrative,
  LocalWritingModelProvider,
  rewriteNarrativeScene,
  StoryMemoryStore,
  TruthKernel,
  WorldHistoryEngine,
  buildChapterInputView,
  buildWritingJob,
  parseWorldDraft,
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

const tempDirs: string[] = [];

function createKernelFixture() {
  const engine = new WorldHistoryEngine(parseWorldDraft(sampleDraft));
  const firstStage = engine.runStage({
    stageLabel: "外门试炼",
    focusCharacterIds: ["林焰"],
  });
  const secondStage = engine.runStage({
    stageLabel: "丹谷风波",
    focusCharacterIds: ["苏雪"],
    intervention: "地火丹谷丹炉爆裂，执法堂勒令半日封谷搜查内应。",
  });
  return { engine, firstStage, secondStage };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("truth kernel and orchestration architecture", () => {
  test("builds an append-only truth kernel with isolated branch heads", () => {
    const { engine, firstStage } = createKernelFixture();
    const recommended = firstStage.branchEvaluations.find((branch) => branch.recommended);

    const kernel = TruthKernel.fromCanon(engine.getCanonLine());
    const branchKernel = kernel.forkFromLine(engine.getLine(recommended?.branchId));

    expect(kernel.getLine("canon").events.length).toBe(engine.getCanonLine().events.length);
    expect(branchKernel.getLine(recommended!.branchId).events.some((event) => event.branchId === recommended!.branchId)).toBe(
      true,
    );
    expect(kernel.getLine("canon").events.some((event) => event.branchId === recommended!.branchId)).toBe(false);
  });

  test("projects a bounded chapter input view without scanning unrelated history", () => {
    const { engine, firstStage, secondStage } = createKernelFixture();
    const chapterInput = buildChapterInputView({
      line: engine.getCanonLine(),
      stageRange: [firstStage.canonStage.id],
      focusCharacterIds: ["苏雪"],
    });

    expect(chapterInput.stageIds).toEqual([firstStage.canonStage.id]);
    expect(chapterInput.characterViews.some((view) => view.name === "苏雪")).toBe(true);
    expect(chapterInput.eventIds.some((eventId) => eventId.startsWith(secondStage.canonStage.id))).toBe(false);
  });

  test("stores fact, expression, and foreshadow memory with line isolation and author overrides", async () => {
    const { engine, firstStage } = createKernelFixture();
    const recommended = firstStage.branchEvaluations.find((branch) => branch.recommended);
    const directory = mkdtempSync(join(tmpdir(), "novel-memory-"));
    tempDirs.push(directory);

    const store = await StoryMemoryStore.create({ rootDir: directory });
    const canonLine = engine.getCanonLine();
    const branchLine = engine.getLine(recommended?.branchId);

    await store.syncFactsFromLine(canonLine);
    await store.writeExpression({
      lineId: canonLine.lineId,
      sceneId: "scene-1",
      stageId: firstStage.canonStage.id,
      eventIds: firstStage.canonStage.events.map((event) => event.id),
      characterIds: ["林焰", "苏雪"],
      relationshipKeys: ["林焰::苏雪"],
      summary: "正史版场景摘要",
      text: "正史表达版本",
      toneTags: ["压迫"],
      voiceTags: ["全知旁观"],
      conflictTags: ["正面碰撞"],
      hookTags: ["下章钩子"],
      source: "critic-pass",
    });
    await store.writeExpression({
      lineId: canonLine.lineId,
      sceneId: "scene-1",
      stageId: firstStage.canonStage.id,
      eventIds: firstStage.canonStage.events.map((event) => event.id),
      characterIds: ["林焰", "苏雪"],
      relationshipKeys: ["林焰::苏雪"],
      summary: "作者终稿摘要",
      text: "作者终稿版本",
      toneTags: ["压迫"],
      voiceTags: ["全知旁观"],
      conflictTags: ["正面碰撞"],
      hookTags: ["下章钩子"],
      source: "author-final",
    });

    await store.syncFactsFromLine(branchLine);
    const canonMemory = await store.readMemoryPack({
      lineId: canonLine.lineId,
      focusCharacterIds: ["苏雪"],
      stageIds: [firstStage.canonStage.id],
    });
    const branchMemory = await store.readMemoryPack({
      lineId: branchLine.lineId,
      focusCharacterIds: ["苏雪"],
      stageIds: [firstStage.canonStage.id],
    });

    expect(canonMemory.expressionEntries[0]?.text).toContain("作者终稿");
    expect(canonMemory.revisionEntries.length).toBe(1);
    expect(branchMemory.expressionEntries).toHaveLength(0);
  });

  test("compiles a read-only atlas from truth and memory state", async () => {
    const { engine, firstStage } = createKernelFixture();
    const directory = mkdtempSync(join(tmpdir(), "novel-atlas-"));
    tempDirs.push(directory);
    const store = await StoryMemoryStore.create({ rootDir: directory });
    await store.syncFactsFromLine(engine.getCanonLine());
    await store.writeExpression({
      lineId: "canon",
      sceneId: "scene-1",
      stageId: firstStage.canonStage.id,
      eventIds: firstStage.canonStage.events.map((event) => event.id),
      characterIds: ["林焰", "苏雪"],
      relationshipKeys: ["林焰::苏雪"],
      summary: "章节表达摘要",
      text: "章节表达正文",
      toneTags: ["压迫"],
      voiceTags: ["全知旁观"],
      conflictTags: ["正面碰撞"],
      hookTags: ["下章钩子"],
      source: "author-final",
    });

    const compiler = new AtlasCompiler({ rootDir: join(directory, "atlas") });
    const result = await compiler.compileLine({
      line: engine.getCanonLine(),
      memoryStore: store,
      changedStageIds: [firstStage.canonStage.id],
    });

    const chapterPage = readFileSync(result.updatedFiles.find((file) => file.includes("chapters"))!, "utf8");

    expect(result.updatedFiles.some((file) => file.includes("atlas\\canon"))).toBe(true);
    expect(chapterPage).toContain("lineId: canon");
    expect(chapterPage).toContain("章节表达摘要");
  });

  test("runs a resumable writing job with run records and checkpoints", async () => {
    const { engine, firstStage } = createKernelFixture();
    const directory = mkdtempSync(join(tmpdir(), "novel-job-"));
    tempDirs.push(directory);
    const store = await StoryMemoryStore.create({ rootDir: directory });
    await store.syncFactsFromLine(engine.getCanonLine());

    const provider = new LocalWritingModelProvider();
    const job = buildWritingJob({
      line: engine.getCanonLine(),
      lens: {
        focusCharacterIds: ["苏雪"],
        style: "omniscient-web",
        stageRange: [firstStage.canonStage.id],
        chapterGoal: "写出第一次正面碰撞",
        sceneCount: 4,
        targetLength: [1500, 2500],
        factConstraint: "medium-expansion",
      },
      provider,
      memoryStore: store,
    });

    const firstRun = await job.runUntil("scene-expand");
    const resumed = await job.resumeFrom(firstRun.checkpoint!, "complete");

    expect(firstRun.runRecords.at(-1)?.stage).toBe("scene-expand");
    expect(resumed.runRecords.some((record) => record.stage === "synthesize")).toBe(true);
    expect(resumed.draft?.chapterText.length).toBeGreaterThan(1500);
  });

  test("rewrites a single scene without mutating other scenes", () => {
    const { engine, firstStage } = createKernelFixture();
    const draft = draftNarrative({
      line: engine.getCanonLine(),
      lens: {
        focusCharacterIds: ["苏雪"],
        style: "omniscient-web",
        stageRange: [firstStage.canonStage.id],
        chapterGoal: "写出第一次正面碰撞",
        sceneCount: 4,
        targetLength: [1500, 2500],
        factConstraint: "medium-expansion",
      },
    });

    const originalScene = draft.sceneDrafts[0].text;
    const untouchedScene = draft.sceneDrafts[1].text;
    const rewritten = rewriteNarrativeScene(draft, draft.sceneDrafts[0].sceneId, "强化冲突与对白");

    expect(rewritten.sceneDrafts[0].text).not.toBe(originalScene);
    expect(rewritten.sceneDrafts[1].text).toBe(untouchedScene);
    expect(rewritten.chapterText).toContain("强化冲突");
  });
});
