// app/minds.ts — M3 批量异步 LLM 反思(给"持续内心"加稀有但真实的深度)。
//   ① importance 门控(零 LLM): 事件按卷入深度给每角色 pending_importance 增量, 破阈才入"待反思队列"。
//   ② 批量(一次 LLM 更新 K≤8 人): 世界背景做共享前缀, 每人编号小节防串味, JSON 数组一次性出每人一句内心/立场。
//   ③ 异步 + 单写者: 批量 LLM 在 step 之外跑(off-critical-path), 结果经 store.enqueueInput("mind-update")
//      → 下个 step 的 drainInputs 在单事务里写入(WorldActor 仍是唯一写者, 铁律不破)。反思滞后 1~2 tick(慢变量, 可接受)。
// 借: Smallville importance>阈反思 · TopoSim 代表共享 · OpenCity 共享前缀 · AI Town input 异步写回。core/ 不涉。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { LLMProvider } from "../core/services/llm";
import type { WorldSnapshot, CharacterState } from "../core/domain/world";

export interface MindsState { pendingImp: Record<string, number>; lastReflectCh: number; lastFp?: Record<string, string> }
export interface MindUpdate { id: string; mind: string; stress?: number }

// M4 策略缓存(AGA Lifestyle Policy): 情境指纹。破阈但指纹未变 → 复用上次心声、不重新调 LLM。
export function situationFp(c: CharacterState): string {
  const d = c.props["drives"]; const amb = d && typeof d === "object" ? Math.round(((d as Record<string, number>)["ambition"] ?? 0) * 3) : 0;
  let topBond = 0; for (const [k, v] of Object.entries(c.props)) if (k.startsWith("bond:") && typeof v === "number" && Math.abs(v as number) > Math.abs(topBond)) topBond = v as number;
  const av = typeof c.props["avenge"] === "string" ? "A" : "";
  const mood = c.narrativeStress > 0.7 ? "H" : c.narrativeStress < 0.3 ? "L" : "M";
  return `${String(c.props["innerDrive"] ?? "")}|${amb}|${topBond < 0 ? "-" : topBond > 0 ? "+" : "0"}|${c.progressionTier ?? ""}|${av}|${mood}`;
}
const F = (d: string): string => join(d, "minds.json");
const THRESHOLD = 2.5; // 累计卷入度破此阈才反思(对标 Smallville 150 的本系统标定; 一桩羁绊者陨落≈2.5 即触发)
const K_MAX = 8;       // 一次批量最多 K 人(控串味 + token)

export function loadMinds(d: string): MindsState {
  try { return existsSync(F(d)) ? { pendingImp: {}, lastReflectCh: 0, ...JSON.parse(readFileSync(F(d), "utf8")) } : { pendingImp: {}, lastReflectCh: 0 }; }
  catch { return { pendingImp: {}, lastReflectCh: 0 }; }
}
export function saveMinds(d: string, m: MindsState): void { try { writeFileSync(F(d), JSON.stringify(m), "utf8"); } catch { /* 非关键 */ } }

// ① importance 门控(零 LLM): 从新事件给被卷入角色累加卷入度。事件 kind → 该角色增量。
const KIND_IMP: Record<string, number> = { CharacterFell: 2.5, VengeanceResolved: 2.0, CharacterTranscended: 2.0, FactionDissolved: 1.5, FactionSplit: 1.8, ProgressionAdvanced: 1.2, StoryEventTriggered: 0.8, CharacterEntered: 0.6 };
export function accrueImportance(m: MindsState, events: Array<{ kind: string; payload: unknown }>, snapshot: WorldSnapshot): void {
  const bump = (id: string, v: number): void => { if (id && snapshot.characters[id]?.present) m.pendingImp[id] = (m.pendingImp[id] ?? 0) + v; };
  for (const e of events) {
    const inc = KIND_IMP[e.kind]; if (!inc) continue;
    const p = e.payload as Record<string, unknown>;
    const cid = typeof p["characterId"] === "string" ? (p["characterId"] as string) : "";
    if (cid) bump(cid, inc);
    // 大事/派系类: 波及在场同派系者(轻)
    if (e.kind === "StoryEventTriggered") for (const c of Object.values(snapshot.characters)) if (c.present) bump(c.id, 0.4);
    if (e.kind === "FactionDissolved" || e.kind === "FactionSplit") {
      const fac = typeof p["faction"] === "string" ? (p["faction"] as string) : "";
      if (fac) for (const c of Object.values(snapshot.characters)) if (c.present && c.props["faction"] === fac) bump(c.id, 0.8);
    }
    // 陨落: 与逝者羁绊深者额外受触(复仇前体)
    if (e.kind === "CharacterFell" && cid) for (const c of Object.values(snapshot.characters)) {
      if (!c.present) continue; const b = c.props[`bond:${cid}`]; if (typeof b === "number" && Math.abs(b) >= 2) bump(c.id, Math.min(2, Math.abs(b) / 2));
    }
  }
}

