import { describe, expect, test } from "vitest";

import { sanitizeProse } from "../../src/v3/verify/slop";

describe("v3 verify slop", () => {
  test("clean prose returns no issues and slopScore 0", () => {
    const text = "林焰把佩剑横在身侧，望着对岸的丹谷。雾气未散，他没有再开口。";
    const report = sanitizeProse(text);
    expect(report.issues).toHaveLength(0);
    expect(report.slopScore).toBe(0);
  });

  test("simile-heavy prose triggers warning above density threshold", () => {
    const text = "他如同孤雁，宛如游魂，仿佛断弦，犹如残烛，好似落叶。如同野兽，宛如风雪。";
    const report = sanitizeProse(text);
    const simile = report.issues.find((i) => i.category === "simile-overuse");
    expect(simile).toBeTruthy();
    expect(simile?.severity).toBe("warning");
  });

  test("stock imagery is flagged", () => {
    const text = "血色残阳里，他眼神深邃。嘴角勾起一丝弧度，翻涌的杀意冷冽的气息。";
    const report = sanitizeProse(text);
    expect(report.issues.some((i) => i.category === "stock-imagery" && i.severity === "warning")).toBe(true);
  });

  test("repeated 4-char idioms get flagged", () => {
    const text = "义无反顾。义无反顾。义无反顾。义无反顾。然后，义无反顾。";
    const report = sanitizeProse(text);
    expect(report.issues.some((i) => i.category === "repeated-idiom")).toBe(true);
  });

  test("slopScore caps at 10", () => {
    const text = "如同".repeat(50) + "血色残阳".repeat(20) + "缓缓地".repeat(30) + "！".repeat(40);
    const report = sanitizeProse(text);
    expect(report.slopScore).toBeLessThanOrEqual(10);
  });
});
