import {
  BranchEvaluation,
  BranchProposal,
  CanonLine,
  CharacterAnchor,
  CharacterProfile,
  CharacterState,
  ParsedWorldDraft,
  RelationshipAnchor,
  RelationshipProfile,
  RelationshipState,
  SimulationStage,
  StageDirective,
  StageResult,
  TimelineLine,
  WorldSnapshot,
  BaziCandidate,
  FateProfile,
  HistoryEvent,
  MetaphysicsExplanation,
  QimenContext,
  QimenModifier,
  SimulationEventProposal,
  SimulationStageProposal,
  cloneValue,
  pairKey,
} from "./domain";
import {
  buildBaziCandidates,
  buildFortuneCycle,
  buildQimenContext,
  buildQimenModifier,
  qimenExplanation,
} from "./metaphysics";
import { evaluateCanonGate } from "./canon-gate";
import { TruthKernel } from "./truth-core";
import { emitPromotion } from "./world-events/emit";

type OutcomeSpec = {
  title: string;
  key: string;
  spectacle: number;
  pacing: number;
  option: "canon" | "surge" | "cautious" | "rupture";
};

type StageContext = {
  stageId: string;
  stageNumber: number;
  stageLabel: string;
  focusCharacterIds: string[];
  intervention?: string;
  inputConstraints: string[];
  qimenContext: QimenContext;
  qimenModifier: QimenModifier;
  branchId?: string;
};

type RunStageOptions = {
  requireAuthorOnHighRisk?: boolean;
};

function statusProfile(status: string) {
  if (status.includes("盟友")) {
    return { trust: 78, hostility: 20 };
  }
  if (status.includes("公开冲突")) {
    return { trust: 10, hostility: 92 };
  }
  if (status.includes("并肩结盟")) {
    return { trust: 72, hostility: 18 };
  }
  if (status.includes("宿敌")) {
    return { trust: 12, hostility: 82 };
  }
  if (status.includes("戒备")) {
    return { trust: 24, hostility: 68 };
  }
  if (status.includes("仇")) {
    return { trust: 0, hostility: 100 };
  }
  return { trust: 50, hostility: 50 };
}

function relationNote(anchor: RelationshipAnchor | undefined, nextStatus: string): string[] {
  const notes = [];
  if (anchor?.trend) {
    notes.push(`关系趋势：${anchor.trend}`);
  }
  notes.push(`状态调整为${nextStatus}`);
  return notes;
}

function buildInitialSnapshot(
  parsed: ParsedWorldDraft,
  selectedProfiles: Map<string, FateProfile>,
): WorldSnapshot {
  const characters: Record<string, CharacterState> = {};
  const relationships: Record<string, RelationshipState> = {};

  for (const character of parsed.characters) {
    const fateProfile = selectedProfiles.get(character.id);
    if (!fateProfile) {
      throw new Error(`Missing fate profile for ${character.id}`);
    }
    characters[character.id] = {
      name: character.name,
      faction: character.faction,
      role: character.role,
      traits: [...character.traits],
      goal: character.goal,
      stance: character.stance,
      resource: character.resource,
      progress: 0,
      pressure: 0,
      lastAction: "idle",
      alive: true,
      notes: [],
      candidateId: fateProfile.candidateId,
      fateProfile,
      currentFortune: buildFortuneCycle(0, fateProfile),
    };
  }

  for (const relationship of parsed.relationships) {
    const profile = statusProfile(relationship.status);
    relationships[relationship.id] = {
      key: relationship.id,
      left: relationship.left,
      right: relationship.right,
      status: relationship.status,
      trust: profile.trust,
      hostility: profile.hostility,
      notes: [relationship.history, relationship.tension],
    };
  }

  return {
    stageId: "initial",
    characters,
    relationships,
    worldFlags: [],
  };
}

function findRelationshipState(snapshot: WorldSnapshot, left: string, right: string): RelationshipState {
  const direct = snapshot.relationships[pairKey(left, right)];
  if (direct) {
    return direct;
  }
  const reverse = snapshot.relationships[pairKey(right, left)];
  if (!reverse) {
    throw new Error(`Missing relationship between ${left} and ${right}`);
  }
  return reverse;
}

function setRelationshipStatus(
  snapshot: WorldSnapshot,
  left: string,
  right: string,
  status: string,
  anchor?: RelationshipAnchor,
): void {
  const relation = findRelationshipState(snapshot, left, right);
  const profile = statusProfile(status);
  relation.status = status;
  relation.trust = profile.trust;
  relation.hostility = profile.hostility;
  relation.notes = [...relation.notes, ...relationNote(anchor, status)];
}

function bumpCharacter(snapshot: WorldSnapshot, name: string, patch: Partial<CharacterState>): void {
  const state = snapshot.characters[name];
  if (!state) {
    return;
  }
  snapshot.characters[name] = {
    ...state,
    ...patch,
    notes: [...state.notes, ...(patch.notes ?? [])],
  };
}

function buildInputConstraints(parsed: ParsedWorldDraft, directive: StageDirective): string[] {
  const constraints = [
    `阶段：${directive.stageLabel}`,
    ...parsed.characterAnchors.map((anchor) => `${anchor.characterId}:${anchor.stageGoal}`),
  ];
  if (directive.intervention) {
    constraints.push(`外部干预：${directive.intervention}`);
  }
  if (directive.qimenOverride?.pattern) {
    constraints.push(`奇门覆写：${directive.qimenOverride.pattern}`);
  }
  return constraints;
}

function timingPrefix(modifier: QimenModifier): string {
  switch (modifier.timingShift) {
    case "advance":
      return "局势被提前点燃，";
    case "delay":
      return "局势被拖后半拍，";
    case "redirect":
      return "局势从偏门转向，";
    default:
      return "";
  }
}

