// app/sim-rules.ts — T5 模拟器自创机制。让 LLM 提议「全新的世界机制」(不止调数值), 经三道闸自动准入:
//   ① 静态自洽闸: 触发 metric 必在白名单、效果数值钳死、schema 完整(铁律硬约束: 不能直接杀人/瞬间进阶, schema 本就不给这些口子)。
//   ② 新颖闸: 与已准入机制去重(同 metric+op 不重复堆叠)。
//   ③ 影子模拟闸(借 OMNI-EPIC/POET MCC): 把候选机制注入当前世界的克隆, 用 MockLLM 空跑 N tick —— 不崩、人口不坍、派系不爆炸才准入。
// 准入的机制以通用数据挂进 props.simRules, 由 core/world-actor 的 simRuleStoryEvent 按通用 metric/effect 解释触发(零 genre 语义)。
// 镜像 constraints.ts 的提议→准入流程, 但作用在「模拟层」而非「作者层」, 且闸门是自动影子模拟(非人工议事)。core/ 不涉。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { openDb } from "../core/services/db";
import { MockLLM, type LLMProvider } from "../core/services/llm";
import * as store from "../core/services/store";
import { step } from "../core/runtime/world-actor";
import type { ContentPack } from "../core/domain/pack";
import type { WorldSnapshot } from "../core/domain/world";

const METRICS = ["avgStress", "presentCount", "factionCount", "avengerCount", "maxHostility"] as const;
type Metric = (typeof METRICS)[number];
export interface SimRule {
  id: string;
  name: string;
  trigger: { metric: Metric; op: ">" | "<"; value: number };
  cooldown: number;
  event: { summary: string; crisis?: string; stressDelta?: number; gatherAt?: string; factionShifts?: Array<{ a: string; b: string; delta: number }>; valence?: number };
  rationale: string;
  atVol: number;
  lastFired?: number;
}
export interface SimRules { active: SimRule[]; generation: number; rejected: Array<{ name: string; reason: string; atVol: number }> }
const SR_FILE = (d: string): string => join(d, "sim-rules.json");
const CAP = 6; // 同时启用的进化机制上限(防机制爆炸)

export function loadSimRules(d: string): SimRules {
  try { return existsSync(SR_FILE(d)) ? { active: [], generation: 0, rejected: [], ...JSON.parse(readFileSync(SR_FILE(d), "utf8")) } : { active: [], generation: 0, rejected: [] }; }
  catch { return { active: [], generation: 0, rejected: [] }; }
}
export function saveSimRules(d: string, r: SimRules): void { try { writeFileSync(SR_FILE(d), JSON.stringify(r, null, 2), "utf8"); } catch { /* 非关键 */ } }

