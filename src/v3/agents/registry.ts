// Layer 3 · agent registry. One CharacterAgent instance per characterId,
// shared across ticks. The engine calls reflectAll/planAll concurrently.

import type { LLMProvider } from "../services/llm/types";
import type { ParsedWorldDraft, StageDirective, WorldSnapshot } from "../domain/world";
import type { MetaphysicsFrame } from "../domain/metaphysics";
import type { MemoryEntry } from "../domain/narrative";
import type { CandidateAction } from "../metaphysics/prior";

import { CharacterAgent, type Reflection } from "./character";

export type RegistryOptions = {
  llm?: LLMProvider;
  parsed: () => ParsedWorldDraft;
};

export class AgentRegistry {
  private readonly agents = new Map<string, CharacterAgent>();
  private readonly options: RegistryOptions;

  constructor(options: RegistryOptions) {
    this.options = options;
  }

  agentFor(characterId: string): CharacterAgent {
    if (!this.agents.has(characterId)) {
      this.agents.set(characterId, new CharacterAgent({ llm: this.options.llm }));
    }
    return this.agents.get(characterId)!;
  }

  /**
   * Reflect for every focus character in parallel.
   */
  async reflectAll(input: {
    snapshot: WorldSnapshot;
    frame: MetaphysicsFrame;
    directive: StageDirective;
    memories: Record<string, MemoryEntry[]>;
    characterIds: string[];
  }): Promise<Reflection[]> {
    const parsed = this.options.parsed();
    return Promise.all(
      input.characterIds.map(async (id) => {
        const character = parsed.characters.find((c) => c.id === id);
        if (!character) {
          return {
            characterId: id,
            summary: "(missing character)",
            citedMemoryIds: [],
            pressureRead: 0,
          };
        }
        return this.agentFor(id).reflect({
          character,
          snapshot: input.snapshot,
          frame: input.frame,
          directive: input.directive,
          memories: input.memories[id] ?? [],
        });
      }),
    );
  }

  /**
   * Plan for every focus character in parallel. Returns flat candidate list.
   */
  async planAll(input: {
    snapshot: WorldSnapshot;
    frame: MetaphysicsFrame;
    directive: StageDirective;
    memories: Record<string, MemoryEntry[]>;
    reflections: Reflection[];
  }): Promise<CandidateAction[]> {
    const parsed = this.options.parsed();
    const results = await Promise.all(
      input.reflections.map(async (reflection) => {
        const character = parsed.characters.find((c) => c.id === reflection.characterId);
        if (!character) return [];
        return this.agentFor(reflection.characterId).plan(
          {
            character,
            snapshot: input.snapshot,
            frame: input.frame,
            directive: input.directive,
            memories: input.memories[reflection.characterId] ?? [],
          },
          reflection,
        );
      }),
    );
    return results.flat();
  }
}