function outcomePhrase(modifier: QimenModifier): string {
  switch (modifier.outcomeBias) {
    case "boost":
      return "这一手更容易得势";
    case "drag":
      return "这一手连番受阻";
    case "twist":
      return "结果偏向意料之外";
    default:
      return "结果仍在常规波动内";
  }
}

function chooseAction(
  state: CharacterState,
  isFocus: boolean,
  intervention: string | undefined,
  qimenModifier: QimenModifier,
): { action: string; notes: string[] } {
  const fate = state.fateProfile;
  const fortune = state.currentFortune;
  const notes = [
    `本命层：${fate.explainSummary}`,
    `运势层：当前处于${fortune.cycleLabel}，主题为${fortune.manifestationTheme}`,
  ];

  if (qimenModifier.hardDecision && qimenModifier.hardDecision.type === "outcome" && fate.initiative >= 7) {
    return {
      action: "借强局抢占先机",
      notes: [...notes, `奇门层：${qimenModifier.hardDecision.verdict}`],
    };
  }

  if (intervention && fate.opportunism >= 7) {
    return {
      action: qimenModifier.outcomeBias === "boost" ? "借乱渗透" : "趁乱试探",
      notes: [...notes, `奇门层：${outcomePhrase(qimenModifier)}`],
    };
  }

  if (isFocus && fate.initiative >= 7) {
    return {
      action: qimenModifier.timingShift === "advance" ? "抢先破局" : "迎压争先",
      notes: [...notes, `奇门层：${timingPrefix(qimenModifier)}适合主动出手`],
    };
  }

  if (fate.discipline >= 7) {
    return {
      action: intervention ? "稳炉镇局" : "稳住局势",
      notes: [...notes, "本命层：秩序感较强，优先维持盘面完整"],
    };
  }

  if (fortune.momentum === "strained") {
    return {
      action: "以退观局",
      notes: [...notes, "运势层：当前承压，不宜硬顶"],
    };
  }

  return {
    action: qimenModifier.timingShift === "redirect" ? "转锋试探" : "暗中蓄力",
    notes: [...notes, "本命层：先观后发"],
  };
}

function stageSummary(
  characters: CharacterProfile[],
  actions: Record<string, string>,
  qimenModifier: QimenModifier,
): string {
  return `${timingPrefix(qimenModifier)}${characters
    .map((character) => `${character.name}${actions[character.id]}`)
    .join("，")}。${outcomePhrase(qimenModifier)}。`;
}

function statusFromAnchor(
  relationship: RelationshipAnchor | undefined,
  option: OutcomeSpec["option"],
  context: StageContext,
  currentStatus: string,
): string {
  const trend = relationship?.trend ?? "";
  const boundary = relationship?.boundary ?? "";

  if (option === "rupture") {
    if (boundary.includes("不能突然并肩结盟")) {
      return "并肩结盟";
    }
    if (boundary.includes("不能无因反目成仇")) {
      return "仇敌";
    }
    if (boundary.includes("不能无因互信")) {
      return "互信盟友";
    }
    return currentStatus.includes("盟") ? "仇敌" : "并肩结盟";
  }

  if (trend.includes("公开冲突") || context.intervention || context.qimenModifier.timingShift === "advance") {
    if (trend.includes("盟友")) {
      return option === "cautious" ? "紧绷盟友" : "承压盟友";
    }
    return "公开冲突";
  }
  if (trend.includes("紧绷")) {
    return "紧绷盟友";
  }
  if (trend.includes("猜疑") || trend.includes("戒备")) {
    return "深度戒备";
  }
  if (trend.includes("结盟")) {
    return "并肩结盟";
  }
  if (option === "surge" && !currentStatus.includes("盟友")) {
    return "公开冲突";
  }
  return currentStatus;
}

function applyRelationshipTrajectory(
  snapshot: WorldSnapshot,
  parsed: ParsedWorldDraft,
  context: StageContext,
  option: OutcomeSpec["option"],
): string[] {
  const anchorsByRelation = new Map(parsed.relationshipAnchors.map((anchor) => [anchor.relationshipId, anchor]));
  const stateChanges: string[] = [];

  for (const relationship of parsed.relationships) {
    const anchor = anchorsByRelation.get(relationship.id);
    const currentState =
      snapshot.relationships[relationship.id] ??
      snapshot.relationships[pairKey(relationship.left, relationship.right)] ??
      snapshot.relationships[pairKey(relationship.right, relationship.left)];
    const nextStatus = statusFromAnchor(anchor, option, context, currentState?.status ?? relationship.status);
    setRelationshipStatus(snapshot, relationship.left, relationship.right, nextStatus, anchor);
    stateChanges.push(`${relationship.left}/${relationship.right}:${nextStatus}`);
  }

  return stateChanges;
}

function stageParticipants(parsed: ParsedWorldDraft): string[] {
  return parsed.characters.map((character) => character.name);
}

function coreSummary(parsed: ParsedWorldDraft, context: StageContext, option: OutcomeSpec["option"]): string {
  const focusNames = context.focusCharacterIds
    .map((id) => parsed.characters.find((character) => character.id === id)?.name ?? id)
    .filter(Boolean);
  const cast = stageParticipants(parsed);
  const lead = focusNames[0] ?? cast[0] ?? "局中人";
  const opponent = cast.find((name) => !focusNames.includes(name)) ?? cast[1] ?? lead;
  const pressure = context.intervention ? `受“${context.intervention}”压迫，` : "";

  if (option === "rupture") {
    return `${pressure}${lead}与${opponent}的关系被无铺垫地强行扭转，局势显得猛烈却冲撞既有边界。`;
  }
  if (option === "cautious") {
    return `${pressure}${lead}先稳住当前盘面，众人把真正的杀招压到下一轮。`;
  }
  if (option === "surge") {
    return `${pressure}${lead}抢先把暗处争夺推到明面，${opponent}被迫亮出更清晰的立场。`;
  }
  return `${pressure}${lead}沿着既有目标继续推进，${opponent}的反应把本阶段冲突抬到台前。`;
}

