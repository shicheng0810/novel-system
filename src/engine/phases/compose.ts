// Six compose sub-phases as one file. Each emits its own event so the SSE
// front end can light up the 6-stage 灯轨 progress bar.

import { makeEventId, type TickPhase } from "../../domain/events";
import type {
  ChapterDraft,
  ChapterPlan,
  MemoryEntry,
  NarrativeLens,
  ReviewReport,
  SceneCard,
  SceneDraft,
} from "../../domain/narrative";
import type { ScoredCandidate } from "../../metaphysics/prior";

import { sanitizeProse } from "../../verify/slop";
import { verifyXianxia } from "../../verify/xianxia";
import type { ComposePhaseResult, TickContext } from "../types";

export async function runComposePhases(
  ctx: TickContext,
  chosen: ScoredCandidate,
  lens: NarrativeLens,
): Promise<ComposePhaseResult> {
  const memories = await composeMemoryRead(ctx, lens);
  const plan = await composeBlueprint(ctx, lens, chosen);
  const scenes = await composeSceneCards(ctx, plan, lens);
  const sceneDrafts = await composeSynthesize(ctx, scenes, plan);
  const review = await composeReview(ctx, sceneDrafts);
  const draft = await composeInscribe(ctx, lens, plan, scenes, sceneDrafts, review, memories);
  return { draft };
}

async function composeMemoryRead(ctx: TickContext, lens: NarrativeLens): Promise<MemoryEntry[]> {
  emitComposeStart(ctx, "memory-read", "取材");
  const focusName = ctx.parsed.characters.find((c) => c.id === lens.focusCharacterIds[0])?.name ?? "本章";
  const hits = await ctx.memory.recallHybrid({
    worldId: ctx.request.worldId,
    lineId: "canon",
    query: `${focusName} ${lens.chapterGoal ?? ""}`.trim(),
    characterIds: lens.focusCharacterIds,
    limit: 12,
  });
  const memories = hits.map((h) => h.entry);
  emitComposeEnd(ctx, "memory-read", "取材", `读取 ${memories.length} 条记忆`);
  return memories;
}

async function composeBlueprint(
  ctx: TickContext,
  lens: NarrativeLens,
  chosen: ScoredCandidate,
): Promise<ChapterPlan> {
  emitComposeStart(ctx, "blueprint", "立骨");
  const plan: ChapterPlan = {
    chapterTitle: `${ctx.request.directive.stageLabel}`,
    chapterGoal: lens.chapterGoal ?? "推进核心冲突",
    stageRange: lens.stageRange,
    mainConflict: chosen.candidate.action,
    secondaryConflict: ctx.request.directive.intervention ?? "局势未明",
    closingHook: "下一阶段的悬念已就位",
    sceneOrder: Array.from({ length: lens.sceneCount ?? 5 }, (_, i) => `scene-${i + 1}`),
    summary: `${chosen.candidate.action} —— ${chosen.explain}`,
  };
  emitComposeEnd(ctx, "blueprint", "立骨", plan.summary.slice(0, 60));
  return plan;
}

async function composeSceneCards(
  ctx: TickContext,
  plan: ChapterPlan,
  lens: NarrativeLens,
): Promise<SceneCard[]> {
  emitComposeStart(ctx, "scene-cards", "铺场");
  const sceneCount = lens.sceneCount ?? 5;
  const focusIds = lens.focusCharacterIds;
  const scenes: SceneCard[] = Array.from({ length: sceneCount }, (_, i) => ({
    id: `scene-${i + 1}`,
    order: i + 1,
    location: ctx.parsed.worldSpec.locations[i % Math.max(1, ctx.parsed.worldSpec.locations.length)]?.name ?? "未命名地点",
    time: `第 ${i + 1} 节`,
    participants: focusIds,
    sceneGoal: i === 0 ? "开场氛围" : i === sceneCount - 1 ? plan.closingHook : `推进第 ${i + 1} 段冲突`,
    conflict: i === Math.floor(sceneCount / 2) ? plan.mainConflict : plan.secondaryConflict,
    hardFacts: [],
    softExpansionBudget: [],
    transitionIn: i === 0 ? "无" : `承接第 ${i} 节`,
    transitionOut: i === sceneCount - 1 ? "扫尾" : `引向第 ${i + 2} 节`,
    focusCue: focusIds[0] ?? "群像",
  }));
  emitComposeEnd(ctx, "scene-cards", "铺场", `生成 ${scenes.length} 个场景卡`);
  return scenes;
}

async function composeSynthesize(
  ctx: TickContext,
  scenes: SceneCard[],
  plan: ChapterPlan,
): Promise<SceneDraft[]> {
  emitComposeStart(ctx, "synthesize", "成文");
  const drafts: SceneDraft[] = [];
  for (const scene of scenes) {
    if (ctx.llm.online) {
      try {
        const result = await ctx.llm.complete({
          messages: [
            { role: "system", content: "你是修仙小说作者，写一段克制的中文场景，不要套话。" },
            {
              role: "user",
              content: [
                `章节：${plan.chapterTitle}`,
                `场景目标：${scene.sceneGoal}`,
                `冲突：${scene.conflict}`,
                `参与角色：${scene.participants.join("、")}`,
                `地点：${scene.location}`,
              ].join("\n"),
            },
          ],
          workload: "prose",
          maxOutputTokens: 1200,
        });
        drafts.push({ sceneId: scene.id, title: scene.sceneGoal, summary: scene.conflict, text: result.text });
        continue;
      } catch {
        // fall through to heuristic
      }
    }
    const fallback = `（启发式）${scene.participants.join("、")}在${scene.location}围绕「${scene.conflict}」推进情节。`;
    drafts.push({ sceneId: scene.id, title: scene.sceneGoal, summary: scene.conflict, text: fallback });
  }
  emitComposeEnd(ctx, "synthesize", "成文", `${drafts.length} 个场景成文`);
  return drafts;
}

