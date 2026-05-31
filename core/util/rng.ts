// core/util/rng.ts — 确定性哈希 + 种子 PRNG(保证同 seed → 同世界, 支持重放/测试)
export function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function (): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 由若干部件拼出确定性 RNG(如 worldId|"agent"|tick|charId)
export function rngFor(...parts: Array<string | number>): () => number {
  return mulberry32(hashStr(parts.join("|")));
}