function buildStageExplanation(
  snapshot: WorldSnapshot,
  focusCharacterIds: string[],
  qimenContext: QimenContext,
  qimenModifier: QimenModifier,
): MetaphysicsExplanation {
  const focus = snapshot.characters[focusCharacterIds[0] ?? Object.keys(snapshot.characters)[0]] ?? Object.values(snapshot.characters)[0];
  if (!focus) {
    return {
      summary: "当前阶段缺少可解释角色。",
      fateLayer: "本命层：无角色可解释。",
      fortuneLayer: "运势层：无角色可解释。",
      qimenLayer: qimenExplanation(qimenContext, qimenModifier),
    };
  }
  return {
    summary: `${focus.name}的本命与当期运势共同决定了本阶段的起手方式，奇门再修正时机与成败。`,
    fateLayer: `本命层：${focus.name}当前采用“${focus.fateProfile.label}”，主元素为${focus.fateProfile.dominantElements.join("、")}，默认反应为${focus.fateProfile.pressureResponse}。`,
    fortuneLayer: `运势层：${focus.name}处于${focus.currentFortune.cycleLabel}，偏向${focus.currentFortune.riskBias}。`,
    qimenLayer: qimenExplanation(qimenContext, qimenModifier),
  };
}

function buildStage(
  snapshot: WorldSnapshot,
  context: StageContext,
  parsed: ParsedWorldDraft,
  option: OutcomeSpec["option"],
): SimulationStage {
  const actions: Record<string, string> = {};

  for (const character of parsed.characters) {
    const state = snapshot.characters[character.id];
    const nextFortune = buildFortuneCycle(context.stageNumber, state.fateProfile);
    const actionChoice = chooseAction(
      { ...state, currentFortune: nextFortune },
      context.focusCharacterIds.includes(character.id),
      context.intervention,
      context.qimenModifier,
    );

    actions[character.id] = actionChoice.action;
    bumpCharacter(snapshot, character.id, {
      currentFortune: nextFortune,
      lastAction: actionChoice.action,
      progress:
        state.progress +
        (context.focusCharacterIds.includes(character.id) ? 2 : 1) +
        Math.max(nextFortune.favorability, 0),
      pressure: state.pressure + (context.intervention ? 2 : 1) + (nextFortune.momentum === "strained" ? 1 : 0),
      notes: actionChoice.notes,
    });
  }

  const events: HistoryEvent[] = [
    {
      id: `${context.stageId}-${context.branchId ?? "canon"}-bg`,
      stageId: context.stageId,
      branchId: context.branchId,
      title: `${context.stageLabel}的暗流`,
      summary: stageSummary(parsed.characters, actions, context.qimenModifier),
      participants: parsed.characters.map((character) => character.name),
      tags: context.intervention ? ["background", "intervention"] : ["background"],
      stateChanges: Object.entries(actions).map(([name, action]) => `${name}:${action}`),
    },
  ];

  if (option === "canon") {
    const relationshipChanges = applyRelationshipTrajectory(snapshot, parsed, context, option);
    events.push({
      id: `${context.stageId}-canon-core`,
      stageId: context.stageId,
      branchId: undefined,
      title: `${context.stageLabel}的正史推进`,
      summary: `${timingPrefix(context.qimenModifier)}${coreSummary(parsed, context, option)}${outcomePhrase(context.qimenModifier)}。`,
      participants: stageParticipants(parsed),
      tags: ["conflict", context.intervention ? "intervention" : "trial"],
      stateChanges: [...Object.entries(actions).map(([name, action]) => `${name}:${action}`), ...relationshipChanges],
    });
  }

  if (option === "surge") {
    const relationshipChanges = applyRelationshipTrajectory(snapshot, parsed, context, option);
    events.push({
      id: `${context.stageId}-${context.branchId}-surge`,
      stageId: context.stageId,
      branchId: context.branchId,
      title: `${context.stageLabel}的强冲分支`,
      summary: `${timingPrefix(context.qimenModifier)}${coreSummary(parsed, context, option)}${outcomePhrase(context.qimenModifier)}。`,
      participants: stageParticipants(parsed),
      tags: ["branch", "surge", "conflict"],
      stateChanges: [...Object.entries(actions).map(([name, action]) => `${name}:${action}`), ...relationshipChanges],
    });
  }

  if (option === "cautious") {
    const relationshipChanges = applyRelationshipTrajectory(snapshot, parsed, context, option);
    events.push({
      id: `${context.stageId}-${context.branchId}-cautious`,
      stageId: context.stageId,
      branchId: context.branchId,
      title: `${context.stageLabel}的保守分支`,
      summary: `${timingPrefix(context.qimenModifier)}${coreSummary(parsed, context, option)}${outcomePhrase(context.qimenModifier)}。`,
      participants: stageParticipants(parsed),
      tags: ["branch", "cautious"],
      stateChanges: [...Object.entries(actions).map(([name, action]) => `${name}:${action}`), ...relationshipChanges],
    });
  }

  if (option === "rupture") {
    const relationshipChanges = applyRelationshipTrajectory(snapshot, parsed, context, option);
    const target = parsed.characters.at(-1)?.id ?? parsed.characters[0]?.id;
    if (target) {
      bumpCharacter(snapshot, target, {
        stance: "守宗",
        lastAction: "突然倒向正道",
        notes: ["本命被无视地强扭，故意制造失真分支"],
      });
    }
    events.push({
      id: `${context.stageId}-${context.branchId}-rupture`,
      stageId: context.stageId,
      branchId: context.branchId,
      title: `${context.stageLabel}的失真分支`,
      summary: coreSummary(parsed, context, option),
      participants: stageParticipants(parsed),
      tags: ["branch", "rupture", "spectacle"],
      stateChanges: [
        ...Object.entries(actions).map(([name, action]) => `${name}:${action}`),
        ...relationshipChanges,
        target ? `${target}:突然改邪归正` : "失真推进",
      ],
    });
  }

  snapshot.stageId = context.stageId;
  if (context.intervention) {
    snapshot.worldFlags = [...snapshot.worldFlags, context.intervention];
  }

  return {
    id: context.stageId,
    stageLabel: context.stageLabel,
    focusCharacterIds: context.focusCharacterIds,
    intervention: context.intervention,
    inputConstraints: context.inputConstraints,
    events,
    snapshot,
    qimenContext: context.qimenContext,
    qimenModifier: context.qimenModifier,
    metaphysicsExplanation: buildStageExplanation(
      snapshot,
      context.focusCharacterIds,
      context.qimenContext,
      context.qimenModifier,
    ),
  };
}

