import {
  ChapterDraft,
  ChapterPlan,
  HistoryEvent,
  NarrativeDraft,
  NarrativeLens,
  NarrativeSourcePack,
  QimenModifier,
  ReviewReport,
  SceneCard,
  SceneDraft,
  TimelineLine,
  WritingDirective,
  WritingRunRecord,
} from "./domain";
import { buildChapterInputFromLens } from "./read-models";

const DEFAULT_TARGET_LENGTH: [number, number] = [2800, 3300];
const DEFAULT_SCENE_COUNT = 5;
const DEFAULT_MODEL_NAME = "deepseek-reasoner";

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function shortTitlePart(value: string, fallback: string): string {
  const cleaned = value
    .replace(/^章节目标[:：]?/, "")
    .replace(/^(写出|展示|承接|围绕|推进|描写)/, "")
    .replace(/[。！？!?；;，,].*$/, "")
    .replace(/这一章/g, "")
    .split(/[时里中：:]/)[0]
    .trim();
  return cleaned.slice(0, 12) || fallback;
}

function deriveChapterTitle(sourcePack: NarrativeSourcePack, directive: Required<WritingDirective>): string {
  const focus = sourcePack.qimenContext.locationFocus || sourcePack.lineLabel || "局中";
  const goal = shortTitlePart(directive.chapterGoal, "风起");
  return goal === "风起" ? `${focus}风起`.slice(0, 12) : goal;
}

function proseParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function resolveWritingDirective(lens: NarrativeLens): Required<WritingDirective> {
  return {
    chapterGoal: lens.chapterGoal ?? "写出这一段历史如何从暗流变成公开碰撞",
    narratorMode: "omniscient-ensemble",
    proseStyle: "web-xianxia-ensemble",
    targetLength: lens.targetLength ?? DEFAULT_TARGET_LENGTH,
    sceneCount: lens.sceneCount ?? DEFAULT_SCENE_COUNT,
    factConstraint: lens.factConstraint ?? "medium-expansion",
  };
}

function timingSummary(modifier: QimenModifier): string {
  switch (modifier.timingShift) {
    case "advance":
      return "局势比常人预想得更早合拢";
    case "delay":
      return "局势被强行拖住半拍";
    case "redirect":
      return "局势忽然折向侧面";
    default:
      return "局势仍沿着常规轨道推进";
  }
}

function outcomeSummary(modifier: QimenModifier): string {
  switch (modifier.outcomeBias) {
    case "boost":
      return "得势的一方更容易趁势压人";
    case "drag":
      return "所有动作都被看不见的阻力拖慢";
    case "twist":
      return "结果会在最后一刻生出偏锋";
    default:
      return "结果仍在可以预估的范围内摇摆";
  }
}

function firstSentence(text: string): string {
  const sentence = text
    .split(/(?<=[。！？])/)
    .map((segment) => segment.trim())
    .find(Boolean);
  return sentence ?? text.trim();
}

function selectNarrativeEvents(line: TimelineLine, lens: NarrativeLens): HistoryEvent[] {
  const stageScoped = line.events.filter((event) => {
    return lens.stageRange.length === 0 || lens.stageRange.includes(event.stageId);
  });

  if (stageScoped.length === 0) {
    return line.events.slice(-2);
  }

  if (lens.focusCharacterIds.length === 0) {
    return stageScoped;
  }

  const focusScoped = stageScoped.filter((event) =>
    lens.focusCharacterIds.some((focusId) => event.participants.includes(focusId)),
  );

  return focusScoped.length > 0 ? focusScoped : stageScoped;
}

function matchReferenceStage(line: TimelineLine, lens: NarrativeLens) {
  const stage = [...line.stages]
    .reverse()
    .find((candidate) => lens.stageRange.length === 0 || lens.stageRange.includes(candidate.id));
  return stage ?? line.stages.at(-1);
}

function buildHardFacts(events: HistoryEvent[]): string[] {
  const eventFacts = events.slice(0, 2).map((event) => `${event.title}：${firstSentence(event.summary)}`);
  const stateFacts = events
    .flatMap((event) => event.stateChanges)
    .slice(0, 2)
    .map((stateChange) => `已发生状态：${stateChange}`);
  return unique([...eventFacts, ...stateFacts]);
}

