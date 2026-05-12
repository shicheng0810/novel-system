// Phase 3 · qimen board + modifier.
// Ports the deterministic v2 qimen-board logic to v3 types.

import type { QimenContext, QimenModifier } from "../domain/metaphysics";

export type QimenPalace = {
  palace: number;     // 1..9 (luoshu numbering)
  direction: string;
  door: string;
  star: string;
  deity: string;
  tags: string[];
};

export type QimenBoard = {
  boardId: string;
  dun: "yang" | "yin";
  juNumber: number;
  yuan: "upper" | "middle" | "lower";
  palaces: QimenPalace[];
  activePalace: number;
  focusPalaces: number[];
  valueChief: string;
  valueEnvoy: string;
};

const DIRECTIONS = ["坎北", "坤西南", "震东", "巽东南", "中宫", "乾西北", "兑西", "艮东北", "离南"];
const DOORS = ["休门", "生门", "伤门", "杜门", "景门", "死门", "惊门", "开门", "休门"];
const KNOWN_DOORS = ["开门", "休门", "生门", "伤门", "杜门", "景门", "死门", "惊门"];

const PATTERN_BIAS: Record<string, { timingShift: QimenModifier["timingShift"]; outcomeBias: QimenModifier["outcomeBias"]; timingWeight: number; outcomeWeight: number }> = {
  休门: { timingShift: "steady",   outcomeBias: "steady", timingWeight: 0, outcomeWeight: 0 },
  生门: { timingShift: "advance",  outcomeBias: "boost",  timingWeight: 2, outcomeWeight: 2 },
  伤门: { timingShift: "redirect", outcomeBias: "drag",   timingWeight: -1, outcomeWeight: -2 },
  杜门: { timingShift: "delay",    outcomeBias: "drag",   timingWeight: -2, outcomeWeight: -1 },
  景门: { timingShift: "advance",  outcomeBias: "twist",  timingWeight: 1, outcomeWeight: 1 },
  死门: { timingShift: "redirect", outcomeBias: "drag",   timingWeight: -2, outcomeWeight: -2 },
  惊门: { timingShift: "advance",  outcomeBias: "twist",  timingWeight: 3, outcomeWeight: 1 },
  开门: { timingShift: "advance",  outcomeBias: "boost",  timingWeight: 2, outcomeWeight: 3 },
};

function doorFromPattern(pattern: string): string {
  return KNOWN_DOORS.find((door) => pattern.includes(door)) ?? "休门";
}

export function buildQimenModifier(context: QimenContext): QimenModifier {
  const door = doorFromPattern(context.pattern);
  const bias = PATTERN_BIAS[door] ?? PATTERN_BIAS.休门;
  return { ...bias };
}

export function buildQimenBoard(input: {
  context: QimenContext;
  modifier: QimenModifier;
  stageNumber: number;
}): QimenBoard {
  const activeDoor = doorFromPattern(input.context.pattern);
  const activePalace = Math.max(1, ((input.stageNumber + input.context.strongSituationScore) % 9) || 9);
  const palaces: QimenPalace[] = DIRECTIONS.map((direction, index) => ({
    palace: index + 1,
    direction,
    door: index + 1 === activePalace ? activeDoor : DOORS[index],
    star: index + 1 === activePalace ? "值符星" : "辅星",
    deity: index + 1 === activePalace ? "值使" : "值守",
    tags: index + 1 === activePalace
      ? [
          `pattern:${input.context.pattern}`,
          `timing:${input.modifier.timingShift}`,
          `outcome:${input.modifier.outcomeBias}`,
        ]
      : [],
  }));

  return {
    boardId: `qimen-${input.stageNumber}-${activeDoor}-${activePalace}`,
    dun: input.stageNumber % 2 === 0 ? "yin" : "yang",
    juNumber: activePalace,
    yuan: input.stageNumber % 3 === 1 ? "upper" : input.stageNumber % 3 === 2 ? "middle" : "lower",
    palaces,
    activePalace,
    focusPalaces: [activePalace],
    valueChief: "值符星",
    valueEnvoy: activeDoor,
  };
}

export function defaultQimenContext(stageLabel: string, override?: Partial<QimenContext>): QimenContext {
  return {
    sourceMode: override ? "hybrid" : "auto",
    pattern: override?.pattern ?? autoPickPattern(stageLabel),
    locationFocus: override?.locationFocus ?? "外门",
    eventType: override?.eventType ?? "推进",
    strongSituationScore: override?.strongSituationScore ?? 1,
    allowHardDecision: override?.allowHardDecision ?? false,
  };
}

function autoPickPattern(label: string): string {
  if (/高潮|决战|血|惊变|惊|突发|爆/.test(label)) return "阳遁三局·惊门";
  if (/试炼|压|守|封|关/.test(label)) return "阳遁三局·杜门";
  if (/突破|破/.test(label)) return "阳遁三局·开门";
  if (/收|尾|静/.test(label)) return "阴遁四局·休门";
  if (/伏|暗|潜|隐/.test(label)) return "阳遁三局·伤门";
  return "阳遁三局·生门";
}