function evaluateConsistency(parsed: ParsedWorldDraft, stage: SimulationStage) {
  const reasons: string[] = [];
  const risks: string[] = [];
  let consistency = 8;
  let fateConsistency = 7;

  const relationshipAnchors = new Map(parsed.relationshipAnchors.map((anchor) => [anchor.relationshipId, anchor]));

  for (const anchor of parsed.relationshipAnchors) {
    const relation = stage.snapshot.relationships[anchor.relationshipId];
    if (!relation) {
      continue;
    }
    if (anchor.boundary.includes("不能无因反目成仇") && relation.status.includes("仇")) {
      risks.push(`${anchor.left}与${anchor.right}无因反目，越过关系边界`);
      consistency -= 5;
      fateConsistency -= 2;
    }
    if (anchor.boundary.includes("不能突然并肩结盟") && relation.status.includes("结盟")) {
      risks.push(`${anchor.left}与${anchor.right}突然结盟，违背宿敌锚点`);
      consistency -= 6;
      fateConsistency -= 2;
    }
    if (anchor.boundary.includes("不能无因互信") && (relation.status.includes("互信") || relation.status.includes("盟友"))) {
      risks.push(`${anchor.left}与${anchor.right}出现无依据互信`);
      consistency -= 4;
    }
    if (anchor.trend.includes("公开冲突") && relation.status === "公开冲突") {
      reasons.push(`${anchor.left}与${anchor.right}沿着锚点升级为公开冲突`);
    }
    if (anchor.trend.includes("紧绷") && relation.status.includes("紧绷")) {
      reasons.push(`${anchor.left}与${anchor.right}维持了“盟友走向紧绷”的关系曲线`);
    }
    if (anchor.trend.includes("猜疑加深") && relation.status.includes("戒备")) {
      reasons.push(`${anchor.left}与${anchor.right}的猜疑继续加深`);
    }
  }

  for (const anchor of parsed.characterAnchors) {
    const state = stage.snapshot.characters[anchor.characterId];
    if (!state) {
      continue;
    }
    if (anchor.cannot.includes("提前死亡") && !state.alive) {
      risks.push(`${anchor.characterId}提前死亡`);
      consistency -= 8;
    }
    if (anchor.cannot.includes("突然改邪归正") && state.stance === "守宗") {
      risks.push(`${anchor.characterId}突然改邪归正`);
      consistency -= 6;
      fateConsistency -= 3;
    }
    if (anchor.cannot.includes("无因失守底线") && stage.events.some((event) => event.summary.includes("毫无铺垫地反目"))) {
      risks.push(`${anchor.characterId}无因失守底线`);
      consistency -= 5;
    }
    if (anchor.mustTrend.includes("成长") && state.progress >= 2) {
      reasons.push(`${anchor.characterId}在压力中继续成长`);
    }
    if (anchor.mustTrend.includes("逐步逼近玄脉") && state.progress >= 1) {
      reasons.push(`${anchor.characterId}维持了逐步逼近玄脉的走势`);
    }
    if (state.notes.some((note) => note.includes("本命层"))) {
      reasons.push(`${anchor.characterId}的行动有明确本命解释`);
    }
  }

  for (const relation of Object.values(stage.snapshot.relationships)) {
    const anchor = relationshipAnchors.get(relation.key);
    if (anchor && relation.status.includes("仇敌") && !anchor.boundary.includes("反目")) {
      risks.push(`${relation.left}与${relation.right}的变化过于生硬`);
      consistency -= 2;
    }
  }

  const fortunePressure =
    Object.values(stage.snapshot.characters).reduce(
      (sum, state) => sum + Math.abs(state.currentFortune.favorability),
      0,
    ) / Object.values(stage.snapshot.characters).length;

  const passes = consistency >= 6 && risks.length === 0;
  if (passes) {
    reasons.push("该分支通过一致性门槛");
  }

  return {
    passes,
    reasons,
    risks,
    consistency: Math.max(consistency, 0),
    fateConsistency: Math.max(fateConsistency, 0),
    fortunePressure,
  };
}

