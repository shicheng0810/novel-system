import type { QimenContext, QimenModifier } from "../domain";

export type QimenBoard = {
  boardId: string;
  temporalFrame: {
    calendarMode: "fictional-cycle" | "real-calendar" | "manual-ganzhi";
    yearGanzhi: string;
    monthGanzhi: string;
    dayGanzhi: string;
    hourGanzhi: string;
    seasonPolarity: "yang-dun" | "yin-dun" | "neutral";
    source: "manual" | "fictional";
    confidence: "derived" | "inferred";
  };
  school: "manual-lite";
  dun: "yang" | "yin";
  juNumber: number;
  yuan: "upper" | "middle" | "lower";
  palaces: QimenPalace[];
  valueChief: string;
  valueEnvoy: string;
  activePalace: number;
  focusPalaces: number[];
  hardDecisionAllowed: boolean;
};

export type QimenPalace = {
  palace: number;
  direction: string;
  door: string;
  star: string;
  deity: string;
  heavenStem?: string;
  earthStem?: string;
  tags: string[];
};

const directions = ["坎北", "坤西南", "震东", "巽东南", "中宫", "乾西北", "兑西", "艮东北", "离南"];
const doors = ["休门", "生门", "伤门", "杜门", "景门", "死门", "惊门", "开门", "休门"];

function doorFromPattern(pattern: string): string {
  const match = ["开门", "休门", "生门", "伤门", "杜门", "景门", "死门", "惊门"].find((door) =>
    pattern.includes(door),
  );
  return match ?? "休门";
}

function tagsFor(context: QimenContext, modifier: QimenModifier): string[] {
  return [
    `pattern:${context.pattern}`,
    `location:${context.locationFocus}`,
    `event:${context.eventType}`,
    `timing:${modifier.timingShift}`,
    `outcome:${modifier.outcomeBias}`,
  ];
}

export function buildQimenBoard(input: {
  context: QimenContext;
  modifier: QimenModifier;
  stageNumber: number;
}): QimenBoard {
  const activeDoor = doorFromPattern(input.context.pattern);
  const activePalace = Math.max(1, ((input.stageNumber + input.context.strongSituationScore) % 9) || 9);
  const palaces = directions.map((direction, index) => ({
    palace: index + 1,
    direction,
    door: index + 1 === activePalace ? activeDoor : doors[index],
    star: index + 1 === activePalace ? "值符星" : "辅星",
    deity: index + 1 === activePalace ? "值使" : "值守",
    tags: index + 1 === activePalace ? tagsFor(input.context, input.modifier) : [],
  }));

  return {
    boardId: `qimen-${input.stageNumber}-${activeDoor}-${activePalace}`,
    temporalFrame: {
      calendarMode: "fictional-cycle",
      yearGanzhi: "甲子",
      monthGanzhi: "乙丑",
      dayGanzhi: "丙寅",
      hourGanzhi: "丁卯",
      seasonPolarity: input.stageNumber % 2 === 0 ? "yin-dun" : "yang-dun",
      source: "fictional",
      confidence: "inferred",
    },
    school: "manual-lite",
    dun: input.stageNumber % 2 === 0 ? "yin" : "yang",
    juNumber: Math.max(1, ((input.stageNumber + input.context.strongSituationScore) % 9) || 9),
    yuan: input.stageNumber % 3 === 1 ? "upper" : input.stageNumber % 3 === 2 ? "middle" : "lower",
    palaces,
    valueChief: palaces[activePalace - 1].star,
    valueEnvoy: activeDoor,
    activePalace,
    focusPalaces: [activePalace],
    hardDecisionAllowed: Boolean(input.context.allowHardDecision && input.modifier.hardDecision),
  };
}
