// app/drama.ts — T4 混沌边缘控制器 + 戏剧导演(app 层, 纯符号无 LLM, 每章跑一次)。
//  · 临界控制器(借 自组织临界 / Langton λ): 监控近窗「兴亡事件密度」与张力, 太冷→在进化 baseline 上加注大事/冲突/结构生长;
//    太热(滥杀/人口告急)→收敛 + 压代谢。让世界长期停在「丰富但不崩」的混沌边缘。
//  · 戏剧导演(借 Façade 张力弧 + RimWorld Cassandra + Awash): 张力低时「顺水推舟」推进半成形的故事链(聚焦未了的复仇者,
//    让其恩怨收束), 而非凭空砸大事(防 Randy-Random 廉价刺激、读者麻木)。
//  · 闭环 self-limiting: 干预幅度随 coldStreak 增长但封顶 0.6; 张力一回升 cold 即 false → 干预自动退出。
//  core/ 不涉; 只往 props.tuning / props.dramaFocus 写通用值, 引擎按既有钩子消费。
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { WorldEventRecord } from "../core/domain/events";
import type { WorldSnapshot } from "../core/domain/world";
import type { EngineGenes } from "./evolve";
import type { SimFitness } from "./sim-fitness";

export interface DramaCtrl { coldStreak: number; hotStreak: number; lastTension: number }
const D_FILE = (d: string): string => join(d, "drama.json");
export function loadDrama(d: string): DramaCtrl {
  try { return existsSync(D_FILE(d)) ? { coldStreak: 0, hotStreak: 0, lastTension: 5, ...JSON.parse(readFileSync(D_FILE(d), "utf8")) } : { coldStreak: 0, hotStreak: 0, lastTension: 5 }; }
  catch { return { coldStreak: 0, hotStreak: 0, lastTension: 5 }; }
}
export function saveDrama(d: string, c: DramaCtrl): void { try { writeFileSync(D_FILE(d), JSON.stringify(c)); } catch { /* 非关键 */ } }

export interface DramaOut { tuning: EngineGenes; dramaFocus: string[]; dramaHint: string; ctrl: DramaCtrl; log: string }

export function dramaControl(events: WorldEventRecord[], snapshot: WorldSnapshot, sf: SimFitness | null, base: EngineGenes, ctrl: DramaCtrl, gentle = false): DramaOut {
  const present = Object.values(snapshot.characters).filter((c) => c.present);
  const maxTick = events.reduce((m, e) => Math.max(m, e.tick ?? 0), 1);
  const recent = events.filter((e) => (e.tick ?? 0) >= maxTick - 18);
  const upheaval = recent.filter((e) => /Fell|Dissolved|Split|StoryEvent/.test(e.kind)).length;
  const facChange = recent.filter((e) => /Dissolved|Split/.test(e.kind)).length;
  const tension = sf?.tension.score ?? 5;
  const sift = sf?.sift.score ?? 5;
  const FLOOR = 10;

  // 临界判定: 冷(太平淡/戏链枯) vs 热(滥杀/人口告急)
  const cold = (upheaval <= 1 && tension < 4.5) || sift < 3.5;
  const hot = upheaval >= 6 || present.length <= 5;
  let coldStreak = ctrl.coldStreak, hotStreak = ctrl.hotStreak;
  if (cold && !hot) { coldStreak = Math.min(6, coldStreak + 1); hotStreak = 0; }
  else if (hot) { hotStreak = Math.min(6, hotStreak + 1); coldStreak = 0; }
  else { coldStreak = Math.max(0, coldStreak - 1); hotStreak = Math.max(0, hotStreak - 1); }
  const heat = gentle ? 0 : Math.min(0.6, coldStreak * 0.15); // 冷→加注(封顶0.6 防廉价刺激); 温情向: 冷=健康态、不加注(评审逮的第五梯度——否则导演每章 ×1.36 顶高 conflictRate、绕过 genome 锚)
  const chill = Math.min(0.5, hotStreak * 0.18); // 热→收敛

  const tuning: EngineGenes = { ...base };
  tuning.eventBias = +Math.max(0.4, base.eventBias * (1 + heat - chill)).toFixed(2);
  tuning.conflictRate = +Math.max(0.5, base.conflictRate * (1 + heat * 0.6 - chill * 0.7)).toFixed(2);
  if (!gentle && coldStreak >= 2 && facChange === 0) tuning.structureGrowth = +Math.min(1, base.structureGrowth + 0.3 + heat * 0.3).toFixed(2); // 太静(版图无变动)→挑起派系分裂(温情向不挑裂、由它静着)
  if (present.length < FLOOR) tuning.turnoverRate = +Math.min(base.turnoverRate, 0.6).toFixed(2); // 人口告急→压折损留住人

  // 戏剧导演: 顺水推舟未了的故事链(聚焦未了复仇者 → director 优先让其登场, 推动恩怨收束)
  const danglers = present.filter((c) => typeof c.props["avenge"] === "string");
  const dramaFocus = danglers.slice(0, 3).map((c) => c.id);
  const dramaHint = heat > 0 && danglers.length
    ? `顺势推进悬而未决的恩怨：${danglers.slice(0, 2).map((c) => `${c.name}誓为「${String(c.props["avenge"])}」复仇`).join("；")}`
    : "";

  const evMult = (x: number, b: number): string => (Math.max(0.01, b) ? (x / Math.max(0.01, b)).toFixed(2) : "1");
  const log = `${cold ? "❄冷" : hot ? "🔥热" : "≈临界"}(兴亡${upheaval}/张力${tension}/戏链${sift}/在场${present.length}) → 大事×${evMult(tuning.eventBias, base.eventBias)} 冲突×${evMult(tuning.conflictRate, base.conflictRate)}${tuning.structureGrowth > base.structureGrowth ? " 挑裂" : ""}${tuning.turnoverRate < base.turnoverRate ? " 护盘" : ""}${dramaFocus.length ? ` 聚焦未了×${dramaFocus.length}` : ""}`;
  return { tuning, dramaFocus, dramaHint, ctrl: { coldStreak, hotStreak, lastTension: tension }, log };
}
