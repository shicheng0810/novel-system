// tests/core/qimen-plate.test.ts — 先验深化②: 时家奇门真盘(节气定局/转盘九星八门八神)
// 守卫: 局随节气真变、值符值使来自旬首、吉凶门星神合参、且确定性可重放。
import { describe, it, expect } from "vitest";
import { castQimen, readOmen, qimenDate, qimenForecast } from "../../packs/xianxia-bazi/qimen";

describe("奇门真盘 (先验深化②)", () => {
  it("排局确定性: 同 tick → 同盘", () => {
    expect(JSON.stringify(castQimen(qimenDate(333)))).toBe(JSON.stringify(castQimen(qimenDate(333))));
  });

  it("局合法(1-9) + 阴阳遁 + 值符值使非空", () => {
    for (const t of [10, 120, 500, 1500]) {
      const p = castQimen(qimenDate(t));
      expect(p.ju).toBeGreaterThanOrEqual(1);
      expect(p.ju).toBeLessThanOrEqual(9);
      expect(["阳", "阴"]).toContain(p.dun);
      expect(p.dutyStar).toMatch(/^天/);
      expect(p.dutyGate).toMatch(/门$/);
    }
  });

  it("局随节气真变(非恒定)", () => {
    const states = new Set([20, 240, 500, 900, 1500].map((t) => { const p = castQimen(qimenDate(t)); return `${p.jieqi}:${p.ju}`; }));
    expect(states.size).toBeGreaterThanOrEqual(3);
  });

  it("吉凶合参: omen∈{吉,平,凶}, mult∈[0.5,1.6]", () => {
    for (const t of [60, 120, 500]) {
      const r = readOmen(castQimen(qimenDate(t)));
      expect(["吉", "平", "凶"]).toContain(r.omen);
      expect(r.mult).toBeGreaterThanOrEqual(0.5);
      expect(r.mult).toBeLessThanOrEqual(1.6);
    }
  });

  it("大事判语含局/值使/吉凶", () => {
    const f = qimenForecast(120);
    expect(f.line).toMatch(/遁.*局/);
    expect(f.line).toContain("值使");
    expect(["吉", "平", "凶"]).toContain(f.omen);
  });
});
