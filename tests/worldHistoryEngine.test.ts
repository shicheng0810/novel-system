import { describe, expect, test } from "vitest";

import {
  buildNarrativeSourcePack,
  WorldHistoryEngine,
  buildDemoReport,
  draftNarrative,
  generateSceneCards,
  parseWorldDraft,
  planChapter,
  reviewChapterDraft,
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

const metaphysicsDraft = `
# 世界设定
题材：东方玄幻/修仙
时间尺度：阶段
修炼体系：灵海、化罡、真传
世界规则：
- 玄脉共鸣会放大角色的欲望与执念
- 强局现世时，行动时机比单纯战力更重要

# 势力
- 青岳宗：名门正宗，控制地火丹炉
- 幽潮殿：潜伏北荒，以夺取玄脉为目标

# 地点
- 外门山城：青岳宗外门弟子聚居之地
- 地火丹谷：炼丹重地，失守会引发大乱

# 角色
- 林焰 | description=少年心火盛，临压更烈，护短而不肯后退 | faction=青岳宗 | role=外门弟子 | traits=倔强,护短,求突破 | goal=拿到真传名额 | stance=守宗 | resource=赤纹残图
- 苏雪 | baziRaw=辛巳,癸酉,己亥,乙丑 | description=外冷内热，重秩序，但在关键节点会为了重要之人越线 | faction=青岳宗 | role=丹谷执事 | traits=冷静,克制,重情 | goal=守住丹谷与门规 | stance=守宗 | resource=地火炉令
- 韩渡 | archetypeDraft=水金偏旺、谋定后动、逢乱得势 | description=隐忍善谋，越乱越容易找到缝隙 | faction=幽潮殿 | role=潜伏者 | traits=隐忍,野心,善谋 | goal=夺取玄脉坐标 | stance=夺脉 | resource=潮息秘符

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

describe("world history engine prototype", () => {
  test("parses a natural-language draft into structured world state", () => {
    const parsed = parseWorldDraft(sampleDraft);

    expect(parsed.worldSpec.genre).toBe("东方玄幻/修仙");
    expect(parsed.worldSpec.factions).toHaveLength(2);
    expect(parsed.characters).toHaveLength(3);
    expect(parsed.relationships).toHaveLength(3);
    expect(parsed.characterAnchors).toHaveLength(3);
    expect(parsed.relationshipAnchors).toHaveLength(3);
  });

  test("runs a stage that advances canon and non-focused characters together", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(sampleDraft));

    const result = engine.runStage({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰"],
    });

    expect(result.canonStage.events.length).toBeGreaterThanOrEqual(2);
    expect(result.canonStage.events.some((event) => event.participants.includes("韩渡"))).toBe(true);
    expect(result.canonStage.snapshot.characters["韩渡"].lastAction).not.toBe("idle");
    expect(result.branchEvaluations.length).toBeGreaterThanOrEqual(2);
  });

  test("runs a stage for arbitrary parsed worlds without sample relationship names", () => {
    const customDraft = `
# 世界设定
题材：东方玄幻/修仙
时间尺度：阶段
修炼体系：灵潮、凝印
世界规则：
- 灵潮涨落会放大边境争夺

# 势力
- 星砂城：边境城邦
- 黑潮盟：海上敌盟

# 地点
- 星砂码头：灵潮入口

# 角色
- 阿青 | faction=星砂城 | role=守潮人 | traits=谨慎,护城 | goal=守住灵潮入口 | stance=守城 | resource=星砂令
- 墨迟 | faction=黑潮盟 | role=潜入者 | traits=隐忍,善谋 | goal=夺取潮眼图 | stance=夺图 | resource=黑潮符

# 关系
- 阿青 <-> 墨迟 | status=宿敌 | history=潮眼争夺中结仇 | tension=谁先控制码头

# 单角色锚点
- 阿青 | cannot=提前死亡 | must_trend=在压力中守住底线 | stage_goal=稳住码头
- 墨迟 | cannot=突然投诚 | must_trend=逐步逼近潮眼 | stage_goal=抢到潮眼线索

# 关系锚点
- 阿青 <-> 墨迟 | boundary=不能突然并肩结盟 | trend=竞争升级为公开冲突
`;
    const engine = new WorldHistoryEngine(parseWorldDraft(customDraft));

    const result = engine.runStage({
      stageLabel: "潮眼初争",
      focusCharacterIds: ["阿青"],
      intervention: "灵潮提前涌入码头。",
    });

    expect(result.canonStage.snapshot.relationships["阿青::墨迟"]?.status).toBe("公开冲突");
    expect(result.canonStage.events.some((event) => event.participants.includes("墨迟"))).toBe(true);
  });

  test("preserves the current relationship status when later stages have no new relationship trajectory", () => {
    const customDraft = `
# 世界设定
题材：东方玄幻/修仙
时间尺度：阶段
修炼体系：灵潮、凝印
世界规则：
- 灵潮涨落会放大边境争夺

# 势力
- 星砂城：边境城邦
- 黑潮盟：海上敌盟

# 地点
- 星砂码头：灵潮入口

# 角色
- 阿青 | faction=星砂城 | role=守潮人 | traits=谨慎,护城 | goal=守住灵潮入口 | stance=守城 | resource=星砂令
- 墨迟 | faction=黑潮盟 | role=潜入者 | traits=隐忍,善谋 | goal=夺取潮眼图 | stance=夺图 | resource=黑潮符

# 关系
- 阿青 <-> 墨迟 | status=戒备 | history=潮眼争夺中互相试探 | tension=谁先控制码头

# 单角色锚点
- 阿青 | cannot=提前死亡 | must_trend=在压力中守住底线 | stage_goal=稳住码头
- 墨迟 | cannot=突然投诚 | must_trend=逐步逼近潮眼 | stage_goal=抢到潮眼线索
`;
    const engine = new WorldHistoryEngine(parseWorldDraft(customDraft));

    const first = engine.runStage({
      stageLabel: "潮眼初争",
      focusCharacterIds: ["阿青"],
      intervention: "灵潮提前涌入码头，双方当场撕开伪装。",
    });
    const second = engine.runStage({
      stageLabel: "潮声暂歇",
      focusCharacterIds: ["阿青"],
      qimenOverride: {
        sourceMode: "manual",
        pattern: "休门稳局",
      },
    });

    expect(first.canonStage.snapshot.relationships["阿青::墨迟"]?.status).toBe("公开冲突");
    expect(second.canonStage.snapshot.relationships["阿青::墨迟"]?.status).toBe("公开冲突");
  });

  test("respects relationship anchors while allowing stage interventions", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(sampleDraft));
    engine.runStage({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰"],
    });

    const result = engine.runStage({
      stageLabel: "丹谷风波",
      focusCharacterIds: ["苏雪"],
      intervention:
        "地火丹谷丹炉爆裂，执法堂要求苏雪在半日内找出内应并封锁谷口。",
    });

    const allyRelation = result.canonStage.snapshot.relationships["林焰::苏雪"];
    const enemyRelation = result.canonStage.snapshot.relationships["林焰::韩渡"];

    expect(result.canonStage.events.some((event) => event.tags.includes("intervention"))).toBe(true);
    expect(allyRelation.status).not.toBe("仇敌");
    expect(enemyRelation.status).toBe("公开冲突");
  });

  test("does not recommend the most dramatic branch when it breaks consistency", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(sampleDraft));

    const result = engine.runStage({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰"],
    });

    const mostDramatic = [...result.branchEvaluations].sort(
      (left, right) => right.scores.spectacle - left.scores.spectacle,
    )[0];
    const recommended = result.branchEvaluations.find((branch) => branch.recommended);

    expect(mostDramatic.passesConsistencyGate).toBe(false);
    expect(recommended?.passesConsistencyGate).toBe(true);
    expect(recommended?.branchId).not.toBe(mostDramatic.branchId);
  });

  test("promotes a branch into canon while preserving archived history", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(sampleDraft));
    const firstStage = engine.runStage({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰"],
    });

    const recommended = firstStage.branchEvaluations.find((branch) => branch.recommended);
    expect(recommended).toBeDefined();

    engine.promoteBranch(recommended!.branchId);

    const canon = engine.getCanonLine();

    expect(canon.archivedTimelines).toHaveLength(1);
    expect(canon.branchHistory.at(-1)?.branchId).toBe(recommended!.branchId);
    expect(canon.events.some((event) => event.branchId === recommended!.branchId)).toBe(true);
  });

  test("drafts a narrative scene from the selected historical line", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(sampleDraft));
    const stageResult = engine.runStage({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰", "苏雪"],
    });
    const recommended = stageResult.branchEvaluations.find((branch) => branch.recommended);

    const narrative = draftNarrative({
      line: engine.getLine(recommended?.branchId),
      lens: {
        focusCharacterIds: ["苏雪"],
        style: "omniscient-web",
        stageRange: [stageResult.canonStage.id],
        chapterGoal: "展示外门试炼这一章里三方势力的第一轮正面碰撞",
        sceneCount: 4,
        targetLength: [1500, 2500],
        factConstraint: "medium-expansion",
      },
    });

    expect(narrative.focusCharacterIds).toEqual(["苏雪"]);
    expect(narrative.sceneIds.length).toBeGreaterThanOrEqual(3);
    expect(narrative.sceneIds.length).toBeLessThanOrEqual(4);
    expect(narrative.chapterText.length).toBeGreaterThanOrEqual(1500);
    expect(narrative.chapterText.length).toBeLessThanOrEqual(2500);
    expect(narrative.chapterText).toContain("苏雪");
    expect(narrative.chapterText).toContain("林焰");
    expect(narrative.chapterText).toContain("韩渡");
    expect(narrative.plan.chapterTitle).toMatch(/试炼|玄脉|山城|碰撞|丹谷/);
    expect(narrative.chapterText.split(/\n{2,}/).filter((paragraph) => paragraph.trim()).length).toBeGreaterThanOrEqual(6);
    expect(narrative.planSummary).toContain("主冲突");
    expect(narrative.review.passed).toBe(true);
    expect(narrative.selectedEventIds.length).toBeGreaterThan(0);
    expect(narrative.text).not.toContain("被推到这段历史的近景中央");
    expect(narrative.runRecords.every((record) => record.modelName === "deepseek-reasoner")).toBe(true);
  });

  test("critic rejects one-block or incomplete chapter-shaped drafts", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(sampleDraft));
    const stageResult = engine.runStage({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰", "苏雪"],
    });
    const line = engine.getCanonLine();
    const lens = {
      focusCharacterIds: ["林焰", "苏雪", "韩渡"],
      style: "omniscient-web",
      stageRange: [stageResult.canonStage.id],
      chapterGoal: "展示外门试炼这一章里三方势力的第一轮正面碰撞",
      sceneCount: 7 as const,
      targetLength: [2800, 3300] as [number, number],
      factConstraint: "medium-expansion" as const,
    };
    const sourcePack = buildNarrativeSourcePack({ line, lens });
    const oneBlock = Array.from({ length: 35 }, (_, index) => `林焰与苏雪在外门山城继续承受压力${index}。`).join("");
    const review = reviewChapterDraft(
      {
        plan: planChapter(sourcePack, lens),
        sceneDrafts: Array.from({ length: 7 }, (_, index) => ({
          sceneId: `scene-${index + 1}`,
          title: `scene-${index + 1}`,
          summary: `第${index + 1}场`,
          text: index < 5 ? `林焰与苏雪推进第${index + 1}场。` : "",
          runRecord: {
            step: "composer",
            promptVersion: "test",
            modelName: "test",
            inputSummary: "",
            rawOutput: "",
            conclusion: "",
          },
        })),
        chapterText: oneBlock,
        review: {
          passed: true,
          issues: [],
          warnings: [],
          styleNotes: [],
          factCoverage: 1,
          suggestedRewrites: [],
        },
        runRecords: [],
      },
      sourcePack,
      lens,
    );

    expect(review.passed).toBe(false);
    expect(review.issues.join("\n")).toMatch(/自然段|章末|未完成|场景/);
  });

  test("deterministic prose does not invent absent participants or glue hard facts to narration", () => {
    const customDraft = `
# 世界设定
题材：东方玄幻/修仙
时间尺度：阶段
修炼体系：灵潮、凝印
世界规则：
- 灵潮涨落会放大边境争夺

# 势力
- 星砂城：边境城邦
- 黑潮盟：海上敌盟

# 地点
- 星砂码头：灵潮入口

# 角色
- 阿青 | faction=星砂城 | role=守潮人 | traits=谨慎,护城 | goal=守住灵潮入口 | stance=守城 | resource=星砂令
- 墨迟 | faction=黑潮盟 | role=潜入者 | traits=隐忍,善谋 | goal=夺取潮眼图 | stance=夺图 | resource=黑潮符

# 关系
- 阿青 <-> 墨迟 | status=宿敌 | history=潮眼争夺中结仇 | tension=谁先控制码头

# 单角色锚点
- 阿青 | cannot=提前死亡 | must_trend=在压力中守住底线 | stage_goal=稳住码头
- 墨迟 | cannot=突然投诚 | must_trend=逐步逼近潮眼 | stage_goal=抢到潮眼线索

# 关系锚点
- 阿青 <-> 墨迟 | boundary=不能突然并肩结盟 | trend=竞争升级为公开冲突
`;
    const engine = new WorldHistoryEngine(parseWorldDraft(customDraft));
    const stageResult = engine.runStage({
      stageLabel: "潮眼初争",
      focusCharacterIds: ["阿青"],
    });

    const narrative = draftNarrative({
      line: engine.getCanonLine(),
      lens: {
        focusCharacterIds: ["阿青"],
        style: "omniscient-web",
        stageRange: [stageResult.canonStage.id],
        chapterGoal: "展示星砂码头的第一轮正面冲突",
        sceneCount: 4,
        targetLength: [1500, 2500],
        factConstraint: "medium-expansion",
      },
    });

    expect(narrative.chapterText).toContain("阿青");
    expect(narrative.chapterText).toContain("墨迟");
    expect(narrative.chapterText).not.toContain("林焰");
    expect(narrative.chapterText).not.toContain("苏雪");
    expect(narrative.chapterText).not.toContain("韩渡");
    expect(narrative.chapterText).not.toMatch(/已发生状态：[^。；\n]+(?:山城|码头|这一线)/);
  });

  test("builds a demo report that shows canon, branches, and narrative together", () => {
    const report = buildDemoReport(sampleDraft);

    expect(report).toContain("正史阶段");
    expect(report).toContain("分叉建议");
    expect(report).toContain("章节计划");
    expect(report).toContain("场景列表");
    expect(report).toContain("短章节正文");
    expect(report).toContain("林焰");
    expect(report).toContain("苏雪");
    expect(report).toContain("韩渡");
  });

  test("builds a narrative source pack and chapter plan from fixed historical facts", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(sampleDraft));
    const stageResult = engine.runStage({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰"],
    });
    const recommended = stageResult.branchEvaluations.find((branch) => branch.recommended);

    const line = engine.getLine(recommended?.branchId);
    const lens = {
      focusCharacterIds: ["苏雪"],
      style: "omniscient-web",
      stageRange: [stageResult.canonStage.id],
      chapterGoal: "写出外门试炼开局时三方第一次真正试探",
      sceneCount: 4 as const,
      targetLength: [1500, 2500] as [number, number],
      factConstraint: "medium-expansion" as const,
    };
    const sourcePack = buildNarrativeSourcePack({ line, lens });
    const plan = planChapter(sourcePack, lens);

    expect(sourcePack.hardFacts.length).toBeGreaterThan(0);
    expect(sourcePack.forbiddenMoves.length).toBeGreaterThan(0);
    expect(sourcePack.softExpansionBudget.length).toBeGreaterThan(0);
    expect(plan.sceneOrder).toHaveLength(4);
    expect(plan.mainConflict.length).toBeGreaterThan(0);
    expect(plan.secondaryConflict.length).toBeGreaterThan(0);
    expect(plan.closingHook.length).toBeGreaterThan(0);
  });

  test("generates complete scene cards for a short omniscient chapter", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(sampleDraft));
    const stageResult = engine.runStage({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰"],
    });
    const recommended = stageResult.branchEvaluations.find((branch) => branch.recommended);

    const line = engine.getLine(recommended?.branchId);
    const lens = {
      focusCharacterIds: ["苏雪"],
      style: "omniscient-web",
      stageRange: [stageResult.canonStage.id],
      chapterGoal: "写出外门试炼开局时三方第一次真正试探",
      sceneCount: 4 as const,
      targetLength: [1500, 2500] as [number, number],
      factConstraint: "medium-expansion" as const,
    };
    const sourcePack = buildNarrativeSourcePack({ line, lens });
    const plan = planChapter(sourcePack, lens);
    const sceneCards = generateSceneCards(sourcePack, plan);

    expect(sceneCards).toHaveLength(4);
    for (const card of sceneCards) {
      expect(card.location.length).toBeGreaterThan(0);
      expect(card.conflict.length).toBeGreaterThan(0);
      expect(card.participants.length).toBeGreaterThan(0);
      expect(card.hardFacts.length).toBeGreaterThan(0);
      expect(card.transitionIn.length).toBeGreaterThan(0);
      expect(card.transitionOut.length).toBeGreaterThan(0);
    }
  });

  test("drafts long chapters from more short beats without exposing scene headings in final prose", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(sampleDraft));
    const stageResult = engine.runStage({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰", "苏雪"],
    });
    const narrative = draftNarrative({
      line: engine.getCanonLine(),
      lens: {
        focusCharacterIds: ["林焰", "苏雪"],
        style: "omniscient-web",
        stageRange: [stageResult.canonStage.id],
        sceneCount: 7,
        targetLength: [2800, 3300],
        factConstraint: "medium-expansion",
      },
    });

    expect(narrative.sceneDrafts).toHaveLength(7);
    for (const scene of narrative.sceneDrafts) {
      expect(scene.text.length).toBeGreaterThanOrEqual(280);
      expect(scene.text.length).toBeLessThanOrEqual(620);
    }
    expect(narrative.chapterText.length).toBeGreaterThanOrEqual(2800);
    expect(narrative.chapterText.length).toBeLessThanOrEqual(3300);
    expect(narrative.chapterText).not.toMatch(/【第\d+场/);
    expect(narrative.chapterText).toContain("下一章");
    expect(narrative.review.passed).toBe(true);
  });

  test("reviewer blocks forbidden moves when prose crosses hard fact boundaries", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(sampleDraft));
    const stageResult = engine.runStage({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰"],
    });
    const recommended = stageResult.branchEvaluations.find((branch) => branch.recommended);

    const narrative = draftNarrative({
      line: engine.getLine(recommended?.branchId),
      lens: {
        focusCharacterIds: ["苏雪"],
        style: "omniscient-web",
        stageRange: [stageResult.canonStage.id],
        sceneCount: 4,
        targetLength: [1500, 2500],
        factConstraint: "medium-expansion",
      },
    });

    const review = reviewChapterDraft(
      {
        ...narrative,
        chapterText: `${narrative.chapterText}\n\n韩渡忽然改邪归正，当场与林焰并肩结盟，旧日宿怨一笔勾销。`,
        text: `${narrative.chapterText}\n\n韩渡忽然改邪归正，当场与林焰并肩结盟，旧日宿怨一笔勾销。`,
      },
      narrative.sourcePack,
    );

    expect(review.passed).toBe(false);
    expect(review.issues.some((issue) => issue.includes("改邪归正"))).toBe(true);
  });

  test("reviewer uses the lens target length instead of the old short-chapter default", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(sampleDraft));
    const stageResult = engine.runStage({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰"],
    });
    const narrative = draftNarrative({
      line: engine.getCanonLine(),
      lens: {
        focusCharacterIds: ["苏雪"],
        style: "omniscient-web",
        stageRange: [stageResult.canonStage.id],
        sceneCount: 4,
        targetLength: [2800, 3300],
        factConstraint: "medium-expansion",
      },
    });
    const chapterText = [
      "【第1场：山城压局】",
      narrative.sourcePack.qimenContext.locationFocus,
      ...narrative.sourcePack.hardFacts,
      "林焰在众目之下稳住呼吸，苏雪没有急着替他辩解，只把局势往执法堂的规矩上压。",
      "下一章，丹谷深处会把真正的压力推到台前。",
      "山城钟声与人群低语反复推挤，门规、残图、寒池旧账都在这一刻缠成一根绳。",
      "林焰".repeat(1300),
    ].join("。");

    const review = reviewChapterDraft(
      {
        ...narrative,
        chapterText,
        text: chapterText,
      },
      narrative.sourcePack,
      { targetLength: [2800, 3300] },
    );

    expect(chapterText.length).toBeGreaterThanOrEqual(2800);
    expect(chapterText.length).toBeLessThanOrEqual(3300);
    expect(review.issues.some((issue) => issue.includes("字数"))).toBe(false);
  });

  test("generates ranked bazi candidates from a natural-language character description", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(metaphysicsDraft));

    const candidates = engine.getBaziCandidates("林焰");

    expect(candidates.length).toBeGreaterThanOrEqual(3);
    expect(candidates[0].scores.characterFit).toBeGreaterThan(0);
    expect(candidates[0].explanation.summary.length).toBeGreaterThan(0);
  });

  test("supports raw bazi and archetype inputs through a unified fate profile", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(metaphysicsDraft));

    const suxue = engine.getSelectedFateProfile("苏雪");
    const handu = engine.getSelectedFateProfile("韩渡");

    expect(suxue.sourceMode).toBe("bazi");
    expect(handu.sourceMode).toBe("archetype");
    expect(suxue.dominantElements.length).toBeGreaterThan(0);
    expect(handu.dominantElements.length).toBeGreaterThan(0);
    expect(typeof suxue.initiative).toBe("number");
    expect(typeof handu.initiative).toBe("number");
  });

  test("lets the author select a candidate before simulation", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(metaphysicsDraft));
    const candidates = engine.getBaziCandidates("林焰");
    const alternative = candidates.at(-1);

    engine.selectBaziCandidate("林焰", alternative!.id);

    expect(engine.getSelectedFateProfile("林焰").candidateId).toBe(alternative!.id);
  });

  test("uses fate profiles and fortune cycles to differentiate reactions in the same stage", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(metaphysicsDraft));

    const firstStage = engine.runStage({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰", "韩渡"],
    });
    const secondStage = engine.runStage({
      stageLabel: "丹谷风波",
      focusCharacterIds: ["林焰"],
      intervention: "地火丹谷丹炉爆裂，执法堂勒令半日封谷搜查内应。",
    });

    const linhuo = firstStage.canonStage.snapshot.characters["林焰"];
    const handu = firstStage.canonStage.snapshot.characters["韩渡"];
    const laterLinyan = secondStage.canonStage.snapshot.characters["林焰"];

    expect(linhuo.lastAction).not.toBe(handu.lastAction);
    expect(linhuo.notes.some((note) => note.includes("本命"))).toBe(true);
    expect(handu.notes.some((note) => note.includes("本命"))).toBe(true);
    expect(laterLinyan.currentFortune.cycleLabel).not.toBe(linhuo.currentFortune.cycleLabel);
  });

  test("lets qimen modify both event timing and outcome scoring", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(metaphysicsDraft));

    const result = engine.runStage({
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰"],
      qimenOverride: {
        sourceMode: "manual",
        pattern: "开门值使",
        locationFocus: "地火丹谷",
      },
    });

    expect(result.canonStage.qimenModifier.timingShift).toBeDefined();
    expect(result.canonStage.qimenModifier.outcomeBias).toBeDefined();
    expect(result.branchEvaluations.some((branch) => Math.abs(branch.scores.qimenTimingImpact) > 0)).toBe(true);
    expect(result.branchEvaluations.some((branch) => Math.abs(branch.scores.qimenOutcomeImpact) > 0)).toBe(true);
  });

  test("requires both a strong situation and explicit permission before qimen hard-decides", () => {
    const engine = new WorldHistoryEngine(parseWorldDraft(metaphysicsDraft));

    const weightedOnly = engine.runStage({
      stageLabel: "丹谷强局",
      focusCharacterIds: ["苏雪"],
      intervention: "丹谷炉心失衡，玄火倒灌，宗门高层同时闭关。",
      qimenOverride: {
        sourceMode: "manual",
        pattern: "惊门迫宫",
      },
    });

    const hardDecided = engine.runStage({
      stageLabel: "丹谷强局再临",
      focusCharacterIds: ["苏雪"],
      intervention: "丹谷炉心失衡，玄火倒灌，宗门高层同时闭关，外敌压境。",
      qimenOverride: {
        sourceMode: "manual",
        pattern: "惊门迫宫",
        allowHardDecision: true,
      },
    });

    expect(weightedOnly.canonStage.qimenModifier.hardDecision).toBeUndefined();
    expect(hardDecided.canonStage.qimenModifier.hardDecision).toBeDefined();
  });

  test("renders folded and expanded metaphysics explanations in reports", () => {
    const folded = buildDemoReport(metaphysicsDraft);
    const expanded = buildDemoReport(metaphysicsDraft, { expandMetaphysics: true });

    expect(folded).not.toContain("术数解释");
    expect(expanded).toContain("术数解释");
    expect(expanded).toContain("本命层");
    expect(expanded).toContain("运势层");
    expect(expanded).toContain("奇门层");
  });
});