function buildForbiddenMoves(line: TimelineLine, referenceStageId: string | undefined): string[] {
  const snapshot = referenceStageId ? line.snapshots[referenceStageId] : undefined;
  if (!snapshot) {
    return ["不得改写关键事件结果", "不得逆转正史或分叉归属"];
  }

  const forbidden = [
    "不得改写关键事件结果",
    "不得逆转正史或分叉归属",
  ];

  for (const state of Object.values(snapshot.characters)) {
    if (state.stance !== "守宗") {
      forbidden.push(`不得写${state.name}突然改邪归正`);
    }
    if (!state.alive) {
      forbidden.push(`不得写${state.name}死而复生`);
    }
  }

  for (const relation of Object.values(snapshot.relationships)) {
    if (relation.hostility >= 80) {
      forbidden.push(`不得写${relation.left}与${relation.right}无因并肩结盟`);
    }
    if (relation.trust <= 20) {
      forbidden.push(`不得写${relation.left}与${relation.right}无因互信`);
    }
  }

  return unique(forbidden);
}

function makeRunRecord(
  step: WritingRunRecord["step"],
  promptVersion: string,
  inputSummary: string,
  rawOutput: string,
  conclusion: string,
): WritingRunRecord {
  return {
    step,
    promptVersion,
    modelName: DEFAULT_MODEL_NAME,
    inputSummary,
    rawOutput,
    conclusion,
  };
}

function castLine(participants: string[]): string {
  return participants.join("、");
}

function ensureTerminalPunctuation(text: string): string {
  const normalized = text.trim();
  if (!normalized) {
    return "";
  }
  return /[。！？；.!?;]$/.test(normalized) ? normalized : `${normalized}。`;
}

function sceneVariantLocation(base: string, order: number): string {
  if (base.includes("丹谷")) {
    return ["丹谷谷口", "地火炉室外沿", "丹谷禁制深处", "丹谷上空火云下"][order - 1] ?? base;
  }
  return ["外门山城山道", "山城内圈石坪", "山城偏巷与观台之间", "山城高处风口"][order - 1] ?? base;
}

function timeLabel(order: number): string {
  return ["局起之时", "锋芒相抵时", "压力倒卷时", "余波未定时"][order - 1] ?? "局中时刻";
}

function splitFactsByScene(hardFacts: string[], sceneCount: number): string[][] {
  const buckets = Array.from({ length: sceneCount }, () => [] as string[]);
  hardFacts.forEach((fact, index) => {
    buckets[index % sceneCount].push(fact);
  });
  return buckets.map((bucket, index) => (bucket.length > 0 ? bucket : [hardFacts[index % hardFacts.length] ?? "局势继续推进"]));
}

export function buildNarrativeSourcePack(input: {
  line: TimelineLine;
  lens: NarrativeLens;
}): NarrativeSourcePack {
  const { line, lens } = input;
  const selectedEvents = selectNarrativeEvents(line, lens);
  const referenceStage = matchReferenceStage(line, lens);
  const snapshot = referenceStage?.snapshot;
  const directive = resolveWritingDirective(lens);

  const characterSummaries = snapshot
    ? Object.values(snapshot.characters).map(
        (state) => `${state.name}以“${state.lastAction}”应局，立场为${state.stance}，当前压力${state.pressure}。`,
      )
    : [];
  const relationshipSummaries = snapshot
    ? Object.values(snapshot.relationships).map(
        (state) => `${state.left}与${state.right}维持“${state.status}”，信任${state.trust}，敌意${state.hostility}。`,
      )
    : [];

  const hardFacts = buildHardFacts(selectedEvents);
  const qimenContext =
    referenceStage?.qimenContext ?? {
      sourceMode: "auto" as const,
      pattern: "休门稳局",
      locationFocus: "局中要地",
      eventType: "常规推进",
      strongSituationScore: 0,
    };
  const qimenModifier =
    referenceStage?.qimenModifier ?? {
      timingShift: "steady" as const,
      outcomeBias: "steady" as const,
      timingWeight: 0,
      outcomeWeight: 0,
    };
  const metaphysicsExplanation =
    referenceStage?.metaphysicsExplanation ?? {
      summary: "当前章节沿用已知历史事实。",
      fateLayer: "本命解释未展开。",
      fortuneLayer: "运势解释未展开。",
      qimenLayer: "奇门解释未展开。",
    };
  const chapterInputView = buildChapterInputFromLens({ line, lens });

  return {
    lineId: line.lineId,
    lineLabel: line.label,
    stageIds: unique(selectedEvents.map((event) => event.stageId)),
    selectedEventIds: selectedEvents.map((event) => event.id),
    events: selectedEvents,
    qimenContext,
    qimenModifier,
    metaphysicsExplanation,
    worldPressureSummary: `${qimenContext.locationFocus}受${qimenContext.pattern}牵动，${timingSummary(
      qimenModifier,
    )}，${outcomeSummary(qimenModifier)}。`,
    palaceSummary: `${qimenContext.locationFocus}成为这一章的主压区域，事件类型为${qimenContext.eventType}。`,
    characterSummaries,
    relationshipSummaries,
    hardFacts,
    softExpansionBudget:
      directive.factConstraint === "medium-expansion"
        ? ["允许补场间过渡", "允许补次级动作", "允许补环境描写", "允许补心理判断", "允许补余波与压迫感"]
        : ["只允许最小幅度过渡补写"],
    forbiddenMoves: buildForbiddenMoves(line, referenceStage?.id),
    chapterInputView,
  };
}

