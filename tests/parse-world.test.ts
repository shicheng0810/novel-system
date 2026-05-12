import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { parseWorldMarkdown } from "../src/domain/parse-world";

const SAMPLE_PATH = fileURLToPath(new URL("../examples/sample-world.md", import.meta.url));

describe("parseWorldMarkdown · examples/sample-world.md", () => {
  const md = readFileSync(SAMPLE_PATH, "utf8");
  const parsed = parseWorldMarkdown(md);

  test("worldSpec basics", () => {
    expect(parsed.worldSpec.genre).toBe("东方玄幻/修仙");
    expect(parsed.worldSpec.timeScale).toBe("阶段");
    expect(parsed.worldSpec.cultivationSystem).toBe("灵海、化罡、真传");
    expect(parsed.worldSpec.worldRules.length).toBeGreaterThanOrEqual(2);
    expect(parsed.worldSpec.worldRules[0]).toMatch(/玄脉共鸣/);
  });

  test("factions + locations parsed", () => {
    expect(parsed.worldSpec.factions).toHaveLength(2);
    expect(parsed.worldSpec.factions[0].name).toBe("青岳宗");
    expect(parsed.worldSpec.factions[0].description).toContain("名门正宗");
    expect(parsed.worldSpec.locations).toHaveLength(2);
    expect(parsed.worldSpec.locations[1].name).toBe("地火丹谷");
  });

  test("characters parsed with KV + traits split", () => {
    expect(parsed.characters).toHaveLength(3);
    const lin = parsed.characters.find((c) => c.id === "林焰");
    expect(lin).toBeTruthy();
    expect(lin!.faction).toBe("青岳宗");
    expect(lin!.traits).toEqual(["倔强", "护短", "求突破"]);
    expect(lin!.goal).toBe("拿到真传名额");

    const su = parsed.characters.find((c) => c.id === "苏雪");
    expect(su!.baziRaw).toBe("辛巳,癸酉,己亥,乙丑");

    const han = parsed.characters.find((c) => c.id === "韩渡");
    expect(han!.archetypeDraft).toContain("水金偏旺");
  });

  test("relationships parsed (id = left-right)", () => {
    expect(parsed.relationships).toHaveLength(3);
    const linSu = parsed.relationships.find((r) => r.id === "林焰-苏雪");
    expect(linSu).toBeTruthy();
    expect(linSu!.status).toBe("盟友");
    expect(linSu!.tension).toContain("信任下的压抑");
  });

  test("characterAnchors accept both must_trend and mustTrend casings", () => {
    expect(parsed.characterAnchors).toHaveLength(3);
    const lin = parsed.characterAnchors.find((a) => a.characterId === "林焰");
    expect(lin!.cannot).toBe("提前死亡");
    expect(lin!.mustTrend).toBe("在压力中成长"); // came in as must_trend
    expect(lin!.stageGoal).toBe("接近真传名额");  // came in as stage_goal
  });

  test("relationshipAnchors parsed", () => {
    expect(parsed.relationshipAnchors).toHaveLength(3);
    const linSu = parsed.relationshipAnchors.find((a) => a.relationshipId === "林焰-苏雪");
    expect(linSu!.boundary).toContain("不能无因反目");
    expect(linSu!.trend).toContain("盟友走向紧绷");
  });
});

describe("parseWorldMarkdown · edge cases", () => {
  test("empty input → empty spec", () => {
    const parsed = parseWorldMarkdown("");
    expect(parsed.characters).toEqual([]);
    expect(parsed.worldSpec.genre).toBe("");
  });

  test("only headings → empty arrays", () => {
    const parsed = parseWorldMarkdown("# 世界设定\n# 角色\n# 关系\n");
    expect(parsed.characters).toEqual([]);
    expect(parsed.relationships).toEqual([]);
  });

  test("camelCase anchor keys still work", () => {
    const md = `# 单角色锚点\n- 林焰 | cannot=x | mustTrend=y | stageGoal=z\n`;
    const parsed = parseWorldMarkdown(md);
    expect(parsed.characterAnchors[0].mustTrend).toBe("y");
    expect(parsed.characterAnchors[0].stageGoal).toBe("z");
  });

  test("traits accept full-width comma", () => {
    const md = `# 角色\n- 甲 | traits=A，B，C | faction=宗 | role=r | goal=g | stance=s | resource=res\n`;
    const parsed = parseWorldMarkdown(md);
    expect(parsed.characters[0].traits).toEqual(["A", "B", "C"]);
  });

  test("relationship line without status keys still produces row", () => {
    const md = `# 关系\n- 甲 <-> 乙 | status=盟友\n`;
    const parsed = parseWorldMarkdown(md);
    expect(parsed.relationships[0].id).toBe("甲-乙");
    expect(parsed.relationships[0].status).toBe("盟友");
    expect(parsed.relationships[0].history).toBe("");
  });
});
