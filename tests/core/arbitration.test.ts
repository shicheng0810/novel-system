// tests/core/arbitration.test.ts — M3: 作者裁决闭环(头号 REDO: 作者点了真正改正史)
import { describe, it, expect } from "vitest";
import { openDb } from "../../core/services/db";
import { MockLLM } from "../../core/services/llm";
import * as store from "../../core/services/store";
import { step } from "../../core/runtime/world-actor";
import { xianxiaBaziPack } from "../../packs/xianxia-bazi/index";

describe("author arbitration M3", () => {
  it("高风险分支 → DecisionRequired; 作者 accept → AuthorRuled + BranchPromoted(真正改正史)", async () => {
    const db = openDb(":memory:");
    const worldId = "t";
    const llm = new MockLLM();
    const snap = xianxiaBaziPack.seedWorld({ worldId, packId: xianxiaBaziPack.id, seed: "seed-A", config: {} });
    store.saveSnapshot(db, worldId, snap, 0, 1);
    store.setSchedulerState(db, worldId, { gen: 0, nextTick: 0, status: "running" }, 1);

    // 跑到首个 DecisionRequired
    let decisionId: string | null = null;
    for (let i = 0; i < 40 && !decisionId; i++) {
      await step(db, worldId, xianxiaBaziPack, llm);
      const dr = store.readEvents(db, worldId).find((e) => e.kind === "DecisionRequired");
      if (dr) decisionId = (dr.payload as { decisionId: string }).decisionId;
    }
    expect(decisionId, "应在 40 tick 内触发 DecisionRequired").not.toBeNull();

    // 作者 accept → 下一 tick drain 应用
    store.enqueueInput(db, `v-${decisionId}`, worldId, "author-verdict", { decisionId, verdict: "accept" }, 2);
    await step(db, worldId, xianxiaBaziPack, llm);

    const evts = store.readEvents(db, worldId);
    expect(evts.some((e) => e.kind === "AuthorRuled")).toBe(true);
    expect(evts.some((e) => e.kind === "BranchPromoted")).toBe(true);
    db.close();
  });
});
