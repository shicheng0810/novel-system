// app/persona.ts — M2 终身记忆之「每角色 persona digest」。把 LLM 抽取的 canon 属性 + 符号态(M1 drive / 恩怨 bond / 执念 goal / 复仇)
//   拼成一段"此人此刻是谁、心里揣着什么"的定长前情, 每次其登场注入 compose → 角色带着自己的一生与恩怨出场。
//   零新 LLM(canon 已有、其余读 snapshot props)。core/ 不涉, 叶子模块。
import type { WorldSnapshot, CharacterState } from "../core/domain/world";
import type { Canon } from "./canon";

// M1 通用内态键 → 措辞(core 出 generic innerDrive, 这里渲染)
export const INNER_CN: Record<string, string> = { ambition: "执念在心", want: "求而不得", grudge: "意有所怨", attachment: "心有所系", vengeance: "复仇噬心", distress: "心绪如焚", calm: "" };

const numOf = (c: CharacterState, k: string): number => (typeof c.props[k] === "number" ? (c.props[k] as number) : 0);

// 单角色 persona digest(符号合成, 零 LLM): 属性(canon) + 心境(drive) + 恩怨账(top bonds) + 执念/复仇
export function personaDigest(c: CharacterState, snap: WorldSnapshot, canon: Canon): string {
  const nameOf = (id: string): string => snap.characters[id]?.name ?? id;
  const attrs = (canon.characters[c.name] ?? []).slice(0, 3); // canon 抽取的关键属性(灵根/身份/状态)
  const inner = INNER_CN[String(c.props["innerDrive"] ?? "")] ?? "";
  const bonds = Object.entries(c.props)
    .filter(([k, v]) => k.startsWith("bond:") && typeof v === "number" && Math.abs(v as number) >= 2 && snap.characters[k.slice(5)]?.present)
    .sort((a, b) => Math.abs(b[1] as number) - Math.abs(a[1] as number))
    .slice(0, 3)
    .map(([k, v]) => `${(v as number) > 0 ? "亲" : "仇"}${nameOf(k.slice(5))}`);
  const av = typeof c.props["avenge"] === "string" ? `誓为「${String(c.props["avenge"])}」复仇` : "";
  const li = numOf(c, "历练");
  const seasoned = li >= 15 ? "历经百劫" : li >= 6 ? "略有阅历" : "";
  const parts = [attrs.join("、"), seasoned, inner, bonds.length ? "牵系：" + bonds.join("、") : "", av].filter(Boolean);
  return parts.length ? `${c.name}——${parts.join("；")}` : "";
}

// 在场者 persona 块(注入 compose; 取在场中最"有戏"的若干人, 避免过长)
export function personaBlock(snap: WorldSnapshot, canon: Canon, limit = 8): string {
  const present = Object.values(snap.characters).filter((c) => c.present);
  // 排序: 有复仇/强恩怨/高执念者优先(更该被前情点到)
  const heat = (c: CharacterState): number => {
    let h = typeof c.props["avenge"] === "string" ? 3 : 0;
    for (const [k, v] of Object.entries(c.props)) if (k.startsWith("bond:") && typeof v === "number") h += Math.min(2, Math.abs(v as number) / 3);
    const d = c.props["drives"]; if (d && typeof d === "object") h += Number((d as Record<string, number>)["ambition"] ?? 0);
    return h;
  };
  const top = [...present].sort((a, b) => heat(b) - heat(a)).slice(0, limit);
  const lines = top.map((c) => personaDigest(c, snap, canon)).filter(Boolean);
  return lines.length ? `【在场者·各怀心事(须体现其当下心境与恩怨, 勿写成路人)】\n${lines.join("\n")}` : "";
}

// 宿缘召回(零 LLM, 词法): 从显著记忆里挑"同时点到两位在场者"的旧账, 让同框者想起前事
export function recallShared(salient: Array<{ characterId: string; body: string }>, snap: WorldSnapshot, limit = 3): string[] {
  const present = Object.values(snap.characters).filter((c) => c.present);
  const names = present.map((c) => c.name).filter(Boolean);
  const out: string[] = [];
  for (const m of salient) {
    const hit = names.filter((n) => n && m.body.includes(n));
    if (hit.length >= 2) { out.push(m.body); if (out.length >= limit) break; }
  }
  return out;
}
