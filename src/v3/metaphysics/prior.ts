// Phase 3 · Metaphysics-as-prior · candidate scorer.
//
// Maps a CandidateAction onto the MetaphysicsFrame and returns a 0..1
// probability weight + a per-axis breakdown. The branches phase in Phase 4
// uses this to draw a weighted sample from candidate actions; the gate phase
// uses it to decide whether to ask the author when a low-weight branch wins.

import type {
  Influence,
  InfluenceAxis,
  MetaphysicsFrame,
} from "../domain/metaphysics";

export type CandidateAction = {
  candidateId: string;
  characterId: string;
  action: string;
  intent: string;
  axisHints?: InfluenceAxis[];      // axes this action exemplifies (e.g. ["initiative","rupture"])
  affectsLocationId?: string;
  affectsRelationshipId?: string;
  branchKey?: string;
};

export type ScoreBreakdown = {
  characterMatch: number;
  locationMatch: number;
  branchMatch: number;
  bagua: number;
  fortuneBias: number;
  total: number;          // 0..1 (clamped)
};

export type ScoredCandidate = {
  candidate: CandidateAction;
  weight: number;         // = breakdown.total
  breakdown: ScoreBreakdown;
  contributingInfluences: string[]; // influence ids that moved the score
  explain: string;
};

// =============================================================================
// scoreCandidate · pure projection of frame.influences onto one candidate.
// =============================================================================
export function scoreCandidate(
  candidate: CandidateAction,
  frame: MetaphysicsFrame,
): ScoredCandidate {
  let characterMatch = 0;
  let locationMatch = 0;
  let branchMatch = 0;
  let bagua = 0;
  const contributing: string[] = [];

  for (const inf of frame.influences) {
    const direction = signed(inf, candidate);
    if (direction === 0) continue;

    if (inf.target.kind === "character" && inf.target.characterId === candidate.characterId) {
      characterMatch += direction * weightOf(inf);
      contributing.push(inf.influenceId);
    } else if (inf.target.kind === "location" && candidate.affectsLocationId === inf.target.locationId) {
      locationMatch += direction * weightOf(inf);
      contributing.push(inf.influenceId);
    } else if (inf.target.kind === "branch") {
      // Bagua structural-field influences nudge every candidate slightly.
      if (inf.source === "bagua") {
        bagua += direction * weightOf(inf) * 0.5;
        contributing.push(inf.influenceId);
      } else if (candidate.branchKey === inf.target.branchKey) {
        branchMatch += direction * weightOf(inf);
        contributing.push(inf.influenceId);
      }
    } else if (inf.target.kind === "relationship" && candidate.affectsRelationshipId === inf.target.relationshipId) {
      branchMatch += direction * weightOf(inf);
      contributing.push(inf.influenceId);
    }
  }

  const fortune = frame.fortunesByCharacter[candidate.characterId];
  const fortuneBias = fortune
    ? fortune.favorability * 0.05  // -0.15 .. +0.15
    : 0;

  const raw = 0.5 + characterMatch + locationMatch + branchMatch + bagua + fortuneBias;
  const total = clamp01(raw);

  return {
    candidate,
    weight: total,
    breakdown: {
      characterMatch,
      locationMatch,
      branchMatch,
      bagua,
      fortuneBias,
      total,
    },
    contributingInfluences: [...new Set(contributing)],
    explain: explainBreakdown(candidate, total, characterMatch, locationMatch, bagua, fortuneBias, frame),
  };
}

// =============================================================================
// scoreCandidates · convenience: score a list and return them sorted by weight.
// Caller can normalize into a probability distribution if needed.
// =============================================================================
export function scoreCandidates(
  candidates: CandidateAction[],
  frame: MetaphysicsFrame,
): ScoredCandidate[] {
  return candidates
    .map((candidate) => scoreCandidate(candidate, frame))
    .sort((a, b) => b.weight - a.weight);
}

// =============================================================================
// normalizeWeights · turn weights into a probability distribution that sums to 1.
// Uses softmax-lite (linear) so a flat field doesn't collapse to one winner.
// =============================================================================
export function normalizeWeights(scored: ScoredCandidate[]): Array<{ candidate: CandidateAction; probability: number }> {
  if (scored.length === 0) return [];
  const sum = scored.reduce((acc, s) => acc + s.weight, 0);
  if (sum <= 0) {
    const flat = 1 / scored.length;
    return scored.map((s) => ({ candidate: s.candidate, probability: flat }));
  }
  return scored.map((s) => ({ candidate: s.candidate, probability: s.weight / sum }));
}

// =============================================================================
// helpers
// =============================================================================

/**
 * direction:
 *   +1 when the influence pushes the candidate toward an axis it hints at
 *   -1 when the influence pushes against an axis the candidate hints at
 *    0 when the candidate doesn't hint any axis (so we use a neutral 0.5)
 *      OR the influence and candidate axes don't intersect
 *
 * If the candidate provides no axisHints, we treat character-targeted
 * influences as +1 (any influence targeting this character is informative).
 */
function signed(inf: Influence, candidate: CandidateAction): number {
  if (!candidate.axisHints?.length) {
    return inf.target.kind === "character" && inf.target.characterId === candidate.characterId ? 0.5 : 0;
  }
  if (candidate.axisHints.includes(inf.axis)) return 1;
  // OPPOSING_PAIRS: e.g. initiative ↔ delay, rupture ↔ reconciliation
  for (const axis of candidate.axisHints) {
    if (OPPOSING[axis] === inf.axis) return -1;
  }
  return 0;
}

const OPPOSING: Partial<Record<InfluenceAxis, InfluenceAxis>> = {
  initiative: "delay",
  delay: "initiative",
  discipline: "volatility",
  volatility: "discipline",
  attachment: "rupture",
  rupture: "reconciliation",
  reconciliation: "rupture",
  exposure: "hidden-threat",
  "hidden-threat": "exposure",
};

function weightOf(inf: Influence): number {
  const conf = inf.confidence === "exact" ? 1 : inf.confidence === "derived" ? 0.7 : 0.4;
  return Math.max(0, Math.min(1, inf.weight)) * conf * 0.25; // each influence caps its push at 0.25
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function explainBreakdown(
  candidate: CandidateAction,
  total: number,
  characterMatch: number,
  locationMatch: number,
  bagua: number,
  fortuneBias: number,
  frame: MetaphysicsFrame,
): string {
  const fate = frame.fateProfilesByCharacter[candidate.characterId];
  const segs: string[] = [];
  segs.push(`权重 ${total.toFixed(2)}`);
  if (fate) segs.push(`命盘 ${fate.label}`);
  if (characterMatch !== 0) segs.push(`角色匹配 ${(characterMatch >= 0 ? "+" : "")}${characterMatch.toFixed(2)}`);
  if (locationMatch !== 0) segs.push(`地点匹配 ${(locationMatch >= 0 ? "+" : "")}${locationMatch.toFixed(2)}`);
  if (bagua !== 0) segs.push(`八卦场 ${(bagua >= 0 ? "+" : "")}${bagua.toFixed(2)}`);
  if (fortuneBias !== 0) segs.push(`运势 ${(fortuneBias >= 0 ? "+" : "")}${fortuneBias.toFixed(2)}`);
  return segs.join(" · ");
}
