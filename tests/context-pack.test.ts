import { describe, expect, test } from "vitest";

import { buildContextPack, hashStableValue, stableSerialize } from "../src/context-pack";

describe("ContextPack", () => {
  test("serializes object keys in stable order", () => {
    const left = stableSerialize({ b: 2, a: { d: 4, c: 3 } });
    const right = stableSerialize({ a: { c: 3, d: 4 }, b: 2 });

    expect(left).toBe(right);
    expect(hashStableValue({ b: 2, a: 1 })).toBe(hashStableValue({ a: 1, b: 2 }));
  });

  test("preserves array order in hashes", () => {
    expect(hashStableValue(["canon", "memory"])).not.toBe(hashStableValue(["memory", "canon"]));
  });

  test("builds a deterministic context pack from story inputs", () => {
    const input = {
      worldId: "world-a",
      lineId: "canon",
      directive: { stageLabel: "外门试炼", focusCharacterIds: ["林焰"] },
      canon: { stageIds: ["stage-1"], summary: "林焰入外门。" },
      memory: { facts: ["林焰不能提前死亡"] },
      modelProfile: { model: "deepseek-v4-pro", contextWindowTokens: 1_000_000, reasoningEffort: "max" },
    };

    const first = buildContextPack(input);
    const second = buildContextPack({
      modelProfile: input.modelProfile,
      memory: input.memory,
      canon: input.canon,
      directive: input.directive,
      lineId: input.lineId,
      worldId: input.worldId,
    });

    expect(first.packId).toBe(second.packId);
    expect(first.blocks.map((block) => block.kind)).toEqual(["directive", "canon", "memory", "model-profile"]);
    expect(first.tokenEstimate).toBeGreaterThan(0);
  });
});
