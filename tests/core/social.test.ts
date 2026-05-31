// tests/core/social.test.ts — (b) 社交涌现: 八字五行生克驱动结盟/道争, 关系自发形成且确定性
import { describe, it, expect } from "vitest";
import { openDb } from "../../core/services/db";
import { MockLLM } from "../../core/services/llm";
import * as store from "../../core/services/store";
import { runTicks } from "../../core/runtime/scheduler";
import { xianxiaBaziPack } from "../../packs/xianxia-bazi/index";

async function run(seed: string): Promise<{ bonds: number; json: string }> {
  const db = openDb(":memory:");
  const worldId = "t";
  store.saveSnapshot(db, worldId, xianxiaBaziPack.seedWorld({ worldId, packId: xianxiaBaziPack.id, seed, config: {} }), 0, 1);
  store.setSchedulerState(db, worldId, { gen: 0, nextTick: 0, status: "running" }, 1);
  await runTicks(db, worldId, xianxiaBaziPack, new MockLLM(), 24);
  const snap = store.loadSnapshot(db, worldId);
  if (!snap) throw new Error("no snapshot");
  db.close();
  let bonds = 0;
  for (const c of Object.values(snap.snapshot.characters)) {
    for (const [k, v] of Object.entries(c.props)) {
      if (k.startsWith("bond:") && typeof v === "number" && v !== 0) bonds++;
    }
  }
  return { bonds, json: JSON.stringify(snap.snapshot) };
}

describe("emergent social (b)", () => {
  it("八字生克 → 自发结盟/道争(bond 变化)", async () => {
    const r = await run("seed-A");
    expect(r.bonds).toBeGreaterThan(0);
  });
  it("确定性: 同 seed → 同社交格局", async () => {
    const a1 = await run("seed-A");
    const a2 = await run("seed-A");
    expect(a1.json).toBe(a2.json);
  });
});
