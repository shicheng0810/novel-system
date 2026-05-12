// Phase 3 · bagua situation derivation.
// Port of v2 src/metaphysics/bagua.ts to v3 types.

import type { BaguaSituation } from "../domain/metaphysics";
import type { StageDirective } from "../domain/world";

type Trigram = "乾" | "坤" | "震" | "巽" | "坎" | "离" | "艮" | "兑";

const EFFECTS: Record<Trigram, string> = {
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
  const text = [
    directive.stageLabel,
    directive.intervention ?? "",
    directive.focusCharacterIds.join("，"),
  ].join(" ");

  const tags: BaguaSituation["structuralTags"] = [];
  let internal: Trigram = "坤";
  let external: Trigram = "艮";

  if (includesAny(text, ["内应", "潜伏", "密", "暗", "陷", "危"])) {
    internal = "坎";
    tags.push("hidden-threat");
  }
  if (includesAny(text, ["暴露", "搜查", "证据", "名声", "显"])) {
    external = "离";
    tags.push("exposure");
  } else if (includesAny(text, ["爆裂", "惊", "突发", "发动"])) {
    external = "震";
    tags.push("rupture");
  } else if (includesAny(text, ["试炼", "守", "封", "关", "门槛", "压"])) {
    external = "艮";
    tags.push("delay");
  }
  if (tags.length === 0) tags.push("delay");

  return {
    situationId: `bagua-${internal}${external}-${tags.join("-")}`,
    internalTrigram: internal,
    externalTrigram: external,
    structuralTags: [...new Set(tags)],
    narrativeEffect: `${EFFECTS[internal]}${EFFECTS[external]}`,
  };
}