// ── ① 静态自洽闸: 解析+校验+钳死 → 规范化 SimRule(或 null) ──
function validateSimRule(j: Record<string, unknown>, vol: number, idSuffix: string): SimRule | null {
  const name = typeof j["name"] === "string" ? (j["name"] as string).slice(0, 12) : "";
  const trig = j["trigger"] as Record<string, unknown> | undefined;
  const ev = j["event"] as Record<string, unknown> | undefined;
  if (!name || !trig || !ev) return null;
  const metric = trig["metric"];
  if (typeof metric !== "string" || !METRICS.includes(metric as Metric)) return null;
  const op = trig["op"] === "<" ? "<" : trig["op"] === ">" ? ">" : null;
  if (!op) return null;
  const value = typeof trig["value"] === "number" && Number.isFinite(trig["value"]) ? (trig["value"] as number) : null;
  if (value === null) return null;
  const cooldown = Math.max(20, Math.min(60, typeof j["cooldown"] === "number" ? Math.floor(j["cooldown"] as number) : 30));
  const summary = typeof ev["summary"] === "string" ? (ev["summary"] as string).slice(0, 80) : "";
  if (!summary) return null;
  const shiftsRaw = Array.isArray(ev["factionShifts"]) ? (ev["factionShifts"] as unknown[]) : [];
  const factionShifts = shiftsRaw
    .map((s) => s as Record<string, unknown>)
    .filter((s) => typeof s["a"] === "string" && typeof s["b"] === "string" && typeof s["delta"] === "number")
    .map((s) => ({ a: s["a"] as string, b: s["b"] as string, delta: Math.max(-3, Math.min(3, s["delta"] as number)) }))
    .slice(0, 4);
  return {
    id: `r${vol}-${idSuffix}`,
    name,
    trigger: { metric: metric as Metric, op, value },
    cooldown,
    event: {
      summary,
      crisis: typeof ev["crisis"] === "string" ? (ev["crisis"] as string).slice(0, 100) : undefined,
      stressDelta: typeof ev["stressDelta"] === "number" ? Math.max(-0.4, Math.min(0.4, ev["stressDelta"] as number)) : undefined,
      gatherAt: typeof ev["gatherAt"] === "string" ? (ev["gatherAt"] as string) : undefined,
      factionShifts: factionShifts.length ? factionShifts : undefined,
      valence: typeof ev["valence"] === "number" ? Math.max(-1, Math.min(1, ev["valence"] as number)) : 0,
    },
    rationale: typeof j["rationale"] === "string" ? (j["rationale"] as string).slice(0, 140) : "",
    atVol: vol,
  };
}

// ── ② 新颖闸: 同 metric+op 不重复堆叠; 名字不雷同 ──
function noveltyOk(rule: SimRule, active: SimRule[]): boolean {
  for (const a of active) {
    if (a.trigger.metric === rule.trigger.metric && a.trigger.op === rule.trigger.op) return false;
    if (a.name === rule.name) return false;
  }
  return true;
}

// ── ③ 影子模拟闸: 注入候选机制到当前世界克隆, 空跑 N tick, 看是否不崩/人口不坍/派系不爆炸(MCC) ──
export async function shadowSim(snapshot: WorldSnapshot, rule: SimRule, pack: ContentPack, ticks = 30): Promise<{ pass: boolean; fires: number; presentStart: number; presentEnd: number; facStart: number; facEnd: number; crashed: boolean }> {
  const db = openDb(":memory:");
  const wid = "shadow";
  const snap = JSON.parse(JSON.stringify(snapshot)) as WorldSnapshot;
  snap.worldId = wid;
  snap.props["simRules"] = [{ ...rule, lastFired: -99999 }]; // 隔离: 只测这一条候选
  const presentOf = (s: WorldSnapshot): number => Object.values(s.characters).filter((c) => c.present).length;
  const facOf = (s: WorldSnapshot): number => new Set(Object.values(s.characters).filter((c) => c.present).map((c) => String(c.props["faction"] ?? "")).filter(Boolean)).size;
  const presentStart = presentOf(snap), facStart = facOf(snap);
  const startTick = typeof snap.tick === "number" ? snap.tick : 0;
  store.saveSnapshot(db, wid, snap, 0, Date.now());
  store.setSchedulerState(db, wid, { gen: 0, nextTick: startTick, status: "running" }, Date.now());
  const mock = new MockLLM();
  let crashed = false;
  try { for (let t = 0; t < ticks; t++) await step(db, wid, pack, mock); } catch { crashed = true; }
  const after = store.loadSnapshot(db, wid);
  const events = store.readEvents(db, wid);
  const fires = events.filter((e) => e.kind === "StoryEventTriggered" && /simrule-/.test(String((e.payload as { eventId?: string }).eventId ?? ""))).length;
  const presentEnd = after ? presentOf(after.snapshot) : 0;
  const facEnd = after ? facOf(after.snapshot) : 0;
  const pass = !crashed && presentEnd >= 3 && facEnd <= facStart + 5; // 不崩 + 人口不坍 + 派系不爆炸
  return { pass, fires, presentStart, presentEnd, facStart, facEnd, crashed };
}