export function planChapter(sourcePack: NarrativeSourcePack, lens: NarrativeLens): ChapterPlan {
  const directive = resolveWritingDirective(lens);
  const mainConflict = sourcePack.hardFacts[0] ?? sourcePack.worldPressureSummary;
  const secondaryConflict =
    sourcePack.hardFacts[1] ??
    sourcePack.relationshipSummaries[0] ??
    `${sourcePack.qimenContext.locationFocus}里的局势继续逼人表态。`;
  const closingHook =
    sourcePack.qimenModifier.outcomeBias === "twist"
      ? "看似落定的一击在章末偏出一线，逼出下一章真正的反扑。"
      : "章末只把局面压到最紧处，把真正的胜负留到下一章掀开。";
  const sceneOrder = Array.from({ length: directive.sceneCount }, (_, index) => `scene-${index + 1}`);
  const summary =
    `章节目标：${directive.chapterGoal} ` +
    `主冲突：${mainConflict} ` +
    `副冲突：${secondaryConflict} ` +
    `结尾钩子：${closingHook}`;

  return {
    chapterTitle: deriveChapterTitle(sourcePack, directive),
    chapterGoal: directive.chapterGoal,
    stageRange: sourcePack.stageIds,
    mainConflict,
    secondaryConflict,
    closingHook,
    sceneOrder,
    summary,
  };
}

export function generateSceneCards(sourcePack: NarrativeSourcePack, plan: ChapterPlan): SceneCard[] {
  const participants = unique(sourcePack.events.flatMap((event) => event.participants));
  const factBuckets = splitFactsByScene(sourcePack.hardFacts, plan.sceneOrder.length);
  const sceneGoals = [
    "开场拉局",
    "第一层试探",
    "冲突显化",
    "旁支误判",
    "局势反转",
    "压力加码",
    "收束并挂钩下一章",
  ];
  const transitionsIn = [
    "上一段暗流终于翻到明处",
    "没有人先把话说死，只用半步试探彼此底线",
    "第一轮试探没有收住，锋芒顺势压了下来",
    "旁人以为局面只是僵住，暗处却先错判了一步",
    "局面看似定住，真正的反压却在背后抬头",
    "压力不再停在明面上，而是顺着规矩和人心一起往里压",
    "所有人都以为此局要收口，余波却先一步叩向下一章",
  ];
  const transitionsOut = [
    "因此下一场不再是试探，而是正面挤压",
    "这一点迟疑，很快就会被对手当成破绽",
    "于是场中人都明白，再退就会把主动让出去",
    "误判没有立刻爆开，却已经改掉下一步的方向",
    "于是本该封死的口子反而被逼出新的缝",
    "所有人的退路都被压窄，只剩一个必须面对的口子",
    plan.closingHook,
  ];

  return plan.sceneOrder.map((sceneId, index) => {
    const order = index + 1;
    return {
      id: sceneId,
      order,
      location: sceneVariantLocation(sourcePack.qimenContext.locationFocus, order),
      time: timeLabel(order),
      participants:
        order === 1
          ? participants
          : order === 2
            ? participants.slice(0, Math.max(2, participants.length - 1))
            : order === 3
              ? [...participants].reverse()
              : participants,
      sceneGoal: sceneGoals[index] ?? "继续推进局势",
      conflict:
        order === 1
          ? plan.mainConflict
          : order === 2
            ? plan.secondaryConflict
            : order === 3 || order === 5
              ? `${plan.mainConflict}开始反噬原本的算盘`
              : order === plan.sceneOrder.length
                ? plan.closingHook
              : plan.closingHook,
      hardFacts: factBuckets[index],
      softExpansionBudget: sourcePack.softExpansionBudget.slice(0, 3),
      transitionIn: transitionsIn[index] ?? "局势继续推进",
      transitionOut: transitionsOut[index] ?? "局势继续向后卷动",
      focusCue:
        order === 1
          ? "先写局，再落到人"
          : order === plan.sceneOrder.length
            ? "收束当前冲突，并把钩子挂到下一章"
            : "全知叙述俯视群像，同时贴近关键人物的一瞬判断",
    };
  });
}

