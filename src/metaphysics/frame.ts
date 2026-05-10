import type { BaziCandidate, ParsedWorldDraft, StageDirective } from "../domain";
import { buildBaziCandidates, buildQimenContext, buildQimenModifier } from "../metaphysics";
import { deriveBaguaSituation, type BaguaSituation } from "./bagua";
import { buildQimenBoard, type QimenBoard } from "./qimen-board";

export type MetaphysicsInfluence = {
  influenceId: string;
  target:
    | { kind: "character"; characterId: string }
    | { kind: "relationship"; relationshipId: string }
    | { kind: "location"; locationId: string }
    | { kind: "branch"; branchKey: string };
  axis:
    | "initiative"
    | "discipline"
    | "opportunism"
    | "volatility"
    | "attachment"
    | "exposure"
    | "delay"
    | "rupture"
    | "reconciliation"
    | "hidden-threat";
  weight: number;
  source: "bazi" | "fortune" | "bagua" | "qimen";
  explanation: string;
  confidence: "exact" | "derived" | "inferred";
};

export type MetaphysicsTrace = {
  traceId: string;
  source: "calendar" | "bazi" | "bagua" | "qimen" | "canon-gate";
  ruleId: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  explanation: string;
};

export type MetaphysicsFrame = {
  frameId: string;
  runId: string;
  characterProfiles: BaziCandidate[];
  baguaSituation: BaguaSituation;
  qimenBoard: QimenBoard;
  influences: MetaphysicsInfluence[];
  trace: MetaphysicsTrace[];
};

function candidateCharacterId(candidate: BaziCandidate): string {
  return candidate.fateProfile.candidateId.split("-")[0] ?? candidate.fateProfile.candidateId;
}

export function buildMetaphysicsFrame(input: {
  runId: string;
  parsed: ParsedWorldDraft;
  stageNumber: number;
  directive: StageDirective;
}): MetaphysicsFrame {
  const characterProfiles = input.parsed.characters.flatMap((character) =>
    buildBaziCandidates(character, input.parsed).slice(0, 1),
  );
  const baguaSituation = deriveBaguaSituation(input.directive);
  const qimenContext = buildQimenContext({
    stageLabel: input.directive.stageLabel,
    intervention: input.directive.intervention,
    qimenOverride: input.directive.qimenOverride,
  });
  const qimenModifier = buildQimenModifier(qimenContext);
  const qimenBoard = buildQimenBoard({
    context: qimenContext,
    modifier: qimenModifier,
    stageNumber: input.stageNumber,
  });

  const influences: MetaphysicsInfluence[] = [];
  const trace: MetaphysicsTrace[] = [];

  for (const candidate of characterProfiles) {
    const fate = candidate.fateProfile;
    influences.push({
      influenceId: `${input.runId}-${fate.candidateId}-bazi`,
      target: { kind: "character", characterId: candidateCharacterId(candidate) },
      axis: fate.initiative >= fate.discipline ? "initiative" : "discipline",
      weight: Math.max(fate.initiative, fate.discipline, fate.opportunism, fate.volatility),
      source: "bazi",
      explanation: fate.explainSummary,
      confidence: candidate.sourceMode === "bazi" ? "exact" : candidate.sourceMode === "archetype" ? "derived" : "inferred",
    });
    trace.push({
      traceId: `${input.runId}-${fate.candidateId}-bazi-trace`,
      source: "bazi",
      ruleId: "selected-bazi-candidate",
      input: { candidateId: candidate.id, sourceMode: candidate.sourceMode },
      output: { temperament: fate.temperament, pressureResponse: fate.pressureResponse },
      explanation: candidate.explanation.fateLayer,
    });
  }

  for (const tag of baguaSituation.structuralTags) {
    influences.push({
      influenceId: `${input.runId}-bagua-${tag}`,
      target: { kind: "branch", branchKey: "structural-field" },
      axis: tag === "exposure" ? "exposure" : tag === "hidden-threat" ? "hidden-threat" : "delay",
      weight: 2,
      source: "bagua",
      explanation: baguaSituation.narrativeEffect,
      confidence: "derived",
    });
  }
  trace.push({
    traceId: `${input.runId}-bagua-trace`,
    source: "bagua",
    ruleId: baguaSituation.situationId,
    input: { stageLabel: input.directive.stageLabel, intervention: input.directive.intervention },
    output: { internal: baguaSituation.internalTrigram, external: baguaSituation.externalTrigram },
    explanation: baguaSituation.narrativeEffect,
  });

  influences.push({
    influenceId: `${input.runId}-qimen-${qimenBoard.activePalace}`,
    target: { kind: "location", locationId: qimenContext.locationFocus },
    axis: qimenModifier.timingShift === "advance" ? "initiative" : qimenModifier.timingShift === "delay" ? "delay" : "rupture",
    weight: Math.abs(qimenModifier.timingWeight) + Math.abs(qimenModifier.outcomeWeight),
    source: "qimen",
    explanation: `${qimenContext.pattern}影响${qimenContext.locationFocus}，${qimenContext.eventType}倾向${qimenModifier.outcomeBias}`,
    confidence: qimenContext.sourceMode === "manual" ? "exact" : "derived",
  });
  trace.push({
    traceId: `${input.runId}-qimen-trace`,
    source: "qimen",
    ruleId: qimenBoard.boardId,
    input: { context: qimenContext, modifier: qimenModifier },
    output: { activePalace: qimenBoard.activePalace, valueEnvoy: qimenBoard.valueEnvoy },
    explanation: `${qimenBoard.valueEnvoy}落${qimenBoard.palaces[qimenBoard.activePalace - 1].direction}`,
  });

  return {
    frameId: `${input.runId}-metaphysics-frame`,
    runId: input.runId,
    characterProfiles,
    baguaSituation,
    qimenBoard,
    influences,
    trace,
  };
}
