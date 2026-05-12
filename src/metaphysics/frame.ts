// Phase 3 · MetaphysicsFrame builder.
// Orchestrates bazi / qimen / bagua into a single per-tick frame whose
// influences drive the candidate scorer in prior.ts.

import type {
  FateProfile,
  FortuneCycle,
  Influence,
  MetaphysicsFrame,
  MetaphysicsTrace,
} from "../domain/metaphysics";
import type { ParsedWorldDraft, StageDirective } from "../domain/world";

import { fateFromBazi, parsePillars } from "./bazi";
import { deriveBaguaSituation } from "./bagua";
import { buildQimenBoard, buildQimenModifier, defaultQimenContext } from "./qimen";

export type BuildFrameInput = {
  runId: string;
  worldId: string;
  stageNumber: number;
  parsed: ParsedWorldDraft;
  directive: StageDirective;
};

export function buildFrame(input: BuildFrameInput): MetaphysicsFrame {
  const ts = Date.now();
  const qimenContext = defaultQimenContext(input.directive.stageLabel, input.directive.qimenOverride);
  const qimenModifier = buildQimenModifier(qimenContext);
  const qimenBoard = buildQimenBoard({
    context: qimenContext,
    modifier: qimenModifier,
    stageNumber: input.stageNumber,
  });
  const baguaSituation = deriveBaguaSituation(input.directive);

  const fateProfilesByCharacter: Record<string, FateProfile> = {};
  const fortunesByCharacter: Record<string, FortuneCycle> = {};
  const influences: Influence[] = [];
  const trace: MetaphysicsTrace[] = [];

  for (const character of input.parsed.characters) {
    const chart = character.baziRaw ? parsePillars(character.baziRaw) : null;
    const fate = chart
      ? fateFromBazi(`${input.runId}-${character.id}`, chart, "bazi")
      : archetypeFate(input.runId, character.id, character.archetypeDraft ?? "");
    fateProfilesByCharacter[character.id] = fate;
    fortunesByCharacter[character.id] = stageFortune(fate, input.stageNumber);

    influences.push({
      influenceId: `${input.runId}-${character.id}-bazi`,
      source: "bazi",
      axis: fate.initiative >= fate.discipline ? "initiative" : "discipline",
      target: { kind: "character", characterId: character.id },
      weight: Math.max(fate.initiative, fate.discipline, fate.opportunism, fate.volatility) / 10,
      confidence: chart ? "exact" : "derived",
      explanation: fate.explainSummary,
    });
    trace.push({
      traceId: `${input.runId}-${character.id}-bazi-trace`,
      source: "bazi",
      ruleId: "fate-from-pillars",
      input: { characterId: character.id, baziRaw: character.baziRaw ?? null },
      output: { temperament: fate.temperament, dominantElements: fate.dominantElements },
      explanation: fate.explainSummary,
    });
  }

  for (const tag of baguaSituation.structuralTags) {
    influences.push({
      influenceId: `${input.runId}-bagua-${tag}`,
      source: "bagua",
      axis: tag === "exposure" ? "exposure" :
            tag === "hidden-threat" ? "hidden-threat" :
            tag === "rupture" ? "rupture" : "delay",
      target: { kind: "branch", branchKey: "structural-field" },
      weight: 0.4,
      confidence: "derived",
      explanation: baguaSituation.narrativeEffect,
    });
  }
  trace.push({
    traceId: `${input.runId}-bagua-trace`,
    source: "bagua",
    ruleId: baguaSituation.situationId,
    input: { stageLabel: input.directive.stageLabel, intervention: input.directive.intervention ?? "" },
    output: { internal: baguaSituation.internalTrigram, external: baguaSituation.externalTrigram },
    explanation: baguaSituation.narrativeEffect,
  });

  influences.push({
    influenceId: `${input.runId}-qimen-${qimenBoard.activePalace}`,
    source: "qimen",
    axis: qimenModifier.timingShift === "advance" ? "initiative" :
          qimenModifier.timingShift === "delay" ? "delay" :
          qimenModifier.outcomeBias === "boost" ? "reconciliation" : "rupture",
    target: { kind: "location", locationId: qimenContext.locationFocus },
    weight: (Math.abs(qimenModifier.timingWeight) + Math.abs(qimenModifier.outcomeWeight)) / 6,
    confidence: qimenContext.sourceMode === "manual" ? "exact" : "derived",
    explanation: `${qimenContext.pattern} 落 ${qimenContext.locationFocus}：${qimenModifier.outcomeBias}`,
  });
  trace.push({
    traceId: `${input.runId}-qimen-trace`,
    source: "qimen",
    ruleId: qimenBoard.boardId,
    input: { pattern: qimenContext.pattern, locationFocus: qimenContext.locationFocus },
    output: { activePalace: qimenBoard.activePalace, dun: qimenBoard.dun },
    explanation: `${qimenBoard.valueEnvoy} 落 ${qimenBoard.palaces[qimenBoard.activePalace - 1].direction}`,
  });

  const explanation = {
    summary: `${qimenContext.pattern} · ${baguaSituation.internalTrigram}${baguaSituation.externalTrigram}`,
    fateLayer: `命层：${
      Object.entries(fateProfilesByCharacter)
        .map(([id, f]) => `${id}=${f.label}`)
        .join("；") || "无可用八字"
    }`,
    fortuneLayer: `运层：${
      Object.entries(fortunesByCharacter)
        .map(([id, f]) => `${id}=${f.cycleLabel}/${f.momentum}`)
        .join("；") || "无运势"
    }`,
    qimenLayer: `奇门：${qimenContext.pattern}，${qimenModifier.timingShift}+${qimenModifier.outcomeBias}`,
  };

  return {
    frameId: `${input.runId}-frame`,
    runId: input.runId,
    worldId: input.worldId,
    stageNumber: input.stageNumber,
    ts,
    qimenContext,
    qimenModifier,
    baguaSituation,
    fateProfilesByCharacter,
    fortunesByCharacter,
    influences,
    trace,
    explanation,
  };
}

