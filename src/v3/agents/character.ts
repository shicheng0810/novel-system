// Layer 3 · per-character agent: reflect + plan.
// LLM is optional. When absent, falls back to deterministic heuristic.

import type { CandidateAction } from "../metaphysics/prior";
import type {
  CharacterProfile,
  StageDirective,
  WorldSnapshot,
} from "../domain/world";
import type { MetaphysicsFrame } from "../domain/metaphysics";
import type { LLMProvider } from "../services/llm/types";
import type { MemoryEntry } from "../domain/narrative";

export type Reflection = {
  characterId: string;
  summary: string;
  citedMemoryIds: string[];   // CRITIC pattern: must cite specific memory ids when LLM-grounded
  pressureRead: number;       // 0..100 — what the agent thinks its current pressure is
};

export type AgentInput = {
  character: CharacterProfile;
  snapshot: WorldSnapshot;
  frame: MetaphysicsFrame;
  directive: StageDirective;
  memories: MemoryEntry[];
};

export type CharacterAgentOptions = {
  llm?: LLMProvider;
};

export class CharacterAgent {
  constructor(private readonly options: CharacterAgentOptions = {}) {}

  async reflect(input: AgentInput): Promise<Reflection> {
    if (!this.options.llm || !this.options.llm.online) {
      return heuristicReflection(input);
    }
    try {
      const prompt = buildReflectionPrompt(input);
      const result = await this.options.llm.complete({
        messages: [
          { role: "system", content: "你扮演小说角色的内心代理，用第一人称写一段克制的反思（80字内）。务必引用至少一条具体记忆 id。" },
          { role: "user", content: prompt },
        ],
        workload: "structured",
        maxOutputTokens: 256,
      });
      const cited = (result.text.match(/mem-[a-zA-Z0-9_-]+|f\d+|e\d+/g) ?? []).slice(0, 5);
      return {
        characterId: input.character.id,
        summary: result.text.trim(),
        citedMemoryIds: cited.length ? cited : input.memories.slice(0, 1).map((m) => m.id),
        pressureRead: input.snapshot.characters[input.character.id]?.pressure ?? 30,
      };
    } catch {
      return heuristicReflection(input);
    }
  }

  async plan(input: AgentInput, reflection: Reflection): Promise<CandidateAction[]> {
    const heuristic = heuristicCandidates(input);
    if (!this.options.llm || !this.options.llm.online) {
      return heuristic;
    }
    try {
      const prompt = buildPlanPrompt(input, reflection);
      const result = await this.options.llm.completeStructured<{ actions?: Array<Record<string, unknown>> }>({
        messages: [
          {
            role: "system",
            content:
              '你是某角色的行动规划代理。基于反思 + 命盘，给出 2-3 个候选动作，输出 JSON {"actions":[{"action":"…","intent":"…","axisHints":["initiative"|"discipline"|...],"affectsLocationId"?:"…"}]}',
          },
          { role: "user", content: prompt },
        ],
        schemaName: "actions",
        schema: { type: "object" },
        workload: "structured",
        maxOutputTokens: 512,
      });
      const fromLlm = (result.value.actions ?? []).map((entry, i) => llmEntryToCandidate(input, entry, i));
      return fromLlm.length > 0 ? fromLlm : heuristic;
    } catch {
      return heuristic;
    }
  }
}

// =============================================================================
// heuristic mode
// =============================================================================

function heuristicReflection(input: AgentInput): Reflection {
  const state = input.snapshot.characters[input.character.id];
  const pressure = state?.pressure ?? 30;
  const fate = input.frame.fateProfilesByCharacter[input.character.id];
  const summary = `（启发式）${input.character.name}在「${input.directive.stageLabel}」中按 ${
    fate?.label ?? "本性"
  } 行事，压力 ${pressure}。`;
  const citedMemoryIds = input.memories.slice(0, 2).map((m) => m.id);
  return { characterId: input.character.id, summary, citedMemoryIds, pressureRead: pressure };
}

function heuristicCandidates(input: AgentInput): CandidateAction[] {
  const fate = input.frame.fateProfilesByCharacter[input.character.id];
  const aggressive: CandidateAction = {
    candidateId: `${input.frame.runId}-${input.character.id}-aggressive`,
    characterId: input.character.id,
    action: `${input.character.name}主动出手，${fate?.pressureResponse ?? "顶上去"}`,
    intent: input.character.goal,
    axisHints: ["initiative", "rupture"],
  };
  const cautious: CandidateAction = {
    candidateId: `${input.frame.runId}-${input.character.id}-cautious`,
    characterId: input.character.id,
    action: `${input.character.name}按兵不动，等候时机`,
    intent: "保留实力",
    axisHints: ["delay", "discipline"],
  };
  const aggressiveFirst =
    fate && (fate.initiative > fate.discipline || fate.dominantElements.includes("火"));
  return aggressiveFirst ? [aggressive, cautious] : [cautious, aggressive];
}

// =============================================================================
// LLM prompt helpers
// =============================================================================

function buildReflectionPrompt(input: AgentInput): string {
  const state = input.snapshot.characters[input.character.id];
  const fate = input.frame.fateProfilesByCharacter[input.character.id];
  const memoryDigest = input.memories
    .slice(0, 6)
    .map((m) => `- [${m.id}] ${m.body}`)
    .join("\n");
  return [
    `角色：${input.character.name}（${input.character.faction} · ${input.character.role}）`,
    `命盘：${fate?.explainSummary ?? "无"}`,
    `当前压力：${state?.pressure ?? 0} / 进度：${state?.progress ?? 0}`,
    `阶段：${input.directive.stageLabel}`,
    `干预：${input.directive.intervention ?? "无"}`,
    `记忆候选：`,
    memoryDigest || "（无）",
  ].join("\n");
}

function buildPlanPrompt(input: AgentInput, reflection: Reflection): string {
  return [
    `反思：${reflection.summary}`,
    `引用记忆：${reflection.citedMemoryIds.join(", ")}`,
    `阶段：${input.directive.stageLabel}`,
    `命盘：${input.frame.fateProfilesByCharacter[input.character.id]?.label ?? "无"}`,
    `奇门：${input.frame.qimenContext.pattern}`,
    "输出 2-3 个候选动作的 JSON。",
  ].join("\n");
}

function llmEntryToCandidate(
  input: AgentInput,
  raw: Record<string, unknown>,
  index: number,
): CandidateAction {
  const KNOWN_AXES = [
    "initiative",
    "discipline",
    "opportunism",
    "volatility",
    "attachment",
    "exposure",
    "delay",
    "rupture",
    "reconciliation",
    "hidden-threat",
  ] as const;
  type KnownAxis = typeof KNOWN_AXES[number];
  const axes = Array.isArray(raw.axisHints) ? (raw.axisHints as string[]) : [];
  return {
    candidateId: `${input.frame.runId}-${input.character.id}-llm-${index}`,
    characterId: input.character.id,
    action: String(raw.action ?? `${input.character.name}行动`),
    intent: String(raw.intent ?? input.character.goal),
    axisHints: axes.filter((a): a is KnownAxis => (KNOWN_AXES as readonly string[]).includes(a)),
    affectsLocationId: raw.affectsLocationId ? String(raw.affectsLocationId) : undefined,
    affectsRelationshipId: raw.affectsRelationshipId ? String(raw.affectsRelationshipId) : undefined,
  };
}