// ── 提议(LLM) ──
async function proposeSimRule(llm: LLMProvider, sys: string, recent: string, vol: number, active: SimRule[], idSuffix: string): Promise<SimRule | null> {
  const have = active.map((r) => `${r.name}(当${r.trigger.metric}${r.trigger.op}${r.trigger.value})`).join("、") || "无";
  const raw = await llm.complete(
    `${sys}\n你在为这个「小说世界模拟器」**发明一条全新的世界机制**(不是调数值, 是新玩法)——一个由世界状态触发、改变局面的规律。已有机制：${have}。\n近期世界梗概：${recent.slice(0, 500)}\n\n机制由「触发条件(读一个世界指标)+ 触发后的大事效果」构成。只能读这些指标：\n· avgStress(在场角色平均心境张力 0~1) · presentCount(在场人数) · factionCount(在场派系数) · avengerCount(怀复仇心的人数) · maxHostility(最敌对两派的交恶度 0~9)\n要新颖(别和已有机制同指标)、能自洽落地、且不会把世界写崩。只回 JSON：\n{"name":"机制名≤8字","trigger":{"metric":"上面之一","op":">"或"<","value":数},"cooldown":两次触发最小间隔tick(20~60),"event":{"summary":"触发时的大事描述(一句)","crisis":"设为世界危机的一句话","stressDelta":对在场张力的增减(-0.4~0.4),"factionShifts":[{"a":"派系名","b":"派系名","delta":关系增减(-3~3)}],"valence":大事吉凶倾向(-1到1, 正=机缘/好兆, 负=折损/凶兆, 0=中性)},"rationale":"这机制能涌现出什么现有大事覆盖不了的新局面(一句)"}`,
    { thinking: false, temperature: 0.95 },
  );
  let j: Record<string, unknown>;
  try { j = JSON.parse((raw.match(/\{[\s\S]*\}/) ?? ["{}"])[0]) as Record<string, unknown>; } catch { return null; }
  return validateSimRule(j, vol, idSuffix);
}

// ── 编排: 提议 → 静态闸 → 新颖闸 → 影子模拟闸 → 准入 ──
export async function evolveSimRules(llm: LLMProvider, sys: string, dir: string, snapshot: WorldSnapshot, pack: ContentPack, recent: string, vol: number): Promise<{ admitted?: SimRule; report: string }> {
  const sr = loadSimRules(dir);
  if (sr.active.length >= CAP) return { report: `模拟机制已达上限 ${CAP} 条, 暂不提议` };
  const rule = await proposeSimRule(llm, sys, recent, vol, sr.active, String(sr.generation + 1));
  if (!rule) return { report: "机制提议未通过静态自洽闸(schema/白名单不符)" };
  if (!noveltyOk(rule, sr.active)) { sr.rejected.push({ name: rule.name, reason: "与已有机制同触发指标(新颖闸)", atVol: vol }); saveSimRules(dir, sr); return { report: `机制「${rule.name}」撞车既有触发指标, 弃(新颖闸)` }; }
  const sim = await shadowSim(snapshot, rule, pack);
  if (!sim.pass) {
    sr.rejected.push({ name: rule.name, reason: `影子模拟闸: ${sim.crashed ? "空跑崩溃" : `人口${sim.presentStart}→${sim.presentEnd}/派系${sim.facStart}→${sim.facEnd}`}`, atVol: vol });
    saveSimRules(dir, sr);
    return { report: `机制「${rule.name}」未过影子模拟闸(${sim.crashed ? "崩溃" : `人口${sim.presentStart}→${sim.presentEnd} 派系${sim.facStart}→${sim.facEnd}`})` };
  }
  sr.active.push(rule); sr.generation += 1; saveSimRules(dir, sr);
  return { admitted: rule, report: `✓机制「${rule.name}」准入(当${rule.trigger.metric}${rule.trigger.op}${rule.trigger.value}→${rule.event.summary.slice(0, 24)}；影子模拟${sim.fires}次触发·人口${sim.presentStart}→${sim.presentEnd}·派系${sim.facStart}→${sim.facEnd})——${rule.rationale}` };
}