function buildBranchEvaluation(
  parsed: ParsedWorldDraft,
  stage: SimulationStage,
  optionKey: string,
  spectacle: number,
  pacing: number,
  aiReasons: string[] = [],
  aiRisks: string[] = [],
): BranchEvaluation {
  const consistencyResult = evaluateConsistency(parsed, stage);
  const qimenTimingImpact = stage.qimenModifier.timingWeight;
  const qimenOutcomeImpact = stage.qimenModifier.outcomeWeight;
  const total =
    (consistencyResult.passes ? consistencyResult.consistency : 0) +
    consistencyResult.fateConsistency +
    spectacle +
    pacing +
    qimenTimingImpact +
    qimenOutcomeImpact;

  return {
    branchId: stage.events.find((event) => event.branchId)?.branchId ?? optionKey,
    title: stage.events.at(-1)?.title ?? optionKey,
    passesConsistencyGate: consistencyResult.passes,
    recommended: false,
    scores: {
      consistency: consistencyResult.consistency,
      fateConsistency: consistencyResult.fateConsistency,
      fortunePressure: consistencyResult.fortunePressure,
      spectacle,
      pacing,
      qimenTimingImpact,
      qimenOutcomeImpact,
      total,
    },
    reasons: [...consistencyResult.reasons, ...aiReasons],
    risks: [...consistencyResult.risks, ...aiRisks],
    metaphysicsExplanation: stage.metaphysicsExplanation,
  };
}

function lineFromStage(
  source: TimelineLine,
  branchId: string,
  label: string,
  stage: SimulationStage,
): TimelineLine {
  return {
    lineId: branchId,
    kind: "branch",
    label,
    stages: [...cloneValue(source.stages), stage],
    events: [...cloneValue(source.events), ...cloneValue(stage.events)],
    snapshots: {
      ...cloneValue(source.snapshots),
      [stage.id]: cloneValue(stage.snapshot),
    },
    parentLineId: source.lineId,
    sourceStageId: stage.id,
    branchId,
  };
}

function refreshFortunes(snapshot: WorldSnapshot, stageNumber: number): void {
  for (const state of Object.values(snapshot.characters)) {
    state.currentFortune = buildFortuneCycle(stageNumber, state.fateProfile);
  }
}

function applyCharacterUpdates(
  snapshot: WorldSnapshot,
  updates: SimulationStageProposal["canon"]["characterUpdates"],
): void {
  for (const update of updates) {
    const state = snapshot.characters[update.characterId];
    if (!state) {
      continue;
    }
    bumpCharacter(snapshot, update.characterId, {
      lastAction: update.lastAction,
      progress: state.progress + update.progressDelta,
      pressure: state.pressure + update.pressureDelta,
      stance: update.stance ?? state.stance,
      alive: update.alive ?? state.alive,
      notes: update.note ? [update.note] : [],
    });
  }
}

function applyRelationshipUpdates(
  snapshot: WorldSnapshot,
  updates: SimulationStageProposal["canon"]["relationshipUpdates"],
  anchorsByRelation: Map<string, RelationshipAnchor>,
): void {
  for (const update of updates) {
    const directKey = pairKey(update.left, update.right);
    const reverseKey = pairKey(update.right, update.left);
    const anchor = anchorsByRelation.get(directKey) ?? anchorsByRelation.get(reverseKey);
    try {
      setRelationshipStatus(snapshot, update.left, update.right, update.status, anchor);
      const relation = findRelationshipState(snapshot, update.left, update.right);
      if (update.note) {
        relation.notes = [...relation.notes, update.note];
      }
    } catch {
      continue;
    }
  }
}

function buildStageFromProposal(
  snapshot: WorldSnapshot,
  context: StageContext,
  parsed: ParsedWorldDraft,
  eventProposal: SimulationEventProposal,
  characterUpdates: SimulationStageProposal["canon"]["characterUpdates"],
  relationshipUpdates: SimulationStageProposal["canon"]["relationshipUpdates"],
): SimulationStage {
  const anchorsByRelation = new Map(parsed.relationshipAnchors.map((anchor) => [anchor.relationshipId, anchor]));

  refreshFortunes(snapshot, context.stageNumber);
  applyCharacterUpdates(snapshot, characterUpdates);
  applyRelationshipUpdates(snapshot, relationshipUpdates, anchorsByRelation);

  snapshot.stageId = context.stageId;
  if (context.intervention) {
    snapshot.worldFlags = [...snapshot.worldFlags, context.intervention];
  }

  const event: HistoryEvent = {
    id: `${context.stageId}-${context.branchId ?? "canon"}-core`,
    stageId: context.stageId,
    branchId: context.branchId,
    title: eventProposal.title,
    summary: eventProposal.summary,
    participants: [...eventProposal.participants],
    tags: [...eventProposal.tags],
    stateChanges: [...eventProposal.stateChanges],
  };

  return {
    id: context.stageId,
    stageLabel: context.stageLabel,
    focusCharacterIds: context.focusCharacterIds,
    intervention: context.intervention,
    inputConstraints: context.inputConstraints,
    events: [event],
    snapshot,
    qimenContext: context.qimenContext,
    qimenModifier: context.qimenModifier,
    metaphysicsExplanation: buildStageExplanation(
      snapshot,
      context.focusCharacterIds,
      context.qimenContext,
      context.qimenModifier,
    ),
  };
}

export class WorldHistoryEngine {
  private readonly parsed: ParsedWorldDraft;
  private canonLine: CanonLine;
  private currentSnapshot: WorldSnapshot;
  private readonly branches = new Map<string, TimelineLine>();
  private readonly baziCandidates = new Map<string, BaziCandidate[]>();
  private readonly selectedCandidates = new Map<string, string>();
  private stageCounter = 0;
  private archiveCounter = 0;

