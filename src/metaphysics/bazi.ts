// Phase 3 · real bazi computation via lunar-javascript.
// Replaces the Phase 0 stub in src/metaphysics.ts (which the legacy engine
// still uses; that's intentional — v3 engine in Phase 4 will call this one).

import lunar from "lunar-javascript";

import type {
  BaziChart,
  BaziPillar,
  FateProfile,
  FiveElement,
} from "../domain/metaphysics";

const STEM_ELEMENTS: Record<string, FiveElement> = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土",
  己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
};
const BRANCH_ELEMENTS: Record<string, FiveElement> = {
  子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火",
  午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水",
};

const ALL_ELEMENTS: FiveElement[] = ["木", "火", "土", "金", "水"];

const ELEMENT_GENERATES: Record<FiveElement, FiveElement> = {
  木: "火", 火: "土", 土: "金", 金: "水", 水: "木",
};
const ELEMENT_CONTROLS: Record<FiveElement, FiveElement> = {
  木: "土", 火: "金", 土: "水", 金: "木", 水: "火",
};

export type BirthInput = {
  year: number;
  month: number;   // 1..12 solar
  day: number;     // 1..31 solar
  hour: number;    // 0..23
  minute?: number;
  second?: number;
};

function splitPillar(pillar: string): BaziPillar {
  const stem = pillar[0] ?? "甲";
  const branch = pillar[1] ?? "子";
  return { stem, branch };
}

function tallyElements(pillars: BaziPillar[]): Record<FiveElement, number> {
  const tally: Record<FiveElement, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const pillar of pillars) {
    const stemEl = STEM_ELEMENTS[pillar.stem];
    const branchEl = BRANCH_ELEMENTS[pillar.branch];
    if (stemEl) tally[stemEl] += 1;
    if (branchEl) tally[branchEl] += 1;
  }
  return tally;
}

function rankElements(tally: Record<FiveElement, number>): FiveElement[] {
  return ALL_ELEMENTS.slice().sort((a, b) => tally[b] - tally[a]);
}

/**
 * Real bazi computation. Uses lunar-javascript for the solar-to-bazi
 * conversion (子平派 + 23:00 day boundary).
 */
export function computeBazi(input: BirthInput): BaziChart {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Solar: any = (lunar as any).Solar ?? lunar;
  const solar = Solar.fromYmdHms(
    input.year,
    input.month,
    input.day,
    input.hour,
    input.minute ?? 0,
    input.second ?? 0,
  );
  const eightChar = solar.getLunar().getEightChar();
  const pillars: BaziPillar[] = [
    splitPillar(eightChar.getYear()),
    splitPillar(eightChar.getMonth()),
    splitPillar(eightChar.getDay()),
    splitPillar(eightChar.getTime()),
  ];

  const tally = tallyElements(pillars);
  const ranked = rankElements(tally);
  const dayMaster = STEM_ELEMENTS[pillars[2].stem];

  const favorable = dayMaster
    ? [ELEMENT_GENERATES[dayMaster], dayMaster].filter((e): e is FiveElement => Boolean(e))
    : [];
  const unfavorable = dayMaster
    ? [ELEMENT_CONTROLS[dayMaster]].filter((e): e is FiveElement => Boolean(e))
    : [];

  return {
    raw: pillars.map((p) => `${p.stem}${p.branch}`).join(","),
    pillars,
    dominantElements: ranked.slice(0, 2),
    favorableElements: favorable,
    unfavorableElements: unfavorable,
    tenGodHints: [String(eightChar.getYearShiShenGan() ?? "")].filter(Boolean),
  };
}

/**
 * Pure-string variant: parse "辛巳,癸酉,己亥,乙丑" into a chart without lunar
 * calendar math (used by world.md drafts where author supplied pillars).
 */
export function parsePillars(raw: string): BaziChart {
  const pieces = raw.split(",").map((p) => p.trim()).filter(Boolean).slice(0, 4);
  while (pieces.length < 4) pieces.push("甲子");
  const pillars = pieces.map(splitPillar);
  const tally = tallyElements(pillars);
  const ranked = rankElements(tally);
  const dayMaster = STEM_ELEMENTS[pillars[2].stem];

  return {
    raw: pillars.map((p) => `${p.stem}${p.branch}`).join(","),
    pillars,
    dominantElements: ranked.slice(0, 2),
    favorableElements: dayMaster
      ? [ELEMENT_GENERATES[dayMaster], dayMaster].filter((e): e is FiveElement => Boolean(e))
      : [],
    unfavorableElements: dayMaster
      ? [ELEMENT_CONTROLS[dayMaster]].filter((e): e is FiveElement => Boolean(e))
      : [],
    tenGodHints: [],
  };
}

/**
 * Derive a FateProfile (the runtime-facing temperament summary) from a chart.
 * Pure projection from elements → personality numbers.
 */
export function fateFromBazi(
  candidateId: string,
  chart: BaziChart,
  sourceMode: FateProfile["sourceMode"],
): FateProfile {
  const dominant = chart.dominantElements;
  const signature = dominant.join("");
  const isFire = signature.includes("火");
  const isWater = signature.includes("水");
  const isMetal = signature.includes("金");
  const isEarth = signature.includes("土");
  const isWood = signature.includes("木");

  const initiative = isFire ? 8 : isWood ? 7 : isMetal ? 6 : isWater ? 4 : 5;
  const discipline = isMetal ? 8 : isEarth ? 8 : isWater ? 6 : 4;
  const opportunism = isWater ? 8 : isWood ? 6 : 4;
  const volatility = isFire ? 7 : isWater ? 5 : 3;

  const temperament =
    isFire ? "先燃后断" :
    isWater && isMetal ? "藏锋待时" :
    isEarth ? "持重守序" :
    isWood ? "顺势成长" : "守局观变";

  const pressureResponse =
    isFire ? "遇压争先" :
    isWater ? "逢乱潜行" :
    isEarth ? "稳局承压" : "先观后发";

  return {
    candidateId,
    sourceMode,
    label: `${dominant.join("·")} ${temperament}`,
    dominantElements: dominant,
    temperament,
    pressureResponse,
    relationshipStyle: isFire ? "情烈而不退" : isWater ? "先试探后咬合" : "缓慢升温",
    initiative,
    discipline,
    opportunism,
    volatility,
    explainSummary: `${dominant.join("·")}主性，${temperament}，${pressureResponse}。`,
  };
}
