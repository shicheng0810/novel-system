// app/pack-select.ts — 按 NOVEL_PACK 选内容包 + 其叙事辅助。
//   (缺省) xianxia · modern · freeform(配置/提示词驱动的自由世界)。
// 引擎(core/)与本文件之外, 一行不改。
import xianxia, { natalLabel as xN, goalLabel as xG, describeMind as xM } from "../packs/xianxia-bazi/index";
import { plateLabel as xP } from "../packs/xianxia-bazi/qimen";
import modern, { natalLabel as mN, goalLabel as mG, describeMind as mM, plateLabel as mP } from "../packs/modern-city/index";
import freeform, { natalLabel as fN, goalLabel as fG, describeMind as fM, plateLabel as fP } from "../packs/freeform/index";
import type { CharacterState, WorldSnapshot } from "../core/domain/world";
import type { ContentPack } from "../core/domain/pack";

const W = process.env["NOVEL_PACK"];
function pick<T>(x: T, m: T, f: T): T {
  return W === "modern" ? m : W === "freeform" ? f : x;
}
export const PACK: ContentPack = pick(xianxia, modern, freeform);
export const natalLabel: (c: CharacterState) => string = pick(xN, mN, fN);
export const goalLabel: (c: CharacterState) => string = pick(xG, mG, fG);
export const describeMind: (c: CharacterState, s: WorldSnapshot) => string = pick(xM, mM, fM);
export const plateLabel: (tick: number) => string = pick(xP, mP, fP);