function sceneAtmosphere(order: number, location: string): string[] {
  const shared = [
    `${location}这一线的灵机先一步发紧，旁观者尚未看清源头，局中人却已经各自把手按到最顺手的筹码上。`,
    `风声、脚步声和法器碰撞的轻响混成一片，谁都没有把话挑明，可每一个眼神都在逼问对方到底想走到哪一步。`,
  ];
  if (order === 1) {
    return [
      ...shared,
      "这一场不是单独某个人的心事，而是三方势力第一次在同一条线上同时暴露自己的野心与顾忌。",
    ];
  }
  if (order === 2) {
    return [
      ...shared,
      "局面一旦从暗处翻到明处，所有原本还能遮掩的算计都不得不现出棱角，谁退谁就先失掉半分气势。",
    ];
  }
  if (order === 3) {
    return [
      ...shared,
      "真正要命的从来不是表面的火药味，而是每个人都意识到，再往前半步，就可能把自己此前苦苦压住的东西一并掀开。",
    ];
  }
  return [
    ...shared,
    "到了这一刻，哪怕局面表面上有了收束的样子，真正懂行的人也知道，这不过是更大风浪压过来的前一息。 ",
  ];
}

function participantBeats(participants: string[]): string[] {
  const names = participants.map((participant) => participant.trim()).filter(Boolean);
  if (names.length === 0) {
    return ["场中压力无人能够独善其身，每一次进退都会把局势往更紧处推。"];
  }

  const templates = [
    (name: string) => `${name}最先感觉到压力落在自己身上，却也正因为如此，比旁人更不肯在这一口气上后退。`,
    (name: string) => `${name}看得比谁都清楚：局若再乱半步，后果不会只落在一个人头上，因此每一步都得先替整盘局算账。`,
    (name: string) => `${name}表面退在半步之外，心里却始终盯着那条最容易被忽视的缝；越是乱，越能从别人顾不到的地方摸到机会。`,
    (name: string) => `${name}没有急着抢话，只把所有细微变化都压进下一次出手之前。`,
  ];

  return names.slice(0, templates.length).map((name, index) => templates[index](name));
}

function padParagraph(text: string, targetLength: number): string {
  const expansions = [
    "旁观者只能看见表面的进退，真正的轻重却压在每个人没说出口的判断里。",
    "在这种局里，任何一个细小的误判都会被放大，任何一点迟疑都会被对手当成可乘之机。",
    "所以他们看上去只是多说了一句、多走了一步，实则每一下都在试着把整盘局往对自己有利的方向拧过去。",
    "这也是群像局最凶的地方：没有谁能只顾自己，因为别人每一次呼吸都可能改掉自己接下来的命数。",
  ];
  let index = 0;
  let output = text;
  while (output.length < targetLength) {
    output += expansions[index % expansions.length];
    index += 1;
  }
  return output;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function stripSceneHeading(text: string): string {
  return text.replace(/^【第\d+场：[^】]+】/, "").trim();
}

function trimAtSentenceBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  const sliced = text.slice(0, maxLength);
  const lastStop = Math.max(
    sliced.lastIndexOf("。"),
    sliced.lastIndexOf("！"),
    sliced.lastIndexOf("？"),
    sliced.lastIndexOf("；"),
  );
  return (lastStop > Math.floor(maxLength * 0.72) ? sliced.slice(0, lastStop + 1) : sliced).trim();
}

