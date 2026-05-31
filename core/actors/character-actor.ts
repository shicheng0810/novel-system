// core/actors/character-actor.ts — 角色 agent。M1: reflect 接 LLM。(b)深化: 增加"与他人互动"候选。
// genre-free: reflect 提示词来自 pack.agentProfile; 亲疏(谁和谁结盟/道争)由 pack 的 prior 按生克打分决定。
import type { CharacterState, WorldSnapshot, CandidateAction } from "../domain/world";
import type { ContentPack } from "../domain/pack";
import type { StateDelta } from "../domain/events";
import type { LLMProvider } from "../services/llm";

function num(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

function genericPrompt(char: CharacterState, tick: number): string {
  return `角色「${char.name}」(阶=${char.progressionTier ?? "?"}, 张力=${char.narrativeStress.toFixed(2)})。第${tick}回合，用不超过20字写此刻心境与下一步意图，只回一句。`;
}

export interface CharacterTurn {
  reflection: string;
  candidates: CandidateAction[];
}

export async function reflectAndPlan(
  char: CharacterState,
  snapshot: WorldSnapshot,
  pack: ContentPack,
  llm: LLMProvider,
  rng: () => number
): Promise<CharacterTurn> {
  const tick = snapshot.tick;
  const prompt = pack.agentProfile?.reflectPrompt(char, tick) ?? genericPrompt(char, tick);
  const reflection = (await llm.complete(prompt)).replace(/\s+/g, " ").slice(0, 60);

  const acts = num(char.props["actCount"]);
  const jitter = rng();
  const base = `${char.id}-t${tick}`;
  const candidates: CandidateAction[] = [];

  // 独行候选: 进取 / 观望
  candidates.push({
    id: `${base}-act`,
    characterId: char.id,
    kind: "act",
    summary: `${char.name}独修精进：${reflection}`,
    axisHints: { initiative: 1, caution: -1 },
    payload: {
      deltas: [{ characterId: char.id, set: { actCount: acts + 1, narrativeStress: Math.min(1, char.narrativeStress + 0.08 + jitter * 0.04) }, note: "act" }] as StateDelta[],
      reflection,
    },
  });
  candidates.push({
    id: `${base}-obs`,
    characterId: char.id,
    kind: "observe",
    summary: `${char.name}观望蓄势`,
    axisHints: { initiative: -1, caution: 1 },
    payload: {
      deltas: [{ characterId: char.id, set: { narrativeStress: Math.max(0, char.narrativeStress - 0.05) } }] as StateDelta[],
      reflection,
    },
  });

  // 互动候选: 与最显著的在场他者(结善 / 道争)。亲疏由 prior 按生克打分; 此处只产候选(通用)。
  // 记忆驱动: 优先与"关系最深者"(最强恩怨/羁绊)互动, 而非字母序随机 → 历史塑造选择
  const other = Object.values(snapshot.characters)
    .filter((o) => o.present && o.id !== char.id)
    .sort((a, b) => {
      const ba = Math.abs(num(char.props[`bond:${a.id}`]));
      const bb = Math.abs(num(char.props[`bond:${b.id}`]));
      return bb !== ba ? bb - ba : a.id.localeCompare(b.id);
    })[0];
  if (other) {
    const bondK = `bond:${other.id}`;
    const yBondK = `bond:${char.id}`;
    const bond = num(char.props[bondK]);
    const yBond = num(other.props[yBondK]);
    candidates.push({
      id: `${base}-ally-${other.id}`,
      characterId: char.id,
      kind: "engage",
      summary: `${char.name}与${other.name}论道结善`,
      axisHints: { harmony: 1, discord: -1 },
      targetIds: [other.id],
      payload: {
        deltas: [
          { characterId: char.id, set: { narrativeStress: Math.max(0, char.narrativeStress - 0.05), [bondK]: bond + 1, actCount: acts + 1 } },
          { characterId: other.id, set: { narrativeStress: Math.max(0, other.narrativeStress - 0.05), [yBondK]: yBond + 1 } },
        ] as StateDelta[],
        reflection,
      },
    });
    candidates.push({
      id: `${base}-clash-${other.id}`,
      characterId: char.id,
      kind: "engage",
      summary: `${char.name}与${other.name}道争交锋`,
      axisHints: { discord: 1, harmony: -1 },
      targetIds: [other.id],
      payload: {
        deltas: [
          { characterId: char.id, set: { narrativeStress: Math.min(1, char.narrativeStress + 0.1), [bondK]: bond - 1, actCount: acts + 1 } },
          { characterId: other.id, set: { narrativeStress: Math.min(1, other.narrativeStress + 0.1), [yBondK]: yBond - 1 } },
        ] as StateDelta[],
        reflection,
      },
    });
    // 复仇候选: 痛失挚友者向在场他者问罪追杀(discord 权重高 → prior 更易选中, 章节自动生复仇线)
    const avenge = typeof char.props["avenge"] === "string" ? (char.props["avenge"] as string) : "";
    if (avenge) {
      candidates.push({
        id: `${base}-avenge-${other.id}`,
        characterId: char.id,
        kind: "engage",
        summary: `${char.name}为${avenge}复仇，向${other.name}问罪追杀`,
        axisHints: { discord: 1.5, harmony: -1, initiative: 1 },
        targetIds: [other.id],
        payload: {
          deltas: [
            { characterId: char.id, set: { narrativeStress: Math.min(1, char.narrativeStress + 0.12), [bondK]: bond - 2, actCount: acts + 1 } },
            { characterId: other.id, set: { narrativeStress: Math.min(1, other.narrativeStress + 0.15), [yBondK]: yBond - 2 } },
          ] as StateDelta[],
          reflection,
        },
      });
    }
  }

  // 移动候选: 前往另一处(世界扩张: 角色在更大地图上流动, 制造遭遇)
  const locIds = Object.keys(snapshot.locations).filter((l) => l !== char.locationId);
  if (locIds.length > 0) {
    // 经济驱动: 趋向产出(yield)最盛处(取前二随机, 免全挤一处) → 富庶之地起争夺
    const yieldOf = (l: string): number => (typeof snapshot.locations[l]?.props["yield"] === "number" ? (snapshot.locations[l]!.props["yield"] as number) : 0.3);
    const ranked = locIds.slice().sort((a, b) => (yieldOf(b) !== yieldOf(a) ? yieldOf(b) - yieldOf(a) : a.localeCompare(b)));
    const dest = ranked[Math.floor(rng() * Math.min(2, ranked.length))]!;
    candidates.push({
      id: `${base}-move`,
      characterId: char.id,
      kind: "move",
      summary: `${char.name}转往${snapshot.locations[dest]?.name ?? dest}`,
      axisHints: { initiative: 0.4 },
      payload: { deltas: [{ characterId: char.id, set: { locationId: dest } }] as StateDelta[], reflection },
    });
  }

  return { reflection, candidates };
}
