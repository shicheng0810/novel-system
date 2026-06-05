// app/derive-canon.ts — 最高 ROI 修复(审计 §架构)。canon 的「硬事实」(境界/派系/生死/恩怨/复仇)引擎本就有权威值,
//   原先让 LLM 从 900 字截断的正文里【再抽取】是一条有损往返、随章数熵增 → canon 一致性在 9↔2 振荡。
//   改为: 硬事实从 events/snapshot 【确定性派生】(零 LLM、零漂移)→ 强注入生成(prose 不再漂)+ 一致性校验对照权威态。
//   canonStep 的 LLM 退化为只补「软描述层」(灵根来历/隐秘/性情/伏笔), 不再碰境界/派系。core/ 不涉, 叶子模块。
import type { WorldSnapshot, CharacterState } from "../core/domain/world";

// onStage = c.present(是否在场)。注: present=false 有三源——CharacterFell/同归于尽(真死) 与 CharacterTranscended(飞升, 非死亡); 故此字段是"在场"而非"存活", 勿据此判生死/可复仇。下游 derivedBlock/derivedFacts 只用它做在场过滤(写谁约束谁), 飞升者与逝者同样排除出在场设定块, 语义正确。
export interface Derived { name: string; tier: string; faction: string; onStage: boolean; bonds: string[]; avenge?: string; seasoning: number }

const numOf = (c: CharacterState, k: string): number => (typeof c.props[k] === "number" ? (c.props[k] as number) : 0);

export function deriveCanon(snap: WorldSnapshot, tierName: (id?: string) => string): Record<string, Derived> {
  const out: Record<string, Derived> = {};
  const nameOf = (id: string): string => snap.characters[id]?.name ?? id;
  for (const c of Object.values(snap.characters)) {
    const bonds = Object.entries(c.props)
      .filter(([k, v]) => k.startsWith("bond:") && typeof v === "number" && Math.abs(v as number) >= 2 && snap.characters[k.slice(5)])
      .sort((a, b) => Math.abs(b[1] as number) - Math.abs(a[1] as number))
      .slice(0, 3)
      .map(([k, v]) => `${(v as number) > 0 ? "亲" : "仇"}${nameOf(k.slice(5))}`);
    out[c.id] = {
      name: c.name,
      tier: tierName(c.progressionTier),
      faction: typeof c.props["faction"] === "string" ? (c.props["faction"] as string) : "",
      onStage: c.present,
      bonds,
      avenge: typeof c.props["avenge"] === "string" ? (c.props["avenge"] as string) : undefined,
      seasoning: numOf(c, "历练"),
    };
  }
  return out;
}

// 权威设定块(引擎确定值, 每章强注入生成; prose 不可与之矛盾)。只列在场者——写谁约束谁。
export function derivedBlock(derived: Record<string, Derived>): string {
  const present = Object.values(derived).filter((d) => d.onStage);
  if (!present.length) return "";
  const lines = present.slice(0, 16).map((d) => {
    const seasoned = d.seasoning >= 15 ? "·历经百劫" : d.seasoning >= 6 ? "·略有阅历" : "";
    return `${d.name}：境界=${d.tier}${seasoned}${d.faction ? "、属" + d.faction : ""}${d.bonds.length ? "、" + d.bonds.join("、") : ""}${d.avenge ? "、誓复「" + d.avenge + "」之仇" : ""}`;
  });
  return `【权威设定·引擎确定值, 须严格一致(写错任一角色的境界/派系/生死/恩怨即出戏, 不得擅自给人升境或改派)】\n${lines.join("；")}\n※ 正文只准用上列在场角色的【原名】, 严禁写未列出的名字、或与上列仅一字之差的近似名(如把「${present[0]?.name ?? "某甲"}」写成形近的别名); 已退场/逝去者不得再出场行动。`;
}

// 喂一致性校验的"硬事实"对照表: 让 LLM 据此判 prose 有无写错境界/派系, 而非自己再抽取(消除抽取漂移)
export function derivedFacts(derived: Record<string, Derived>): string {
  return Object.values(derived)
    .filter((d) => d.onStage)
    .slice(0, 20)
    .map((d) => `${d.name}(${d.tier}${d.faction ? "·" + d.faction : ""}${d.avenge ? "·复仇中" : ""})`)
    .join("、");
}