function weaveChapterText(
  sourcePack: NarrativeSourcePack,
  plan: ChapterPlan,
  sceneDrafts: SceneDraft[],
  directive: Required<WritingDirective>,
): string {
  const [minLength, maxLength] = directive.targetLength;
  const transitions = [
    "这一下没有立刻炸开，却把所有人的位置都照得分明。",
    "局势真正往前滑动，是从旁人以为还能含混过去的那一息开始的。",
    "到了中段，明面上的争执反而退后半步，暗处的压力先压了上来。",
    "可越是这种时候，越没有人敢把话说死。",
    "于是原本像余波的东西，反倒成了下一轮逼迫的起点。",
    "等众人终于意识到不对，局已经不再按最初的方向走。",
    "最后留下来的不是胜负，而是谁都绕不开的下一道口子。",
  ];
  const paragraphs = sceneDrafts.map((scene, index) => {
    const body = stripSceneHeading(scene.text);
    const transition = index === 0 ? "" : transitions[(index - 1) % transitions.length];
    return [transition, body].filter(Boolean).join("");
  });
  let chapter = paragraphs.join("\n\n");
  const closing = plan.closingHook.includes("下一章")
    ? plan.closingHook
    : `${plan.closingHook}下一章，${sourcePack.qimenContext.locationFocus}里真正被藏住的那一手才会翻到明处。`;
  if (!chapter.includes("下一章")) {
    chapter += `\n\n${closing}`;
  }
  const expansions = [
    `而${sourcePack.qimenContext.locationFocus}的风声没有停，反而把那些没说出口的判断一层层推到人前。`,
    "有人只看见场面暂时压住了，真正懂局的人却知道，这一压只是把裂缝藏得更深。",
    "每个人都在等别人先露破绽，可等待本身也在消耗他们手里最后一点余地。",
    "这才像一章真正要留下的余味：表面收束，暗处仍有东西继续往前走。",
  ];
  let index = 0;
  while (chapter.length < minLength || proseParagraphs(chapter).length < 6) {
    chapter += `\n\n${expansions[index % expansions.length]}`;
    index += 1;
  }
  return trimAtSentenceBoundary(chapter, maxLength);
}

function composeSceneDraft(
  card: SceneCard,
  sourcePack: NarrativeSourcePack,
  plan: ChapterPlan,
  directive: Required<WritingDirective>,
): SceneDraft {
  const averageTarget = ((directive.targetLength[0] + directive.targetLength[1]) / 2) / directive.sceneCount;
  const perSceneTarget = clamp(Math.floor(averageTarget * 0.82), 300, 520);
  const cast = castLine(card.participants);
  const facts = card.hardFacts.map((fact) => ensureTerminalPunctuation(fact)).join("");
  const atmosphere = sceneAtmosphere(card.order, card.location).join("");
  const beats = participantBeats(card.participants).join("");
  const text = padParagraph(
    `【第${card.order}场：${card.sceneGoal}】` +
      `${card.time}，${card.location}成了这一段历史最先绷紧的地方。` +
      `${sourcePack.palaceSummary}${card.transitionIn}。` +
      `${cast}都被这一线拉到同一张盘面上，谁也不再只代表自己。` +
      `${facts}` +
      `${atmosphere}` +
      `${beats}` +
      `真正把这一场往前推的，不只是单独某个人的勇与怯，而是${plan.mainConflict}已经逼得每一个人都必须表态。` +
      `${card.transitionOut}。`,
    perSceneTarget,
  );

  return {
    sceneId: card.id,
    title: `${card.sceneGoal}·${card.location}`,
    summary: `${card.location}里，${card.conflict}`,
    text,
    runRecord: makeRunRecord(
      "composer",
      "writer.composer.v1",
      `${card.id}:${card.location}:${card.conflict}`,
      text,
      `已生成${card.id}正文`,
    ),
  };
}