// ② 选队列: pending 破阈者, 取 top-K
export function selectQueue(m: MindsState, snapshot: WorldSnapshot): string[] {
  return Object.entries(m.pendingImp)
    .filter(([id, v]) => v >= THRESHOLD && snapshot.characters[id]?.present)
    .sort((a, b) => b[1] - a[1])
    .slice(0, K_MAX)
    .map(([id]) => id);
}

// ③ 批量反思: 一次 LLM 调用更新 K 人。每人编号独立小节防串味; 只回 JSON 数组。
export async function batchReflect(llm: LLMProvider, sys: string, snapshot: WorldSnapshot, ids: string[], worldCrisis: string, recentByChar: (c: CharacterState) => string): Promise<MindUpdate[]> {
  if (ids.length === 0) return [];
  const chars = ids.map((id) => snapshot.characters[id]).filter((c): c is CharacterState => !!c);
  const nameOf = (id: string): string => snapshot.characters[id]?.name ?? id;
  const block = chars.map((c, i) => {
    const bonds = Object.entries(c.props).filter(([k, v]) => k.startsWith("bond:") && typeof v === "number" && Math.abs(v as number) >= 2).slice(0, 3).map(([k, v]) => `${(v as number) > 0 ? "亲" : "怨"}${nameOf(k.slice(5))}`).join("、");
    const av = typeof c.props["avenge"] === "string" ? `，誓为「${String(c.props["avenge"])}」复仇` : "";
    const d = c.props["drives"]; const amb = d && typeof d === "object" ? (d as Record<string, number>)["ambition"] ?? 0 : 0;
    return `${i + 1}. ${c.name}（心境张力${c.narrativeStress.toFixed(1)}、执念${amb.toFixed(1)}${bonds ? "、" + bonds : ""}${av}）：近遭——${recentByChar(c)}`;
  }).join("\n");
  const raw = await llm.complete(
    `${sys}\n【世界当下】${worldCrisis.slice(0, 200)}\n下面 ${chars.length} 位角色各自刚经历了要紧的事。**逐个**给出每人此刻的一句内心独白或立场变化（须贴合其性情/恩怨/执念，≤30字，彼此不可雷同、不可串味）：\n${block}\n只回 JSON 数组，顺序对应编号：[{"i":序号,"mind":"一句内心/立场","stress":可选-0.2~0.2的心境微调}]`,
    { thinking: false, temperature: 0.8 },
  );
  let arr: Array<{ i?: number; mind?: string; stress?: number }>;
  try { arr = JSON.parse((raw.match(/\[[\s\S]*\]/) ?? ["[]"])[0]) as typeof arr; } catch { return []; }
  const out: MindUpdate[] = [];
  for (const o of arr) {
    const idx = typeof o.i === "number" ? o.i - 1 : -1;
    const c = idx >= 0 && idx < chars.length ? chars[idx] : undefined;
    if (c && typeof o.mind === "string" && o.mind.trim()) out.push({ id: c.id, mind: o.mind.trim().slice(0, 40), stress: typeof o.stress === "number" ? Math.max(-0.2, Math.min(0.2, o.stress)) : undefined });
  }
  return out;
}
