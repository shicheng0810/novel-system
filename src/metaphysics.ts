import {
  ArchetypeProfile,
  BaziCandidate,
  BaziChart,
  CharacterProfile,
  FateProfile,
  FortuneCycle,
  MetaphysicsExplanation,
  ParsedWorldDraft,
  QimenContext,
  QimenModifier,
  RelationshipProfile,
} from "./domain";

// TODO Phase 3: replace this stub with src/v3/metaphysics/bazi.ts (lunar-javascript backed).
// For now, keep parser inline so the engine continues to compile.
export type BirthInput = {
  year: number;
  month: number;
  day: number;
  hour: number;
};
export type EnrichedBaziChart = BaziChart & { __stub?: true };

const STEM_ELEMENTS: Record<string, string> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土",
  己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
};
const BRANCH_ELEMENTS: Record<string, string> = {
  子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火",
  午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水",
};
const STEMS = Object.keys(STEM_ELEMENTS);
const BRANCHES = Object.keys(BRANCH_ELEMENTS);

function dominantFromPillars(pillars: string[]): string[] {
  const tally: Record<string, number> = {};
  for (const pillar of pillars) {
    for (const ch of pillar) {
      const el = STEM_ELEMENTS[ch] ?? BRANCH_ELEMENTS[ch];
      if (el) tally[el] = (tally[el] ?? 0) + 1;
    }
  }
  return Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([el]) => el);
}

export function computeBaziFromBirth(_input: BirthInput): EnrichedBaziChart {
  // Phase 0 stub: returns a placeholder chart. Real lunar calc lands in Phase 3.
  const pillars = ["甲子", "甲子", "甲子", "甲子"];
  const chart: BaziChart = {
    raw: pillars.join(","),
    pillars,
    dominantElements: dominantFromPillars(pillars),
    tenGodHints: [],
    favorableElements: [],
    unfavorableElements: [],
  };
  return chart as EnrichedBaziChart;
}

export function parsePillarsRaw(raw: string): EnrichedBaziChart {
  const pieces = raw.split(",").map((p) => p.trim()).filter(Boolean).slice(0, 4);
  const pillars = pieces.map((p) => {
    const stem = STEMS.find((s) => p.includes(s)) ?? "甲";
    const branch = BRANCHES.find((b) => p.includes(b)) ?? "子";
    return `${stem}${branch}`;
  });
  while (pillars.length < 4) pillars.push("甲子");
  const chart: BaziChart = {
    raw: pillars.join(","),
    pillars,
    dominantElements: dominantFromPillars(pillars),
    tenGodHints: [],
    favorableElements: [],
    unfavorableElements: [],
  };
  return chart as EnrichedBaziChart;
}

type ElementScores = Record<string, number>;

function makeExplanation(
  summary: string,
  fateLayer: string,
  fortuneLayer: string,
  qimenLayer = "奇门层尚未介入。",
): MetaphysicsExplanation {
  return { summary, fateLayer, fortuneLayer, qimenLayer };
}

