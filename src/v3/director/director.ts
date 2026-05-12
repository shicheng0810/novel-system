// Layer 3.5 · Director.
// Decides what each tick does:
//   - which 5-phase arc point we're at (exposition → rising → climax → falling → coda)
//   - tension EMA delta
//   - which characters to focus this tick (recency-penalty rotation)
//   - whether this tick should also trigger a compose
//   - intervention hint to feed the directive

import type {
  ParsedWorldDraft,
  Stage,
  StageDirective,
  WorldSnapshot,
} from "../domain/world";

export type ArcPhase = "exposition" | "rising" | "climax" | "falling" | "coda";

export type TickPlan = {
  tickIndex: number;
  arcPhase: ArcPhase;
  tension: number;            // 0..100 EMA
  focusCharacterIds: string[];
  intervention?: string;
  compose: boolean;           // should this tick produce a chapter draft?
  rationale: string;
};

export type DirectorOptions = {
  totalTicks?: number;        // for arc mapping; defaults to 30
  composeEvery?: number;      // every N ticks emit a compose; default 3
  initialTension?: number;
  tensionAlpha?: number;      // EMA smoothing 0..1; default 0.4
  recencyPenalty?: number;    // how much to demote recent focus characters; default 0.6
};

export type DirectorContext = {
  parsedFn: () => ParsedWorldDraft;
  snapshotFn: () => WorldSnapshot;
};

export class Director {
  private tension: number;
  private readonly recentFocus: string[] = [];
  private readonly options: Required<DirectorOptions>;

  constructor(
    private readonly ctx: DirectorContext,
    options: DirectorOptions = {},
  ) {
    this.options = {
      totalTicks: options.totalTicks ?? 30,
      composeEvery: options.composeEvery ?? 3,
      initialTension: options.initialTension ?? 30,
      tensionAlpha: options.tensionAlpha ?? 0.4,
      recencyPenalty: options.recencyPenalty ?? 0.6,
    };
    this.tension = this.options.initialTension;
  }

  plan(input: { tickIndex: number; history: Stage[] }): TickPlan {
    const arcPhase = mapArcPhase(input.tickIndex, this.options.totalTicks);
    this.tension = updateTension(this.tension, arcPhase, this.options.tensionAlpha);

    const parsed = this.ctx.parsedFn();
    const snapshot = this.ctx.snapshotFn();
    const focusCharacterIds = pickFocus(parsed, snapshot, this.recentFocus, this.options.recencyPenalty);
    rememberRecent(this.recentFocus, focusCharacterIds, /* keep */ 4);

    const compose = (input.tickIndex + 1) % this.options.composeEvery === 0;
    const intervention = arcPhase === "climax" ? "高潮临近，给焦点角色一次不可逆选择" : undefined;

    return {
      tickIndex: input.tickIndex,
      arcPhase,
      tension: this.tension,
      focusCharacterIds,
      intervention,
      compose,
      rationale: `arc=${arcPhase} tension=${this.tension.toFixed(0)} focus=${focusCharacterIds.join("·")} compose=${compose}`,
    };
  }

  toDirective(plan: TickPlan): StageDirective {
    return {
      stageLabel: stageLabelFor(plan),
      focusCharacterIds: plan.focusCharacterIds,
      intervention: plan.intervention,
    };
  }

  snapshotState() {
    return { tension: this.tension, recentFocus: [...this.recentFocus] };
  }
}

// =============================================================================
// helpers
// =============================================================================

function mapArcPhase(tickIndex: number, total: number): ArcPhase {
  const ratio = tickIndex / Math.max(1, total - 1);
  if (ratio < 0.2) return "exposition";
  if (ratio < 0.6) return "rising";
  if (ratio < 0.8) return "climax";
  if (ratio < 0.95) return "falling";
  return "coda";
}

function updateTension(prev: number, arcPhase: ArcPhase, alpha: number): number {
  const target =
    arcPhase === "exposition" ? 25 :
    arcPhase === "rising" ? 55 :
    arcPhase === "climax" ? 90 :
    arcPhase === "falling" ? 60 : 35;
  return prev + alpha * (target - prev);
}

function pickFocus(
  parsed: ParsedWorldDraft,
  snapshot: WorldSnapshot,
  recent: string[],
  recencyPenalty: number,
): string[] {
  if (parsed.characters.length === 0) return [];
  const scored = parsed.characters.map((character) => {
    const state = snapshot.characters[character.id];
    const pressure = state?.pressure ?? 0;
    const recencyHit = recent.indexOf(character.id);
    const recencyScore = recencyHit >= 0 ? recencyPenalty * (1 - recencyHit / recent.length) : 0;
    const anchorPressure = anchorWeight(parsed, character.id);
    return {
      id: character.id,
      score: pressure / 100 + anchorPressure - recencyScore,
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return [scored[0].id, scored[1]?.id].filter((id): id is string => Boolean(id));
}

function anchorWeight(parsed: ParsedWorldDraft, characterId: string): number {
  const anchor = parsed.characterAnchors.find((a) => a.characterId === characterId);
  if (!anchor) return 0.1;
  let weight = 0.2;
  if (anchor.stageGoal) weight += 0.2;
  if (anchor.cannot) weight += 0.1;
  if (anchor.mustTrend) weight += 0.1;
  return weight;
}

function rememberRecent(recent: string[], focus: string[], keep: number): void {
  for (const id of focus) {
    const at = recent.indexOf(id);
    if (at >= 0) recent.splice(at, 1);
    recent.unshift(id);
  }
  while (recent.length > keep) recent.pop();
}

function stageLabelFor(plan: TickPlan): string {
  const focus = plan.focusCharacterIds.join("·");
  switch (plan.arcPhase) {
    case "exposition":
      return `开端 · ${focus}`;
    case "rising":
      return `上升 · ${focus}`;
    case "climax":
      return `高潮 · ${focus}`;
    case "falling":
      return `下降 · ${focus}`;
    case "coda":
      return `收束 · ${focus}`;
  }
}
