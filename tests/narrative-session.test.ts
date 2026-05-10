import { describe, expect, test } from "vitest";

import { buildContextPack } from "../src/context-pack";
import { NarrativeSession } from "../src/narrative-session";

function contextPack(stageLabel: string, memoryFacts: string[] = []) {
  return buildContextPack({
    worldId: "world-a",
    lineId: "canon",
    directive: { stageLabel, focusCharacterIds: ["林焰"] },
    canon: { stageIds: ["stage-1"] },
    memory: memoryFacts.length ? { facts: memoryFacts } : undefined,
  });
}

describe("NarrativeSession", () => {
  test("reports replace, reuse, and extend sync modes", () => {
    const session = new NarrativeSession();
    const first = contextPack("外门试炼");
    const extended = contextPack("外门试炼", ["林焰不能提前死亡"]);

    expect(session.sync(first).mode).toBe("replace");
    expect(session.sync(first).mode).toBe("reuse");
    const extendedResult = session.sync(extended);

    expect(extendedResult.mode).toBe("extend");
    expect(extendedResult.commonBlockCount).toBe(first.blockHashes.length);
    expect(session.snapshot().packId).toBe(extended.packId);
  });

  test("replaces when the directive block changes", () => {
    const session = new NarrativeSession();
    session.sync(contextPack("外门试炼"));

    const result = session.sync(contextPack("内门试炼"));

    expect(result.mode).toBe("replace");
    expect(result.commonBlockCount).toBe(0);
  });
});
