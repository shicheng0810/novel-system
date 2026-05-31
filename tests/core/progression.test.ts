// tests/core/progression.test.ts — M4: 进阶状态机(突破只经作者裁决 → 真升阶, 防 power-creep)
import { describe, it, expect } from "vitest";
import { openDb } from "../../core/services/db";
import { MockLLM } from "../../core/services/llm";
import * as store from "../../core/services/store";
import { step } from "../../core/runtime/world-actor";
import { xianxiaBaziPack } from "../../packs/xianxia-bazi/index";

describe("progression M4", () => {
  it("作者 accept 突破 → ProgressionAdvanced + 角色真升阶", async () => {
    const db = openDb(":memory:");
    const worldId = "t";
    const llm = new MockLLM();
    const snap = xianxiaBaziPack.seedWorld({ worldId, packId: xianxiaBaziPack.id, seed: "seed-A", config: {} });
    store.saveSnapshot(db, worldId, snap, 0, 1);
    store.setSchedulerState(db, worldId, { gen: 0, nextTick: 0, status: "running" }, 1);

    let decisionId: string | null = null;
    let charId = "";
    for (let i = 0; i < 40 && !decisionId; i++) {
      await step(db, worldId, xianxiaBaziPack, llm);
      const dr = store.readEvents(db, worldId).find((e) => e.kind === "DecisionRequired");
      if (dr) {
        const p = dr.payload as { decisionId: string; branchId: string };
        decisionId = p.decisionId;
        charId = p.branchId.split("-t")[0]!;
      }
    }
    expect(decisionId).not.toBeNull();
    const before = store.loadSnapshot(db, worldId)!.snapshot.characters[charId]!.progressionTier;

    store.enqueueInput(db, `v-${decisionId}`, worldId, "author-verdict", { decisionId, verdict: "accept" }, 2);
    await step(db, worldId, xianxiaBaziPack, llm);

    const evts = store.readEvents(db, worldId);
    expect(evts.some((e) => e.kind === "ProgressionAdvanced")).toBe(true);
    const after = store.loadSnapshot(db, worldId)!.snapshot.characters[charId]!.progressionTier;
    expect(after).not.toBe(before);
    db.close();
  });
});
