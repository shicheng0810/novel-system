export * from "./domain";
export * from "./runtime-types";
export * from "./run-store";
export * from "./context-pack";
export * from "./context-cache";
export * from "./narrative-session";
export * from "./runtime-trace";
export * from "./runtime-worker";
export * from "./persistent-runtime-daemon";
export * from "./novel-runtime-kernel";
export * from "./metaphysics";
export * from "./metaphysics/bagua";
export * from "./metaphysics/frame";
export * from "./metaphysics/qimen-board";
export * from "./canon-gate";
export * from "./engine";
export * from "./world-daemon";
export * from "./agents/provider";
export * from "./narrative";
export * from "./orchestration";
export * from "./deepseek-profile";
export * from "./deepseek";
export * from "./ai-settings";
export * from "./memory";
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
