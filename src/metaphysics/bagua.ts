import type { StageDirective } from "../domain";

export type BaguaTrigram = "乾" | "坤" | "震" | "巽" | "坎" | "离" | "艮" | "兑";

export type BaguaSituation = {
  situationId: string;
  internalTrigram: BaguaTrigram;
  externalTrigram: BaguaTrigram;
  opposition?: {
    left: string;
    right: string;
    pressure: string;
  };
  changingLines: number[];
  structuralTags: string[];
  narrativeEffect: string;
};

const effects: Record<BaguaTrigram, string> = {
  乾: "权威推进，强者意志压入局面。",
  坤: "群体承压，资源与承载成为主要矛盾。",
  震: "惊动发动，突发事件推动角色表态。",
  巽: "渗透传播，暗线影响开始扩散。",
  坎: "隐藏危险，陷阱、旧债、身份风险潜伏在内层。",
  离: "秘密显形，证据、名声、暴露成为外部压力。",
  艮: "门槛阻隔，试炼、守关、拖延形成结构压力。",
  兑: "交换裂口，谈判、诱惑、关系缝隙被放大。",
};

function includesAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

export function deriveBaguaSituation(directive: StageDirective): BaguaSituation {
  const text = [directive.stageLabel, directive.intervention ?? "", directive.focusCharacterIds.join("，")].join(" ");
  const tags: string[] = [];
  let internalTrigram: BaguaTrigram = "坤";
  let externalTrigram: BaguaTrigram = "艮";
  const changingLines: number[] = [3];

  if (includesAny(text, ["内应", "潜伏", "密", "暗", "陷", "危"])) {
    internalTrigram = "坎";
    tags.push("hidden-threat");
  }
  if (includesAny(text, ["暴露", "搜查", "证据", "名声", "显"])) {
    externalTrigram = "离";
    tags.push("exposure");
    changingLines.push(5);
  } else if (includesAny(text, ["爆裂", "惊", "突发", "发动"])) {
    externalTrigram = "震";
    tags.push("sudden-shock");
  } else if (includesAny(text, ["渗透", "传播", "风声"])) {
    externalTrigram = "巽";
    tags.push("infiltration");
  } else if (includesAny(text, ["试炼", "守", "封", "关", "门槛"])) {
    externalTrigram = "艮";
    tags.push("threshold");
  }

  if (tags.length === 0) {
    tags.push("threshold");
  }

  return {
    situationId: `bagua-${internalTrigram}${externalTrigram}-${tags.join("-")}`,
    internalTrigram,
    externalTrigram,
    opposition: {
      left: effects[internalTrigram],
      right: effects[externalTrigram],
      pressure: `${internalTrigram}${externalTrigram}相叠，${effects[internalTrigram]}${effects[externalTrigram]}`,
    },
    changingLines: [...new Set(changingLines)].sort((left, right) => left - right),
    structuralTags: [...new Set(tags)],
    narrativeEffect: `${effects[internalTrigram]}${effects[externalTrigram]}`,
  };
}