function composeChapterDraft(
  sourcePack: NarrativeSourcePack,
  plan: ChapterPlan,
  sceneCards: SceneCard[],
  directive: Required<WritingDirective>,
): ChapterDraft {
  const sceneDrafts = sceneCards.map((card) => composeSceneDraft(card, sourcePack, plan, directive));
  const chapterText = weaveChapterText(sourcePack, plan, sceneDrafts, directive);
  return {
    plan,
    sceneDrafts,
    chapterText,
    review: {
      passed: true,
      issues: [],
      warnings: [],
      styleNotes: [],
      factCoverage: 1,
      suggestedRewrites: [],
    },
    runRecords: sceneDrafts.map((scene) => scene.runRecord),
  };
}

export function assembleChapterDraft(
  draft: ChapterDraft,
  sourcePack: NarrativeSourcePack,
  lens: NarrativeLens,
): ChapterDraft {
  const directive = resolveWritingDirective(lens);
  return {
    ...draft,
    chapterText: weaveChapterText(sourcePack, draft.plan, draft.sceneDrafts, directive),
  };
}

export function reviewChapterDraft(
  draft: NarrativeDraft | ChapterDraft,
  sourcePack: NarrativeSourcePack,
  lens?: Pick<NarrativeLens, "targetLength"> | { targetLength?: [number, number] },
): ReviewReport {
  const text = "chapterText" in draft ? draft.chapterText : "";
  const sceneCount = "sceneDrafts" in draft ? draft.sceneDrafts.length : 0;
  const targetLength = lens?.targetLength ?? DEFAULT_TARGET_LENGTH;
  const paragraphs = proseParagraphs(text);
  const issues: string[] = [];
  const warnings: string[] = [];
  const styleNotes: string[] = [];

  const hardFactMatches = sourcePack.hardFacts.filter((fact) => text.includes(fact)).length;
  const factCoverage = sourcePack.hardFacts.length === 0 ? 1 : hardFactMatches / sourcePack.hardFacts.length;

  if (sceneCount < 3 || sceneCount > 8) {
    issues.push("章节 beat 数必须稳定在3-8段。");
  }

  if (text.length < targetLength[0] || text.length > targetLength[1]) {
    issues.push(`章节字数偏离当前目标 ${targetLength[0]}-${targetLength[1]} 字。`);
  }

  if (!text.includes(sourcePack.qimenContext.locationFocus)) {
    warnings.push("正文没有明确显出当前阶段的空间焦点。");
  } else {
    styleNotes.push("章节已显出当前奇门空间焦点。");
  }

  if (paragraphs.length < 6) {
    issues.push("完整章节必须至少 6 个自然段，不能压成一个超长段落。");
  } else {
    styleNotes.push("完整章节已分成可阅读的自然段。");
  }

  if ("sceneDrafts" in draft) {
    const incompleteScenes = draft.sceneDrafts.filter((scene) => scene.text.trim().length < 40);
    if (incompleteScenes.length > 0) {
      issues.push("完整章节存在未完成场景，不能在关键选择前截断。");
    }
  }

  if (factCoverage < 0.7) {
    issues.push("正文未覆盖足够多的硬事实。");
  } else {
    styleNotes.push("章节保留了主要硬事实。");
  }

  if (sourcePack.forbiddenMoves.some((move) => move.includes("改邪归正")) && text.includes("改邪归正")) {
    issues.push("正文写入了被禁止的“改邪归正”越界改写。");
  }
  if (sourcePack.forbiddenMoves.some((move) => move.includes("并肩结盟")) && text.includes("并肩结盟")) {
    issues.push("正文写入了被禁止的“无因并肩结盟”越界改写。");
  }
  if (sourcePack.forbiddenMoves.some((move) => move.includes("无因互信")) && text.includes("无因互信")) {
    issues.push("正文写入了被禁止的关系硬转向。");
  }

  if (text.includes("被推到这段历史的近景中央")) {
    issues.push("正文仍停留在旧的摘要式转写表达。");
  }

  if (/【第\d+场/.test(text)) {
    warnings.push("完整章节仍残留工程场景标题，建议用自然小说段落织写。");
  } else {
    styleNotes.push("完整章节没有暴露工程场景标题。");
  }

  if (!text.includes("下一章")) {
    issues.push("章末钩子未落到正文中，完整章节不能停在未收束的中段。");
  } else {
    styleNotes.push("章末保留了网文章节钩子。");
  }

  return {
    passed: issues.length === 0,
    issues,
    warnings,
    styleNotes,
    factCoverage,
    suggestedRewrites:
      issues.length > 0 ? ["优先重写越界场景，再补强硬事实覆盖。"] : ["保持当前节奏，只需按后续世界史继续推进。"],
  };
}

