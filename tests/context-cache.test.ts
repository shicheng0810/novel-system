import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { ContextCache } from "../src/context-cache";
import { buildContextPack } from "../src/context-pack";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function pack(label: string, extra: string[] = []) {
  return buildContextPack({
    worldId: "world-a",
    lineId: "canon",
    directive: { stageLabel: label, focusCharacterIds: ["林焰"] },
    canon: { stageIds: ["stage-1", ...extra] },
  });
}

describe("ContextCache", () => {
  test("persists and loads a snapshot", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "context-cache-"));
    tempDirs.push(rootDir);
    const cache = new ContextCache({ rootDir });
    const contextPack = pack("外门试炼");

    await cache.writeSnapshot(contextPack, "cold");
    const loaded = await cache.loadSnapshot(contextPack.packId);

    expect(loaded?.pack.packId).toBe(contextPack.packId);
    expect(loaded?.reason).toBe("cold");
    expect(loaded?.hits).toBe(0);
  });

  test("finds the longest reusable prefix snapshot", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "context-cache-"));
    tempDirs.push(rootDir);
    const cache = new ContextCache({ rootDir });
    const shortPack = pack("外门试炼");
    const longPack = buildContextPack({
      worldId: "world-a",
      lineId: "canon",
      directive: { stageLabel: "外门试炼", focusCharacterIds: ["林焰"] },
      canon: { stageIds: ["stage-1"] },
      memory: { facts: ["林焰不能提前死亡"] },
    });

    await cache.writeSnapshot(shortPack, "cold");
    await cache.writeSnapshot(longPack, "continued");
    const match = await cache.findReusablePrefix([...longPack.blockHashes, "future-block"]);

    expect(match?.packId).toBe(longPack.packId);
    expect(match?.matchedBlockCount).toBe(longPack.blockHashes.length);
  });
});