  constructor(parsed: ParsedWorldDraft) {
    this.parsed = cloneValue(parsed);

    for (const character of this.parsed.characters) {
      const candidates = buildBaziCandidates(character, this.parsed);
      this.baziCandidates.set(character.id, candidates);
      this.selectedCandidates.set(character.id, candidates[0].id);
    }

    const selectedProfiles = new Map<string, FateProfile>();
    for (const [characterId, candidateId] of this.selectedCandidates.entries()) {
      const candidates = this.baziCandidates.get(characterId) ?? [];
      const selected = candidates.find((candidate) => candidate.id === candidateId) ?? candidates[0];
      if (!selected) {
        throw new Error(`No candidate available for ${characterId}`);
      }
      selectedProfiles.set(characterId, selected.fateProfile);
    }

    this.currentSnapshot = buildInitialSnapshot(this.parsed, selectedProfiles);
    this.canonLine = {
      lineId: "canon",
      kind: "canon",
      label: "正史线",
      stages: [],
      events: [],
      snapshots: {
        initial: cloneValue(this.currentSnapshot),
      },
      archivedTimelines: [],
      branchHistory: [],
    };
  }

  getParsedWorld(): ParsedWorldDraft {
    return cloneValue(this.parsed);
  }

  /**
   * Dynamic character expansion (W2 D2). Adds a new character to the live
   * world: extends parsed.characters / characterAnchors, builds bazi
   * candidates, and bootstraps a CharacterState in the current snapshot so
   * future stages can include them in focus selection + simulation.
   *
   * Optionally adds a relationship (with anchor) to an existing character —
   * intended for "introducedBy" semantics.
   *
   * Idempotent on profile.id: re-adding the same id is a no-op.
   */
  addCharacter(input: {
    profile: CharacterProfile;
    anchor?: CharacterAnchor;
    relationship?: RelationshipProfile;
    relationshipAnchor?: RelationshipAnchor;
  }): void {
    if (this.parsed.characters.some((c) => c.id === input.profile.id)) {
      return; // idempotent
    }
    this.parsed.characters.push(cloneValue(input.profile));
    if (input.anchor) {
      this.parsed.characterAnchors.push(cloneValue(input.anchor));
    }
    if (input.relationship) {
      this.parsed.relationships.push(cloneValue(input.relationship));
      // Bootstrap RelationshipState in current snapshot.
      const sp = statusProfile(input.relationship.status);
      this.currentSnapshot.relationships[input.relationship.id] = {
        key: input.relationship.id,
        left: input.relationship.left,
        right: input.relationship.right,
        status: input.relationship.status,
        trust: sp.trust,
        hostility: sp.hostility,
        notes: [input.relationship.history, input.relationship.tension],
      };
    }
    if (input.relationshipAnchor) {
      this.parsed.relationshipAnchors.push(cloneValue(input.relationshipAnchor));
    }

    // Build bazi candidates + select default.
    const candidates = buildBaziCandidates(input.profile, this.parsed);
    this.baziCandidates.set(input.profile.id, candidates);
    const selectedId = candidates[0]?.id;
    if (!selectedId) {
      throw new Error(`No bazi candidate could be built for ${input.profile.id}`);
    }
    this.selectedCandidates.set(input.profile.id, selectedId);
    const selected = candidates[0];
    const fateProfile = selected.fateProfile;

    // Bootstrap CharacterState in the current snapshot (mirrors
    // buildInitialSnapshot logic for parity).
    this.currentSnapshot.characters[input.profile.id] = {
      name: input.profile.name,
      faction: input.profile.faction,
      role: input.profile.role,
      traits: [...input.profile.traits],
      goal: input.profile.goal,
      stance: input.profile.stance,
      resource: input.profile.resource,
      progress: 0,
      pressure: 0,
      lastAction: "idle",
      alive: true,
      notes: ["dynamic-introduction"],
      candidateId: fateProfile.candidateId,
      fateProfile,
      currentFortune: buildFortuneCycle(0, fateProfile),
    };
  }

  getBaziCandidates(characterId: string): BaziCandidate[] {
    return cloneValue(this.baziCandidates.get(characterId) ?? []);
  }

  selectBaziCandidate(characterId: string, candidateId: string): void {
    const candidates = this.baziCandidates.get(characterId);
    const selected = candidates?.find((candidate) => candidate.id === candidateId);
    if (!selected) {
      throw new Error(`Unknown candidate ${candidateId} for ${characterId}`);
    }
    this.selectedCandidates.set(characterId, candidateId);
    if (this.canonLine.stages.length === 0) {
      this.currentSnapshot.characters[characterId].candidateId = candidateId;
      this.currentSnapshot.characters[characterId].fateProfile = cloneValue(selected.fateProfile);
      this.currentSnapshot.characters[characterId].currentFortune = buildFortuneCycle(0, selected.fateProfile);
    }
  }

  getSelectedFateProfile(characterId: string): FateProfile {
    if (this.canonLine.stages.length === 0) {
      return cloneValue(this.currentSnapshot.characters[characterId].fateProfile);
    }
    return cloneValue(this.currentSnapshot.characters[characterId].fateProfile);
  }