export function draftNarrative(input: {
  line: TimelineLine;
  lens: NarrativeLens;
}): NarrativeDraft {
  const { line, lens } = input;
  const directive = resolveWritingDirective(lens);
  const sourcePack = buildNarrativeSourcePack({ line, lens });
  const plan = planChapter(sourcePack, lens);
  const plannerRecord = makeRunRecord(
    "planner",
    "writer.planner.v1",
    `${sourcePack.lineId}:${sourcePack.stageIds.join(",")}`,
    JSON.stringify(plan),
    "已生成章节计划",
  );
  const sceneCards = generateSceneCards(sourcePack, plan);
  const sceneCardRecord = makeRunRecord(
    "scene-card",
    "writer.scene-card.v1",
    `${plan.chapterGoal}:${sceneCards.length}场`,
    JSON.stringify(sceneCards),
    "已生成场景卡",
  );
  const chapterDraft = composeChapterDraft(sourcePack, plan, sceneCards, directive);
  const review = reviewChapterDraft(chapterDraft, sourcePack, lens);
  const reviewRecord = makeRunRecord(
    "reviewer",
    "writer.reviewer.v1",
    `${plan.chapterGoal}:${chapterDraft.chapterText.length}字`,
    JSON.stringify(review),
    review.passed ? "复核通过" : "复核未通过",
  );

  return {
    ...chapterDraft,
    focusCharacterIds: [...lens.focusCharacterIds],
    selectedEventIds: sourcePack.selectedEventIds,
    sceneIds: sceneCards.map((scene) => scene.id),
    planSummary: `主冲突：${plan.mainConflict} / 副冲突：${plan.secondaryConflict} / 结尾钩子：${plan.closingHook}`,
    sceneSummaries: chapterDraft.sceneDrafts.map((scene) => `${scene.title}：${scene.summary}`),
    sourcePack,
    chapterText: chapterDraft.chapterText,
    text: chapterDraft.chapterText,
    review,
    runRecords: [plannerRecord, sceneCardRecord, ...chapterDraft.runRecords, reviewRecord],
  };
}

export function rewriteNarrativeScene(
  draft: NarrativeDraft,
  sceneId: string,
  instruction: string,
): NarrativeDraft {
  const nextSceneDrafts = draft.sceneDrafts.map((scene) => {
    if (scene.sceneId !== sceneId) {
      return scene;
    }
    return {
      ...scene,
      summary: `${scene.summary}（已按指令重写）`,
      text: `${scene.text}\n\n【局部重写】${instruction}：于是这一场的锋芒被进一步压紧，人物之间的试探改成更直接的逼问。`,
    };
  });

  const chapterText = nextSceneDrafts.map((scene) => scene.text).join("\n\n");
  const review = reviewChapterDraft(
    {
      ...draft,
      sceneDrafts: nextSceneDrafts,
      chapterText,
      text: chapterText,
    },
    draft.sourcePack,
  );

  const rewriteRecord = makeRunRecord(
    "reviewer",
    "writer.rewrite.local.v1",
    `${sceneId}:${instruction}`,
    chapterText,
    `已按指令重写 ${sceneId}`,
  );

  return {
    ...draft,
    sceneDrafts: nextSceneDrafts,
    sceneSummaries: nextSceneDrafts.map((scene) => `${scene.title}：${scene.summary}`),
    chapterText,
    text: chapterText,
    review,
    runRecords: [...draft.runRecords, rewriteRecord],
  };
}
