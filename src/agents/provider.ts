import type { ParsedWorldDraft, StageDirective } from "../domain";
import type { MetaphysicsFrame } from "../metaphysics/frame";
import type { CharacterActionCandidate } from "../runtime-types";

export type CharacterAgentContext = {
  parsed: ParsedWorldDraft;
  frame: MetaphysicsFrame;
  directive: StageDirective;
};

export type CharacterAgentProvider = {
  readonly name: string;
  generateCandidates(context: CharacterAgentContext): CharacterActionCandidate[];
};

export class LocalCharacterAgentProvider implements CharacterAgentProvider {
  readonly name = "local-character-agent";

  generateCandidates(context: CharacterAgentContext): CharacterActionCandidate[] {
    return context.directive.focusCharacterIds
      .map((characterId) => context.parsed.characters.find((character) => character.id === characterId))
      .filter((character) => character !== undefined)
      .map((character) => {
        const supportingInfluences = context.frame.influences
          .filter((influence) => influence.target.kind !== "relationship")
          .slice(0, 3)
          .map((influence) => influence.influenceId);
        const anchor = context.parsed.characterAnchors.find((candidate) => candidate.characterId === character.id);
        return {
          candidateId: `${context.frame.runId}-${character.id}-candidate`,
          characterId: character.id,
          action: `${character.name}围绕${character.goal}采取克制推进`,
          intent: character.goal,
          expectedGain: character.resource,
          expectedCost: anchor?.cannot ?? "消耗当前资源",
          riskTags: anchor ? [anchor.cannot] : [],
          supportingInfluences,
          violatesKnownAnchor: false,
        };
      });
  }
}