  runStage(directive: StageDirective, options: RunStageOptions = {}): StageResult {
    const stageId = `stage-${++this.stageCounter}`;
    const preStageCanon = cloneValue(this.canonLine);
    const baseSnapshot = cloneValue(this.currentSnapshot);
    const inputConstraints = buildInputConstraints(this.parsed, directive);
    const qimenContext = buildQimenContext({
      stageLabel: directive.stageLabel,
      intervention: directive.intervention,
      qimenOverride: directive.qimenOverride,
    });
    const qimenModifier = buildQimenModifier(qimenContext);

    const canonStage = buildStage(
      cloneValue(baseSnapshot),
      {
        stageId,
        stageNumber: this.stageCounter,
        stageLabel: directive.stageLabel,
        focusCharacterIds: directive.focusCharacterIds,
        intervention: directive.intervention,
        inputConstraints,
        qimenContext,
        qimenModifier,
      },
      this.parsed,
      "canon",
    );

    this.currentSnapshot = cloneValue(canonStage.snapshot);
    this.canonLine.stages.push(canonStage);
    this.canonLine.events.push(...cloneValue(canonStage.events));
    this.canonLine.snapshots[stageId] = cloneValue(canonStage.snapshot);

    const branchSpecs: OutcomeSpec[] = [
      { title: "强冲分支", key: `${stageId}-surge`, spectacle: 9, pacing: 9, option: "surge" },
      { title: "保守分支", key: `${stageId}-cautious`, spectacle: 5, pacing: 6, option: "cautious" },
      { title: "失真分支", key: `${stageId}-rupture`, spectacle: 10, pacing: 8, option: "rupture" },
    ];

    const branchEvaluations = branchSpecs.map((spec) => {
      const branchStage = buildStage(
        cloneValue(baseSnapshot),
        {
          stageId,
          stageNumber: this.stageCounter,
          stageLabel: directive.stageLabel,
          focusCharacterIds: directive.focusCharacterIds,
          intervention: directive.intervention,
          inputConstraints,
          qimenContext,
          qimenModifier,
          branchId: spec.key,
        },
        this.parsed,
        spec.option,
      );

      const branchLine = lineFromStage(preStageCanon, spec.key, spec.title, branchStage);
      this.branches.set(branchLine.lineId, branchLine);
      return buildBranchEvaluation(this.parsed, branchStage, spec.key, spec.spectacle, spec.pacing);
    });

    const recommended = [...branchEvaluations]
      .filter((evaluation) => evaluation.passesConsistencyGate)
      .sort((left, right) => right.scores.total - left.scores.total)[0];
    if (recommended) {
      const selected = branchEvaluations.find((evaluation) => evaluation.branchId === recommended.branchId);
      if (selected) {
        selected.recommended = true;
        selected.reasons = [...selected.reasons, "该分支在过线方案中兼顾爽感、命理解释与奇门修正，建议优先观察。"];
      }
    }

    const gateDecisions = branchEvaluations.map((evaluation) =>
      evaluateCanonGate({
        runId: stageId,
        parsed: this.parsed,
        canonLine: this.canonLine,
        candidateLine: this.getLine(evaluation.branchId),
        branchEvaluation: evaluation,
        requireAuthorOnHighRisk: options.requireAuthorOnHighRisk,
      }),
    );

    return {
      canonStage,
      branchEvaluations,
      gateDecisions,
    };
  }

  runStageWithProposal(
    directive: StageDirective,
    proposal: SimulationStageProposal,
    options: RunStageOptions = {},
  ): StageResult {
    const stageId = `stage-${++this.stageCounter}`;
    const preStageCanon = cloneValue(this.canonLine);
    const baseSnapshot = cloneValue(this.currentSnapshot);
    const inputConstraints = buildInputConstraints(this.parsed, directive);

    const canonQimenContext = buildQimenContext({
      stageLabel: directive.stageLabel,
      intervention: directive.intervention,
      qimenOverride: {
        ...directive.qimenOverride,
        ...proposal.canon.qimenOverride,
      },
    });
    const canonQimenModifier = buildQimenModifier(canonQimenContext);

    const canonStage = buildStageFromProposal(
      cloneValue(baseSnapshot),
      {
        stageId,
        stageNumber: this.stageCounter,
        stageLabel: directive.stageLabel,
        focusCharacterIds: directive.focusCharacterIds,
        intervention: directive.intervention,
        inputConstraints,
        qimenContext: canonQimenContext,
        qimenModifier: canonQimenModifier,
      },
      this.parsed,
      proposal.canon.event,
      proposal.canon.characterUpdates,
      proposal.canon.relationshipUpdates,
    );

    this.currentSnapshot = cloneValue(canonStage.snapshot);
    this.canonLine.stages.push(canonStage);
    this.canonLine.events.push(...cloneValue(canonStage.events));
    this.canonLine.snapshots[stageId] = cloneValue(canonStage.snapshot);

    const branchEvaluations = proposal.branches.map((branch, index) => {
      const branchId = `${stageId}-branch-${index + 1}`;
      const qimenContext = buildQimenContext({
        stageLabel: directive.stageLabel,
        intervention: directive.intervention,
        qimenOverride: {
          ...directive.qimenOverride,
          ...branch.qimenOverride,
        },
      });
      const qimenModifier = buildQimenModifier(qimenContext);

      const branchStage = buildStageFromProposal(
        cloneValue(baseSnapshot),
        {
          stageId,
          stageNumber: this.stageCounter,
          stageLabel: directive.stageLabel,
          focusCharacterIds: directive.focusCharacterIds,
          intervention: directive.intervention,
          inputConstraints,
          qimenContext,
          qimenModifier,
          branchId,
        },
        this.parsed,
        branch.event,
        branch.characterUpdates,
        branch.relationshipUpdates,
      );

      const branchLine = lineFromStage(preStageCanon, branchId, branch.title, branchStage);
      this.branches.set(branchLine.lineId, branchLine);

      const evaluation = buildBranchEvaluation(
        this.parsed,
        branchStage,
        branchId,
        branch.spectacle,
        branch.pacing,
        branch.reasons,
        branch.risks,
      );
      evaluation.title = branch.title;
      evaluation.recommended = Boolean(branch.recommended) && evaluation.passesConsistencyGate;
      return evaluation;
    });

    if (!branchEvaluations.some((evaluation) => evaluation.recommended)) {
      const recommended = [...branchEvaluations]
        .filter((evaluation) => evaluation.passesConsistencyGate)
        .sort((left, right) => right.scores.total - left.scores.total)[0];
      if (recommended) {
        const selected = branchEvaluations.find((evaluation) => evaluation.branchId === recommended.branchId);
        if (selected) {
          selected.recommended = true;
          selected.reasons = [
            ...selected.reasons,
            "该分支在过线方案中兼顾爽感、命理解释与奇门修正，建议优先观察。",
          ];
        }
      }
    }

    const gateDecisions = branchEvaluations.map((evaluation) =>
      evaluateCanonGate({
        runId: stageId,
        parsed: this.parsed,
        canonLine: this.canonLine,
        candidateLine: this.getLine(evaluation.branchId),
        branchEvaluation: evaluation,
        requireAuthorOnHighRisk: options.requireAuthorOnHighRisk,
      }),
    );

    return {
      canonStage,
      branchEvaluations,
      gateDecisions,
    };
  }

