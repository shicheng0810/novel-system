// app/gentle-emergence.ts — 涌现际遇摄入(T2' 情节维): 从 newEvs 抽【带新颖闸的结构事实】,
//   渲染成温润"近来世间"一句供 weave 注入。吸收批评: 不渲染原始 summary(防注入"与虚谷"重复向量),
//   不含 Fell/Transcended(守 gentle-director 铁律), 只取首次结识/faction首现/tier跨越/移动遭遇。
// 纯 app、纯符号、零 LLM、resume 安全(新颖闸由 longrun 主循环持有的 seen 集合实现)。爽文不调用(GENTLE-gated)。
import type { WorldEventRecord } from "../core/domain/events";
import type { WorldSnapshot } from "../core/domain/world";

export interface EmergeDigest { newcomers: string[]; firstBonds: string[]; advances: string[]; arrivals: string[]; any: boolean }

// seenFactions/seenPairs: 跨章累积状态(longrun 主循环持有, 传入), 实现"首次"闸。
export function gentleEmergence(
  newEvs: WorldEventRecord[], snap: WorldSnapshot,
  seenFactions: Set<string>, seenPairs: Set<string>,
): EmergeDigest {
  const newcomers: string[] = [], firstBonds: string[] = [], advances: string[] = [], arrivals: string[] = [];
  for (const e of newEvs) {
    if (e.kind === "CharacterEntered") {
      const p = e.payload as { name?: string; faction?: string };
      // 新颖闸: 仅当 faction 此前未见(首现) → 才算"新世态", 否则跳过(防"又一个某派的人")
      if (p.faction && !seenFactions.has(p.faction)) { newcomers.push(p.faction); seenFactions.add(p.faction); }
    } else if (e.kind === "StageCommitted") {
      const id = (e.payload as { chosenCandidateId?: string }).chosenCandidateId ?? "";
      const m = id.match(/^(\w+)-ally-(\w+)$/);
      if (m) { // 新颖闸: 仅"首次结识"的对子才入(关系对此前未出现)
        const pair = [m[1], m[2]].sort().join("~");
        if (!seenPairs.has(pair)) {
          seenPairs.add(pair);
          const a = snap.characters[m[1]!]?.name, b = snap.characters[m[2]!]?.name;
          if (a && b) firstBonds.push(`${a}与${b}`); // 只给"谁与谁初识", 措辞留给 LLM
        }
      } else if (/-move\b/.test(id)) { // S2 启用后 move 才有事件; 移动=遭遇契机(非作别/非兴亡)
        const a = (e.payload as { summary?: string }).summary ?? "";
        if (a) arrivals.push(a.replace(/^.*转往/, "有人正动身前往")); // 去人名, 只留"有人远行"
      }
    } else if (e.kind === "ProgressionAdvanced") {
      const p = e.payload as { characterId?: string; toTier?: string };
      const nm = p.characterId ? snap.characters[p.characterId]?.name : undefined;
      if (nm) advances.push(`${nm}近来心境/道行有所长进`); // tier 跨越=真处境变化
    }
    // ❌ 绝不取 CharacterFell/CharacterTranscended/avenge/clash(守 T2 铁律, 不引戏剧)
  }
  const uniq = (a: string[], n: number) => [...new Set(a)].slice(-n);
  const d = { newcomers: uniq(newcomers, 2), firstBonds: uniq(firstBonds, 2), advances: uniq(advances, 2), arrivals: uniq(arrivals, 1) };
  return { ...d, any: d.newcomers.length + d.firstBonds.length + d.advances.length + d.arrivals.length > 0 };
}

// 渲染: 邀请式、温润、只陈述"世间冒出这些", 不指令"必写谁"(吸收批评④)。
export function renderEmergence(d: EmergeDigest): string {
  if (!d.any) return "";
  const parts: string[] = [];
  if (d.newcomers.length) parts.push(`近来这一带似有${d.newcomers.join("、")}的人往来`);
  if (d.firstBonds.length) parts.push(`${d.firstBonds.join("、")}初初相识`);
  if (d.arrivals.length) parts.push(d.arrivals.join("、"));
  if (d.advances.length) parts.push(d.advances.join("、"));
  return parts.join("；") + "。";
}
