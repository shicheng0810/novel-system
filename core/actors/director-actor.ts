// core/actors/director-actor.ts — 最小导演(M0: arc + focus + tension, 无 beat/无 compose)
// 状态进 checkpoint(修旧系统"director 状态不持久, 重启空状态导演"的 bug)。
import type { WorldSnapshot, CharacterId } from "../domain/world";

export interface DirectorState {
  tension: number;
  arcPhase: string;
  focus: CharacterId[];
  tickCount: number;
}

export interface DirectorPlan {
  arcPhase: string;
  tension: number;
  focus: CharacterId[];
  compose: boolean;
}

export function initialDirectorState(): DirectorState {
  return { tension: 0.3, arcPhase: "exposition", focus: [], tickCount: 0 };
}

export function planDirector(state: DirectorState, snapshot: WorldSnapshot): { plan: DirectorPlan; next: DirectorState } {
  const tickCount = state.tickCount + 1;
  const arcPhase = tickCount < 8 ? "exposition" : tickCount < 20 ? "rising" : tickCount < 26 ? "climax" : "falling";
  const tension = Math.min(1, 0.3 + tickCount * 0.02);
  const order = Object.values(snapshot.characters)
    .filter((c) => c.present)
    .map((c) => c.id);
  // focus 轮转: 默认 round-robin(30 tick 内所有角色都演到); 但戏剧导演可经 props.dramaFocus(通用 id 列表)
  // 半数 tick 优先聚焦"半成形故事链"的角色(Awash 顺水推舟), 另半数仍轮转保群像不偏废。引擎中立: 只读 id 列表。
  const dramaFocus = (Array.isArray(snapshot.props["dramaFocus"]) ? (snapshot.props["dramaFocus"] as string[]) : []).filter((id) => order.includes(id));
  const focus = order.length === 0 ? []
    : dramaFocus.length > 0 && state.tickCount % 2 === 0 ? [dramaFocus[Math.floor(state.tickCount / 2) % dramaFocus.length]!]
    : [order[state.tickCount % order.length]!];
  const compose = snapshot.props["autoCompose"] === false ? false : tickCount % 10 === 0; // M2: 每 10 tick 出一章; longrun 关掉自管
  return { plan: { arcPhase, tension, focus, compose }, next: { tension, arcPhase, focus, tickCount } };
}
