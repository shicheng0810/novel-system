// tests/core/bazi-natal.test.ts — 先验深化①: 八字真盘(四柱+十神→命格)确定性 + 驱动性情
// 核心命题守卫: 角色行动应由"真排盘的命格"驱动, 而非全员兜底成同一格局。
import { describe, it, expect } from "vitest";
import { xianxiaBaziPack, natalLabel } from "../../packs/xianxia-bazi/index";

function seed(s: string) {
  return xianxiaBaziPack.seedWorld({ worldId: "t", packId: xianxiaBaziPack.id, seed: s, config: {} });
}

describe("八字真盘命格 (先验深化①)", () => {
  it("四主角各有命格标签(日主五行·格局), 性情轴为数值", () => {
    const protags = Object.values(seed("natal-A").characters).filter((c) => c.id.startsWith("c"));
    expect(protags.length).toBe(4);
    for (const c of protags) {
      expect(natalLabel(c)).toMatch(/^.+·.+$/); // e.g. "丙火·正官格"
      expect(typeof c.traits["initiative"]).toBe("number");
      expect(typeof c.traits["caution"]).toBe("number");
    }
  });

  it("命格确定性: 同种子 → 同命格", () => {
    const la = Object.values(seed("natal-A").characters).map(natalLabel).join("|");
    const lb = Object.values(seed("natal-A").characters).map(natalLabel).join("|");
    expect(la).toBe(lb);
  });

  it("命格多样: 四主角格局不止一种(证明真排盘、非全员兜底)", () => {
    const patterns = new Set(
      Object.values(seed("natal-A").characters)
        .filter((c) => c.id.startsWith("c"))
        .map((c) => natalLabel(c).split("·")[1]),
    );
    expect(patterns.size).toBeGreaterThanOrEqual(2);
  });

  it("命格驱动 buildFrame: 产出 targeted 的 bazi-pattern 性情影响力", () => {
    const frame = xianxiaBaziPack.priorSystem!.buildFrame({ snapshot: seed("natal-A"), tick: 1 });
    const pat = frame.influences.filter((i) => i.source === "bazi-pattern");
    expect(pat.length).toBeGreaterThan(0);
    expect(pat.every((i) => i.scope === "targeted" && !!i.targetId)).toBe(true);
  });
});
