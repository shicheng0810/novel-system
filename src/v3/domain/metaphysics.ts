// Layer 1 · metaphysics types. Pure shapes, zero IO.
// The actual scoring/derivation lives in src/v3/metaphysics/* (Phase 3).

export type FiveElement = "木" | "火" | "土" | "金" | "水";

export type BaziPillar = { stem: string; branch: string };

export type BaziChart = {
  raw: string;
  pillars: BaziPillar[];
  dominantElements: FiveElement[];
  favorableElements: FiveElement[];
  unfavorableElements: FiveElement[];
  tenGodHints: string[];
};

export type ArchetypeProfile = {
  raw: string;
  dominantElements: FiveElement[];
  disposition: string;
  destinyThemes: string[];
};

export type FateProfile = {
  candidateId: string;
  sourceMode: "bazi" | "archetype" | "inferred";
  label: string;
  dominantElements: FiveElement[];
  temperament: string;
  pressureResponse: string;
  relationshipStyle: string;
  initiative: number;   // 0..10
  discipline: number;   // 0..10
  opportunism: number;  // 0..10
  volatility: number;   // 0..10
  explainSummary: string;
};

export type FortuneCycle = {
  cycleLabel: string;
  momentum: "rising" | "steady" | "strained" | "volatile";
  favorability: number;   // -3..+3
  manifestationTheme: string;
  riskBias: string;
};

export type QimenContext = {
  sourceMode: "auto" | "manual" | "hybrid";
  pattern: string;        // 阳遁三局 / 惊门 etc.
  locationFocus: string;
  eventType: string;
  strongSituationScore: number;
  allowHardDecision?: boolean;
};

export type QimenModifier = {
  timingShift: "advance" | "delay" | "redirect" | "steady";
  outcomeBias: "boost" | "drag" | "twist" | "steady";
  timingWeight: number;   // -3..+3
  outcomeWeight: number;  // -3..+3
};

export type BaguaSituation = {
  situationId: string;
  internalTrigram: string;
  externalTrigram: string;
  structuralTags: Array<"exposure" | "hidden-threat" | "delay" | "rupture">;
  narrativeEffect: string;
};

export type InfluenceAxis =
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

export type InfluenceTarget =
  | { kind: "character"; characterId: string }
  | { kind: "relationship"; relationshipId: string }
  | { kind: "location"; locationId: string }
  | { kind: "branch"; branchKey: string };

export type InfluenceConfidence = "exact" | "derived" | "inferred";

export type Influence = {
  influenceId: string;
  source: "bazi" | "fortune" | "bagua" | "qimen";
  axis: InfluenceAxis;
  target: InfluenceTarget;
  weight: number;            // signed: positive = pushes toward axis, negative = away
  confidence: InfluenceConfidence;
  explanation: string;
};

export type MetaphysicsExplanation = {
  summary: string;
  fateLayer: string;
  fortuneLayer: string;
  qimenLayer: string;
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
  worldId: string;
  stageNumber: number;
  ts: number;
  qimenContext: QimenContext;
  qimenModifier: QimenModifier;
  baguaSituation: BaguaSituation;
  fateProfilesByCharacter: Record<string, FateProfile>;
  fortunesByCharacter: Record<string, FortuneCycle>;
  influences: Influence[];
  trace: MetaphysicsTrace[];
  explanation: MetaphysicsExplanation;
};
