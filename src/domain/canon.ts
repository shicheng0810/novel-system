// Layer 1 · canon types + pure anchor evaluation. No IO.

import type { CharacterAnchor, ParsedWorldDraft, WorldSnapshot } from "./world";

export type CanonRiskLevel = "none" | "low" | "medium" | "high";

export type CanonReason = {
  severity: "info" | "warning" | "error";
  anchorId?: string;
  message: string;
};

export type CanonGateDecision = {
  decisionId: string;
  branchId?: string;
  result: "promote" | "archive-only" | "ask-author" | "reject";
  riskLevel: CanonRiskLevel;
  reasons: CanonReason[];
  requiredAuthorActions: Array<"accept" | "archive" | "reject" | "revise-directive">;
};

export type AnchorViolation = {
  characterId: string;
  anchorField: keyof CharacterAnchor;
  message: string;
  severity: "warning" | "error";
};

// =============================================================================
// Pure check: does this candidate snapshot violate any character anchor?
// Returns an empty list if no violation.
// =============================================================================
export function evaluateAnchorViolations(
  parsed: ParsedWorldDraft,
  proposed: WorldSnapshot,
): AnchorViolation[] {
  const violations: AnchorViolation[] = [];

  for (const anchor of parsed.characterAnchors) {
    const character = proposed.characters[anchor.characterId];
    if (!character) continue;

    // cannot · evaluated by matching the anchor's forbidden keywords against
    // the character's lastAction / recent notes. If anchor.cannot mentions a
    // death-style keyword AND the snapshot reflects death (alive=false OR
    // notes contain it), surface as error. Otherwise scan all keywords.
    if (anchor.cannot) {
      const keywords = splitKeywords(anchor.cannot);
      const haystacks = [character.lastAction, ...character.notes];
      const deathLike = /死亡|凋落|身殒/.test(anchor.cannot);
      const hit = keywords.some((k) => haystacks.some((h) => h.includes(k)));
      if ((deathLike && !character.alive) || (hit && keywords.length > 0)) {
        violations.push({
          characterId: anchor.characterId,
          anchorField: "cannot",
          message: `角色 ${character.name} 的 cannot 锚点被触碰：${anchor.cannot}`,
          severity: "error",
        });
      }
    }

    if (anchor.mustTrend && character.notes.length > 0) {
      const trendHit = character.notes.some((note) => note.includes(anchor.mustTrend.split("，")[0] ?? ""));
      if (!trendHit && character.pressure > 80) {
        violations.push({
          characterId: anchor.characterId,
          anchorField: "mustTrend",
          message: `${character.name} 高压（${character.pressure}）下未呈现期望趋势：${anchor.mustTrend}`,
          severity: "warning",
        });
      }
    }
  }

  return violations;
}

function splitKeywords(s: string): string[] {
  return s
    .split(/[,，、；;]/)
    .map((seg) => seg.trim())
    .filter((seg) => seg.length >= 2);
}

export function riskFromViolations(violations: AnchorViolation[]): CanonRiskLevel {
  if (violations.some((v) => v.severity === "error")) return "high";
  if (violations.length >= 2) return "medium";
  if (violations.length === 1) return "low";
  return "none";
}
