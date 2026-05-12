// End-to-end sandbox: load a sample world, run 5 ticks (with 2 composes),
// print the resulting events + chapter count. Run with `npm run sandbox`.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AgentRegistry } from "./agents/registry";
import { openDb } from "./data/db";
import { Daemon } from "./daemon/daemon";
import { AtlasService } from "./services/atlas-service";
import { EventBus } from "./services/event-bus";
import { MemoryService } from "./services/memory-service";
import { WorldStore } from "./services/world-store";
import { MockLLMProvider } from "./services/llm/mock";
import type { ParsedWorldDraft } from "./domain/world";

const sampleDraft: ParsedWorldDraft = {
  worldSpec: {
    genre: "东方玄幻/修仙",
    timeScale: "阶段",
    cultivationSystem: "灵海/化罡/真传",
    worldRules: [
      "玄脉共鸣会放大角色的欲望与执念",
      "宗门资源稀缺时，外门与真传的矛盾会激化",
    ],
    factions: [
      { name: "青岳宗", description: "名门正宗，控制地火丹炉" },
      { name: "幽潮殿", description: "潜伏北荒，以夺取玄脉为目标" },
    ],
    locations: [
      { name: "外门山城", description: "青岳宗外门弟子聚居之地" },
      { name: "地火丹谷", description: "炼丹重地，失守会引发大乱" },
    ],
  },
  characters: [
    {
      id: "林焰",
      name: "林焰",
      baziRaw: "丙午,丙午,丁巳,丁未",
      description: "少年心火盛",
      faction: "青岳宗",
      role: "外门弟子",
      traits: ["倔强", "护短", "求突破"],
      goal: "拿到真传名额",
      stance: "守宗",
      resource: "赤纹残图",
    },
    {
      id: "苏雪",
      name: "苏雪",
      baziRaw: "辛巳,癸酉,己亥,乙丑",
      description: "外冷内热",
      faction: "青岳宗",
      role: "丹谷执事",
      traits: ["冷静", "克制", "重情"],
      goal: "守住丹谷",
      stance: "守宗",
      resource: "地火炉令",
    },
  ],
  relationships: [
    {
      id: "林焰-苏雪",
      left: "林焰",
      right: "苏雪",
      status: "盟友",
      history: "苏雪曾暗中保下林焰",
      tension: "信任下的压抑情愫",
    },
  ],
  characterAnchors: [
    { characterId: "林焰", cannot: "提前死亡", mustTrend: "在压力中成长", stageGoal: "接近真传名额" },
    { characterId: "苏雪", cannot: "无因失守底线", mustTrend: "守与情之间摇摆", stageGoal: "守住丹谷" },
  ],
  relationshipAnchors: [
    { relationshipId: "林焰-苏雪", left: "林焰", right: "苏雪", boundary: "不能无因反目成仇", trend: "盟友走向紧绷" },
  ],
};

async function main(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "v3-sandbox-"));
  const db = openDb({ rootDir: dir });
  const bus = new EventBus(db);
  const worldStore = new WorldStore(db);
  const memory = new MemoryService(db, bus);
  const atlas = new AtlasService(db, bus);
  const llm = new MockLLMProvider();
  const registry = new AgentRegistry({ parsed: () => sampleDraft });

  worldStore.applyDraft("sandbox", sampleDraft);
  atlas.compile({ worldId: "sandbox", lineId: "canon", parsed: sampleDraft, snapshot: worldStore.load("sandbox")!.snapshot });

  const daemon = new Daemon({ db, bus, worldStore, memory, atlas, registry, llm });
  daemon.start({
    worldId: "sandbox",
    threadId: "sandbox-main",
    targetTicks: 5,
    composeEvery: 3,
    composeLens: {
      focusCharacterIds: ["林焰", "苏雪"],
      style: "omniscient-web",
      stageRange: [],
      chapterGoal: "推进核心冲突",
      sceneCount: 4,
      targetLength: [2800, 3300],
      factConstraint: "medium-expansion",
    },
  });

  const final = await daemon.waitForIdle();
  const events = bus.query({ worldId: "sandbox", limit: 2000 });
  const chapters = db.prepare("SELECT COUNT(*) as n FROM chapters").get() as { n: number };
  const frames = db.prepare("SELECT COUNT(*) as n FROM metaphysics_frames").get() as { n: number };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    rootDir: dir,
    daemon: final,
    eventCount: events.length,
    chapterCount: chapters.n,
    metaphysicsFrameCount: frames.n,
    bySubsystem: Object.fromEntries(
      [...new Set(events.map((e) => e.subsystem))].map((s) => [s, events.filter((e) => e.subsystem === s).length]),
    ),
  }, null, 2));

  bus.close();
  db.close();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
