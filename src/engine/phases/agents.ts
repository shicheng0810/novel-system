import { makeEventId } from "../../domain/events";
import type { MetaphysicsFrame } from "../../domain/metaphysics";
import type { MemoryEntry } from "../../domain/narrative";
import type { AgentsPhaseResult, TickContext } from "../types";

export async function runAgentsPhase(
  ctx: TickContext,
  frame: MetaphysicsFrame,
): Promise<AgentsPhaseResult> {
  const focusIds = ctx.request.directive.focusCharacterIds.length
    ? ctx.request.directive.focusCharacterIds
    : ctx.parsed.characters.slice(0, 2).map((c) => c.id);

  const memories = await fetchMemoriesPerCharacter(ctx, focusIds);

  const reflections = await ctx.registry.reflectAll({
    snapshot: ctx.snapshot,
    frame,
    directive: ctx.request.directive,
    memories,
    characterIds: focusIds,
  });

  for (const reflection of reflections) {
    ctx.bus.emit({
      id: makeEventId({
        subsystem: "agents",
        runId: ctx.runId,
        phase: "agents",
        sourceRef: reflection.characterId,
      }),
      ts: Date.now(),
      worldId: ctx.request.worldId,
      runId: ctx.runId,
      subsystem: "agents",
      severity: "ambient",
      status: "succeeded",
      phase: "agents",
      verb: "心动",
      subject: reflection.characterId,
      summary: reflection.summary.slice(0, 80),
      refs: { citedMemoryIds: reflection.citedMemoryIds, pressureRead: reflection.pressureRead },
    });
  }

  const candidates = await ctx.registry.planAll({
    snapshot: ctx.snapshot,
    frame,
    directive: ctx.request.directive,
    memories,
    reflections,
  });

  return { reflections, candidates };
}

async function fetchMemoriesPerCharacter(
  ctx: TickContext,
  characterIds: string[],
): Promise<Record<string, MemoryEntry[]>> {
  const map: Record<string, MemoryEntry[]> = {};
  for (const id of characterIds) {
    const character = ctx.parsed.characters.find((c) => c.id === id);
    const query = character?.name ?? id;
    const hits = ctx.memory.recall({
      worldId: ctx.request.worldId,
      lineId: "canon",
      query,
      characterIds: [id],
      limit: 8,
    });
    map[id] = hits.map((h) => h.entry);
  }
  return map;
}
