// Phase 0: gutted to the surface that still compiles. v3 architecture lives in src/v3/*
// (see /root/.claude/plans/system-reminder-you-re-running-in-buzzing-kitten.md).
// Modules removed in Phase 0 (now in src/_legacy/, to be rewritten in Phase 2-5):
//   - memory, context-cache, run-store, orchestration
//   - runtime-trace, narrative-session
//   - world-daemon, novel-runtime-kernel, persistent-runtime-daemon
// Modules expected by old README but never committed (will be rewritten in v3):
//   - graph-runtime-daemon, director, character-{synthesizer,agent}
//   - anti-slop-sanitizer, xianxia-verifier
//   - agent-llm-{provider,bridge}, embedding-provider
//   - atomic-fs, memory-index, metaphysics/lunar-bazi

export * from "./domain";
export * from "./runtime-types";
export * from "./context-pack";
export * from "./runtime-worker";
export * from "./metaphysics";
export * from "./metaphysics/bagua";
export * from "./metaphysics/frame";
export * from "./metaphysics/qimen-board";
export * from "./canon-gate";
export * from "./engine";
export * from "./agents/provider";
export * from "./narrative";
export * from "./deepseek-profile";
export * from "./deepseek";
export * from "./ai-settings";
export * from "./truth-core";
export * from "./read-models";
export * from "./reading-artifacts";
export * from "./parser";

import { draftNarrative } from "./narrative";
import { WorldHistoryEngine } from "./engine";
import { parseWorldDraft } from "./parser";

export function buildDemoReport(draftText: string, options: { expandMetaphysics?: boolean } = {}): string {
  const engine = new WorldHistoryEngine(parseWorldDraft(draftText));
  const firstFocus = engine.getParsedWorld().characters[0]?.id ?? "";
  const secondFocus = engine.getParsedWorld().characters[1]?.id ?? firstFocus;
  const result = engine.runStage({
    stageLabel: "外门试炼",
    focusCharacterIds: [firstFocus].filter(Boolean),
  });
  const narrative = draftNarrative({
    line: engine.getCanonLine(),
    lens: {
      focusCharacterIds: [secondFocus].filter(Boolean),
      style: "omniscient-web",
      stageRange: [result.canonStage.id],
      chapterGoal: "展示这一阶段里各方势力第一次真正撞上台面",
      sceneCount: 7,
      targetLength: [2800, 3300],
      factConstraint: "medium-expansion",
    },
  });
  const metaphysics = options.expandMetaphysics
    ? [
        "术数解释",
        result.canonStage.metaphysicsExplanation.fateLayer,
        result.canonStage.metaphysicsExplanation.fortuneLayer,
        result.canonStage.metaphysicsExplanation.qimenLayer,
      ].join("\n")
    : "";

  return [
    "正史阶段",
    result.canonStage.events.map((event) => `- ${event.title}: ${event.summary}`).join("\n"),
    "分叉建议",
    result.branchEvaluations.map((branch) => `- ${branch.title}: ${branch.scores.total}`).join("\n"),
    "章节计划",
    narrative.plan.summary,
    "场景列表",
    narrative.sceneSummaries.join("\n"),
    "短章节正文",
    narrative.chapterText,
    metaphysics,
  ]
    .filter(Boolean)
    .join("\n\n");
}