async function composeReview(ctx: TickContext, sceneDrafts: SceneDraft[]): Promise<ReviewReport> {
  emitComposeStart(ctx, "review", "自审");
  const text = sceneDrafts.map((d) => d.text).join("\n\n");
  const slop = sanitizeProse(text);
  const xianxia = verifyXianxia({ text, parsed: ctx.parsed });

  const report: ReviewReport = {
    passed: slop.slopScore < 7 && xianxia.passed,
    issues: xianxia.violations
      .filter((v) => v.severity === "blocker")
      .map((v) => `[xianxia:${v.kind}] ${v.message}`),
    warnings: [
      ...slop.issues.map((i) => `[anti-slop:${i.category}] ${i.message}`),
      ...xianxia.violations.filter((v) => v.severity === "warning").map((v) => `[xianxia:${v.kind}] ${v.message}`),
    ],
    styleNotes: [`slop-score=${slop.slopScore.toFixed(1)}/10`],
    factCoverage: 0.8,
    suggestedRewrites: [],
  };

  emitComposeEnd(
    ctx,
    "review",
    "自审",
    report.passed
      ? `自审通过 · slop ${slop.slopScore.toFixed(1)}`
      : `自审拒绝 · ${report.issues.length} 阻断 / ${report.warnings.length} 警告`,
    report.passed ? "succeeded" : "blocked",
  );
  return report;
}

async function composeInscribe(
  ctx: TickContext,
  lens: NarrativeLens,
  plan: ChapterPlan,
  scenes: SceneCard[],
  sceneDrafts: SceneDraft[],
  review: ReviewReport,
  memories: MemoryEntry[],
): Promise<ChapterDraft> {
  if (!review.passed) {
    emitComposeEnd(
      ctx,
      "inscribe",
      "入史",
      `因自审未过暂未入史 (${review.issues.length} 阻断)`,
      "blocked",
    );
    return chapterDraft(ctx, lens, plan, scenes, sceneDrafts, review, "rejected");
  }

  emitComposeStart(ctx, "inscribe", "入史");

  for (const draft of sceneDrafts) {
    await ctx.memory.write({
      worldId: ctx.request.worldId,
      lineId: "canon",
      entry: {
        kind: "expression",
        id: `expr-${ctx.runId}-${draft.sceneId}`,
        body: draft.text.slice(0, 280),
        characterIds: lens.focusCharacterIds,
        toneTags: [],
        source: { kind: "scene", sceneId: draft.sceneId, chapterId: ctx.runId },
      },
    });
  }
  ctx.atlas.compile({
    worldId: ctx.request.worldId,
    lineId: "canon",
    parsed: ctx.parsed,
    snapshot: ctx.snapshot,
  });

  const chapter = chapterDraft(ctx, lens, plan, scenes, sceneDrafts, review, "inscribed");

  emitComposeEnd(
    ctx,
    "inscribe",
    "入史",
    `第 ${ctx.snapshot.stageNumber} 阶段入史 · 记忆 +${sceneDrafts.length} · 复用记忆 ${memories.length}`,
  );
  return chapter;
}

// =============================================================================
// helpers
// =============================================================================

function chapterDraft(
  ctx: TickContext,
  lens: NarrativeLens,
  plan: ChapterPlan,
  scenes: SceneCard[],
  sceneDrafts: SceneDraft[],
  review: ReviewReport,
  status: ChapterDraft["status"],
): ChapterDraft {
  const chapterId = `chapter-${ctx.runId}`;
  return {
    chapterId,
    worldId: ctx.request.worldId,
    lineId: "canon",
    stageId: ctx.snapshot.stageId,
    status,
    lens,
    plan,
    scenes,
    sceneDrafts,
    text: sceneDrafts.map((s) => s.text).join("\n\n"),
    review,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function emitComposeStart(ctx: TickContext, phase: TickPhase, verb: string): void {
  ctx.bus.emit({
    id: makeEventId({ subsystem: "compose", runId: ctx.runId, phase, sourceRef: "started" }),
    ts: Date.now(),
    worldId: ctx.request.worldId,
    runId: ctx.runId,
    subsystem: "compose",
    severity: "ambient",
    status: "started",
    phase,
    verb,
    subject: "本章",
    summary: `${verb}阶段开始`,
  });
}

function emitComposeEnd(
  ctx: TickContext,
  phase: TickPhase,
  verb: string,
  summary: string,
  status: "succeeded" | "blocked" = "succeeded",
): void {
  ctx.bus.emit({
    id: makeEventId({ subsystem: "compose", runId: ctx.runId, phase, sourceRef: status }),
    ts: Date.now(),
    worldId: ctx.request.worldId,
    runId: ctx.runId,
    subsystem: "compose",
    severity: status === "blocked" ? "decision-required" : "ambient",
    status,
    phase,
    verb,
    subject: "本章",
    summary,
  });
}