function keywords(text: string): string[] {
  return text
    .replace(/[，。；、]/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

// Element-score helpers for natural-language description analysis
// (NOT for bazi pillar parsing — that lives in lunar-bazi.ts now).
// Used by inferDescriptionCandidates() to score traits like "倔强 / 护短 / 求突破".
function emptyElementScores(): ElementScores {
  return { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
}

function topElements(scores: ElementScores): string[] {
  return Object.entries(scores)
    .sort((left, right) => right[1] - left[1])
    .filter(([, score]) => score > 0)
    .slice(0, 2)
    .map(([element]) => element);
}

function deriveTemperament(elements: string[]) {
  const signature = elements.join("");
  if (signature.includes("火")) {
    return {
      temperament: "先燃后断",
      pressureResponse: "遇压争先",
      relationshipStyle: "情烈而不退",
      initiative: 8,
      discipline: signature.includes("金") ? 7 : 4,
      opportunism: signature.includes("水") ? 6 : 4,
      volatility: 7,
    };
  }
  if (signature.includes("水") && signature.includes("金")) {
    return {
      temperament: "藏锋待时",
      pressureResponse: "逢乱潜行",
      relationshipStyle: "先试探后咬合",
      initiative: 4,
      discipline: 7,
      opportunism: 8,
      volatility: 5,
    };
  }
  if (signature.includes("土")) {
    return {
      temperament: "持重守序",
      pressureResponse: "稳局承压",
      relationshipStyle: "缓慢升温",
      initiative: 5,
      discipline: 8,
      opportunism: 4,
      volatility: 3,
    };
  }
  return {
    temperament: "顺势成长",
    pressureResponse: "先观后发",
    relationshipStyle: "以韧性换空间",
    initiative: 6,
    discipline: 6,
    opportunism: 5,
    volatility: 4,
  };
}

function buildFateProfile(
  candidateId: string,
  sourceMode: FateProfile["sourceMode"],
  label: string,
  dominantElements: string[],
  explainSummary: string,
): FateProfile {
  const traits = deriveTemperament(dominantElements);
  return {
    candidateId,
    sourceMode,
    label,
    dominantElements,
    explainSummary,
    ...traits,
  };
}

function parseBaziRaw(raw: string): BaziChart {
  // Delegate to lunar-javascript-backed wrapper.  EnrichedBaziChart is a
  // superset of BaziChart (extra optional fields), so structural assignment
  // is safe.  This swap is the W1 D1 step of the v2 architecture roadmap
  // (.audit/20260510-deep-research/synthesis.md).
  return parsePillarsRaw(raw);
}

function parseArchetypeDraft(raw: string): ArchetypeProfile {
  const dominantElements = ["水", "金", "木", "火", "土"].filter((element) => raw.includes(element));
  return {
    raw,
    dominantElements: dominantElements.length > 0 ? dominantElements.slice(0, 2) : ["土", "木"],
    disposition: raw,
    destinyThemes: raw.split("、").map((item) => item.trim()),
  };
}

function inferDescriptionCandidates(character: CharacterProfile, relationships: RelationshipProfile[]): BaziCandidate[] {
  const text = `${character.description ?? ""} ${character.traits.join(" ")} ${character.goal} ${character.stance}`;
  const scores = emptyElementScores();
  const words = keywords(text);

  const mappings: Array<[string, string[]]> = [
    ["火", ["火", "烈", "热", "冲", "争", "突破", "倔强", "不退"]],
    ["水", ["隐", "冷", "潜", "谋", "乱", "忍"]],
    ["金", ["规", "断", "锋", "执", "秩序", "克制"]],
    ["木", ["成长", "仁", "护", "生", "向上"]],
    ["土", ["稳", "守", "承", "重", "缓"]],
  ];

  for (const [element, hints] of mappings) {
    for (const word of words) {
      if (hints.some((hint) => word.includes(hint))) {
        scores[element] += 2;
      }
    }
  }

  const baseElements = topElements(scores);
  const inferredSets = [
    {
      id: `${character.id}-resonance`,
      label: "贴合画像",
      dominantElements: baseElements.length > 0 ? baseElements : ["火", "木"],
      dramaBonus: 1,
    },
    {
      id: `${character.id}-shadow`,
      label: "命运暗线",
      dominantElements: baseElements[0] === "火" ? ["水", "金"] : ["火", "金"],
      dramaBonus: 2,
    },
    {
      id: `${character.id}-balance`,
      label: "平衡格局",
      dominantElements: baseElements[0] === "水" ? ["土", "木"] : ["土", "水"],
      dramaBonus: 0,
    },
  ];

  const relationshipWeight = relationships.filter(
    (relationship) => relationship.left === character.name || relationship.right === character.name,
  ).length;

  return inferredSets.map((set) => {
    const fateProfile = buildFateProfile(
      set.id,
      "inferred",
      set.label,
      set.dominantElements,
      `${character.name}的描述与特质更接近${set.dominantElements.join("、")}主导。`,
    );
    const characterFit = 5 + (set.label === "贴合画像" ? 3 : 0);
    const worldConsistency = 4 + (character.stance.includes("守") ? fateProfile.discipline : fateProfile.opportunism) / 2;
    const destinyClarity = 5 + fateProfile.dominantElements.length;
    const dramaPotential = 4 + fateProfile.initiative / 2 + set.dramaBonus;
    const relationshipTension = 4 + relationshipWeight + fateProfile.volatility / 2;
    return {
      id: set.id,
      label: set.label,
      sourceMode: "inferred" as const,
      fateProfile,
      scores: {
        characterFit,
        worldConsistency,
        destinyClarity,
        dramaPotential,
        relationshipTension,
        total:
          characterFit + worldConsistency + destinyClarity + dramaPotential + relationshipTension,
      },
      explanation: makeExplanation(
        `${character.name}的自然语言画像被映射成多套命理候选。`,
        `本命层：候选“${set.label}”强调${set.dominantElements.join("、")}之性，解释其面对压力时的默认反应。`,
        "运势层：该候选仅给出本命，不直接指定某一阶段顺逆。",
      ),
    };
  });
}

function rawBaziCandidate(character: CharacterProfile): BaziCandidate | null {
  if (!character.baziRaw) {
    return null;
  }
  const chart = parseBaziRaw(character.baziRaw);
  const fateProfile = buildFateProfile(
    `${character.id}-raw-bazi`,
    "bazi",
    "真排盘本命",
    chart.dominantElements,
    `${character.name}直接采用真实四柱输入。`,
  );

  const characterFit = 7;
  const worldConsistency = 6 + fateProfile.discipline / 3;
  const destinyClarity = 8;
  const dramaPotential = 4 + fateProfile.volatility / 2;
  const relationshipTension = 5 + fateProfile.relationshipStyle.length / 10;

  return {
    id: fateProfile.candidateId,
    label: fateProfile.label,
    sourceMode: "bazi",
    baziChart: chart,
    fateProfile,
    scores: {
      characterFit,
      worldConsistency,
      destinyClarity,
      dramaPotential,
      relationshipTension,
      total: characterFit + worldConsistency + destinyClarity + dramaPotential + relationshipTension + 12,
    },
    explanation: makeExplanation(
      `${character.name}使用真实八字输入作为本命候选。`,
      `本命层：四柱 ${chart.pillars.join(" / ")} 显示${chart.dominantElements.join("、")}偏强。`,
      "运势层：后续阶段顺逆会基于该命盘映射。",
    ),
  };
}

function archetypeCandidate(character: CharacterProfile): BaziCandidate | null {
  if (!character.archetypeDraft) {
    return null;
  }
  const archetype = parseArchetypeDraft(character.archetypeDraft);
  const fateProfile = buildFateProfile(
    `${character.id}-archetype`,
    "archetype",
    "抽象命理画像",
    archetype.dominantElements,
    `${character.name}使用抽象八字画像进入推演。`,
  );

  const characterFit = 6;
  const worldConsistency = 5 + fateProfile.opportunism / 3;
  const destinyClarity = 7;
  const dramaPotential = 5 + fateProfile.opportunism / 2;
  const relationshipTension = 5 + fateProfile.volatility / 2;

  return {
    id: fateProfile.candidateId,
    label: fateProfile.label,
    sourceMode: "archetype",
    archetypeProfile: archetype,
    fateProfile,
    scores: {
      characterFit,
      worldConsistency,
      destinyClarity,
      dramaPotential,
      relationshipTension,
      total: characterFit + worldConsistency + destinyClarity + dramaPotential + relationshipTension + 10,
    },
    explanation: makeExplanation(
      `${character.name}使用抽象五行与命运主题画像。`,
      `本命层：画像强调${archetype.dominantElements.join("、")}与“${archetype.disposition}”。`,
      "运势层：后续阶段会把“逢乱得势/遇压转烈”等主题转换成顺逆变化。",
    ),
  };
}

export function buildBaziCandidates(
  character: CharacterProfile,
  parsed: ParsedWorldDraft,
): BaziCandidate[] {
  const related = parsed.relationships.filter(
    (relationship) => relationship.left === character.name || relationship.right === character.name,
  );
  const candidates = [
    ...inferDescriptionCandidates(character, related),
    rawBaziCandidate(character),
    archetypeCandidate(character),
  ].filter(Boolean) as BaziCandidate[];

  return candidates.sort((left, right) => right.scores.total - left.scores.total);
}

export function buildFortuneCycle(
  stageNumber: number,
  fateProfile: FateProfile,
): FortuneCycle {
  const signatures = ["蓄势", "扬升", "承压", "转机"];
  const momenta: FortuneCycle["momentum"][] = ["steady", "rising", "strained", "volatile"];
  const index = (stageNumber + fateProfile.initiative + fateProfile.discipline) % signatures.length;
  const cycleLabel = signatures[index];
  const momentum = momenta[index];
  const favorability = Math.max(
    -2,
    Math.min(2, Math.round((fateProfile.initiative - fateProfile.volatility + stageNumber) / 4)),
  );
  return {
    cycleLabel,
    momentum,
    favorability,
    manifestationTheme:
      momentum === "rising"
        ? "外显争先"
        : momentum === "strained"
          ? "承压守势"
          : momentum === "volatile"
            ? "变局试探"
            : "蓄势观望",
    riskBias: favorability >= 1 ? "顺势冒进" : favorability <= -1 ? "遇阻回收" : "平衡推进",
  };
}

function autoQimenPattern(stageLabel: string, intervention?: string): Pick<QimenContext, "pattern" | "eventType" | "strongSituationScore" | "locationFocus"> {
  const text = `${stageLabel} ${intervention ?? ""}`;
  if (text.includes("爆裂") || text.includes("失衡")) {
    return {
      pattern: "惊门迫宫",
      eventType: "危机爆发",
      strongSituationScore: text.includes("外敌压境") ? 3 : 2,
      locationFocus: text.includes("丹谷") ? "地火丹谷" : "外门山城",
    };
  }
  if (text.includes("试炼")) {
    return {
      pattern: "开门值使",
      eventType: "竞争试炼",
      strongSituationScore: 1,
      locationFocus: "外门山城",
    };
  }
  return {
    pattern: "休门稳局",
    eventType: "常规推进",
    strongSituationScore: 0,
    locationFocus: "外门山城",
  };
}

export function buildQimenContext(input: {
  stageLabel: string;
  intervention?: string;
  qimenOverride?: Partial<QimenContext> & { allowHardDecision?: boolean };
}): QimenContext {
  const auto = autoQimenPattern(input.stageLabel, input.intervention);
  const override = input.qimenOverride ?? {};
  const sourceMode = override.sourceMode ?? (override.pattern || override.locationFocus ? "hybrid" : "auto");
  return {
    sourceMode,
    pattern: override.pattern ?? auto.pattern,
    locationFocus: override.locationFocus ?? auto.locationFocus,
    eventType: override.eventType ?? auto.eventType,
    strongSituationScore: Math.max(auto.strongSituationScore, override.strongSituationScore ?? 0),
    allowHardDecision: override.allowHardDecision,
  };
}

export function buildQimenModifier(context: QimenContext): QimenModifier {
  let timingShift: QimenModifier["timingShift"] = "steady";
  let outcomeBias: QimenModifier["outcomeBias"] = "steady";
  let timingWeight = 0;
  let outcomeWeight = 0;

  if (context.pattern.includes("开门")) {
    timingShift = "advance";
    outcomeBias = "boost";
    timingWeight = 2;
    outcomeWeight = 2;
  } else if (context.pattern.includes("惊门")) {
    timingShift = "redirect";
    outcomeBias = "twist";
    timingWeight = 2;
    outcomeWeight = 1;
  } else if (context.pattern.includes("伤门")) {
    timingShift = "delay";
    outcomeBias = "drag";
    timingWeight = -2;
    outcomeWeight = -2;
  } else if (context.pattern.includes("休门")) {
    timingShift = "delay";
    outcomeBias = "steady";
    timingWeight = -1;
    outcomeWeight = 0;
  }

  const hardDecisionAllowed = Boolean(context.allowHardDecision && context.strongSituationScore >= 3);
  return {
    timingShift,
    outcomeBias,
    timingWeight,
    outcomeWeight,
    hardDecision: hardDecisionAllowed
      ? {
          type: context.pattern.includes("惊门") ? "timing" : "outcome",
          verdict:
            context.pattern.includes("惊门")
              ? "强局压顶，事件提前并转向最脆弱的场域爆发。"
              : "强局扶旺，关键行动在此阶段直接得势。",
        }
      : undefined,
  };
}

export function qimenExplanation(context: QimenContext, modifier: QimenModifier): string {
  const hardLine = modifier.hardDecision ? ` 已触发硬裁决：${modifier.hardDecision.verdict}` : " 仅作为概率修正器生效。";
  return `奇门层：${context.pattern}作用于${context.locationFocus}，事件类型为${context.eventType}，时机偏移=${modifier.timingShift}，结果偏移=${modifier.outcomeBias}.${hardLine}`;
}