  promoteBranch(branchId: string): CanonLine {
    const branch = this.branches.get(branchId);
    if (!branch) {
      throw new Error(`Unknown branch: ${branchId}`);
    }

    const replacedLineId = `canon-archive-${++this.archiveCounter}`;
    this.canonLine.archivedTimelines.push({
      lineId: replacedLineId,
      label: this.canonLine.label,
      eventCount: this.canonLine.events.length,
      stageCount: this.canonLine.stages.length,
    });
    this.canonLine.branchHistory.push({
      branchId,
      promotedAtStageId: branch.sourceStageId ?? "unknown-stage",
      replacedLineId,
    });

    this.canonLine.stages = cloneValue(branch.stages);
    this.canonLine.events = cloneValue(branch.events);
    this.canonLine.snapshots = cloneValue(branch.snapshots);
    const latestStage = this.canonLine.stages.at(-1);
    if (latestStage) {
      this.currentSnapshot = cloneValue(latestStage.snapshot);
    } else {
      // Per review · M: empty-stages branch is defensive but possible.
      // Fall back to the canon initial snapshot so currentSnapshot doesn't
      // diverge from the new canon line.
      const initialSnap = this.canonLine.snapshots["initial"];
      if (initialSnap) {
        this.currentSnapshot = cloneValue(initialSnap);
      }
    }

    // Per review · M (branches Map unbounded): prune branches forked from
    // stages no longer reachable from the new canon line. The promoted
    // branch's own descendants (if any) survive; everything else is moved
    // to archivedTimelines for trace + dropped from the live Map.
    const reachableStageIds = new Set(this.canonLine.stages.map((s) => s.id));
    for (const [bid, b] of [...this.branches.entries()]) {
      // Keep the just-promoted branch's lineage by source stage; discard others
      if (b.sourceStageId && !reachableStageIds.has(b.sourceStageId)) {
        this.branches.delete(bid);
        this.canonLine.archivedTimelines.push({
          lineId: bid,
          label: b.label,
          eventCount: b.events.length,
          stageCount: b.stages.length,
        });
      }
    }

    // Per review · D4: a branch forked BEFORE a dynamic addCharacter() call
    // has snapshots missing the new characters. After promote, scan
    // parsed.characters and back-fill any missing CharacterStates into the
    // currentSnapshot (and the latest stage's snapshot). Without this, the
    // newly-added character is silently absent from canon while still listed
    // in parsed.characters — state divergence.
    for (const character of this.parsed.characters) {
      if (this.currentSnapshot.characters[character.id]) continue;
      const candidates = this.baziCandidates.get(character.id);
      const fateProfile = candidates?.[0]?.fateProfile;
      if (!fateProfile) continue;
      const state = {
        name: character.name,
        faction: character.faction,
        role: character.role,
        traits: [...character.traits],
        goal: character.goal,
        stance: character.stance,
        resource: character.resource,
        progress: 0,
        pressure: 0,
        lastAction: "idle",
        alive: true,
        notes: [`promoted-from-${branchId}; back-filled (not present in branch snapshots)`],
        candidateId: fateProfile.candidateId,
        fateProfile,
        currentFortune: buildFortuneCycle(0, fateProfile),
      };
      this.currentSnapshot.characters[character.id] = state;
      if (latestStage) {
        latestStage.snapshot.characters[character.id] = cloneValue(state);
      }
    }

    emitPromotion({
      branchId,
      promotedStageId: branch.sourceStageId,
      refs: { replacedLineId },
    });
    return this.getCanonLine();
  }

  /**
   * Archive a branch — remove it from `branches` and record in history.
   * Used by world-daemon.resumeWithDecision when author chooses "reject" or
   * "archive" (review · D1). Idempotent: no-op if branch doesn't exist.
   */
  archiveBranch(branchId: string): void {
    const branch = this.branches.get(branchId);
    if (!branch) return;
    this.branches.delete(branchId);
    this.canonLine.archivedTimelines.push({
      lineId: branchId,
      label: branch.label,
      eventCount: branch.events.length,
      stageCount: branch.stages.length,
    });
  }

  getCanonLine(): CanonLine {
    return cloneValue(this.canonLine);
  }

  getLine(branchId?: string): TimelineLine {
    if (!branchId) {
      return this.getCanonLine();
    }
    const branch = this.branches.get(branchId);
    if (!branch) {
      return this.getCanonLine();
    }
    return cloneValue(branch);
  }

  getTruthKernel(): TruthKernel {
    let kernel = TruthKernel.fromCanon(this.getCanonLine());
    for (const branch of this.branches.values()) {
      kernel = kernel.forkFromLine(branch);
    }
    return kernel;
  }
}