function archetypeFate(runId: string, characterId: string, draft: string): FateProfile {
  const all: FateProfile["dominantElements"] = ["木", "火", "土", "金", "水"];
  const elements = all.filter((el) => draft.includes(el));
  const dominant: FateProfile["dominantElements"] = elements.length > 0 ? elements.slice(0, 2) : ["土", "木"];
  const signature = dominant.join("");
  const isFire = signature.includes("火");
  const isWater = signature.includes("水");
  return {
    candidateId: `${runId}-${characterId}-archetype`,
    sourceMode: draft ? "archetype" : "inferred",
    label: `${dominant.join("·")} 启发式`,
    dominantElements: dominant,
    temperament: isFire ? "先燃后断" : isWater ? "藏锋待时" : "顺势成长",
    pressureResponse: isFire ? "遇压争先" : isWater ? "逢乱潜行" : "先观后发",
    relationshipStyle: isFire ? "情烈而不退" : "缓慢升温",
    initiative: isFire ? 7 : 5,
    discipline: signature.includes("金") || signature.includes("土") ? 7 : 5,
    opportunism: isWater ? 7 : 5,
    volatility: isFire ? 6 : 4,
    explainSummary: `${dominant.join("·")} 启发式画像。`,
  };
}

function stageFortune(fate: FateProfile, stageNumber: number): FortuneCycle {
  const phase = stageNumber % 4;
  const baseMomentum: FortuneCycle["momentum"] =
    phase === 0 ? "rising" :
    phase === 1 ? "steady" :
    phase === 2 ? "strained" : "volatile";
  return {
    cycleLabel: `${fate.dominantElements.join("·")} ${stageNumber}阶段运`,
    momentum: baseMomentum,
    favorability: phase === 0 ? 2 : phase === 1 ? 1 : phase === 2 ? -1 : 0,
    manifestationTheme: fate.temperament,
    riskBias: fate.pressureResponse,
  };
}
