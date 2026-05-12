import { describe, expect, test } from "vitest";

import {
  computeBazi,
  fateFromBazi,
  parsePillars,
} from "../src/metaphysics/bazi";

describe("v3 bazi", () => {
  test("computeBazi via lunar-javascript returns 4 valid pillars", () => {
    const chart = computeBazi({ year: 1996, month: 4, day: 12, hour: 10 });
    expect(chart.pillars).toHaveLength(4);
    for (const pillar of chart.pillars) {
      expect(pillar.stem).toMatch(/[甲乙丙丁戊己庚辛壬癸]/);
      expect(pillar.branch).toMatch(/[子丑寅卯辰巳午未申酉戌亥]/);
    }
    expect(chart.dominantElements.length).toBeGreaterThan(0);
  });

  test("parsePillars handles user-supplied pillar strings", () => {
    const chart = parsePillars("辛巳,癸酉,己亥,乙丑");
    expect(chart.pillars[0]).toEqual({ stem: "辛", branch: "巳" });
    expect(chart.pillars[2]).toEqual({ stem: "己", branch: "亥" });
  });

  test("parsePillars pads missing pillars with 甲子", () => {
    const chart = parsePillars("辛巳");
    expect(chart.pillars).toHaveLength(4);
    expect(chart.pillars[3]).toEqual({ stem: "甲", branch: "子" });
  });

  test("fateFromBazi maps fire-dominant chart to 先燃后断 temperament", () => {
    const fire = parsePillars("丙午,丙午,丁巳,丁未");
    const fate = fateFromBazi("c1", fire, "bazi");
    expect(fate.dominantElements).toContain("火");
    expect(fate.temperament).toBe("先燃后断");
    expect(fate.initiative).toBeGreaterThanOrEqual(7);
  });

  test("fateFromBazi maps water+metal chart to 藏锋待时 temperament", () => {
    const chart = parsePillars("辛酉,癸亥,壬申,辛丑");
    const fate = fateFromBazi("c2", chart, "bazi");
    expect(fate.dominantElements.some((e) => e === "水" || e === "金")).toBe(true);
    expect(["藏锋待时", "守局观变"]).toContain(fate.temperament);
  });
});
