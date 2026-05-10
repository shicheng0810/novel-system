import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  draftNarrativeWithDeepSeek,
  parseWorldDraft,
  resolveDeepSeekConfig,
  StoryMemoryStore,
  WorldHistoryEngine,
} from "../src/index.ts";
import type { NarrativeDraft, NarrativeLens, StageDirective } from "../src/index.ts";

type ChapterEval = {
  chapter: number;
  stageId: string;
  title: string;
  length: number;
  paragraphs: number;
  sceneDrafts: number;
  reviewerPassed: boolean;
  factCoverage: number;
  score: number;
  maxScore: number;
  verdict: "normal-chapter" | "usable-with-fixes" | "not-normal";
  passedChecks: string[];
  failedChecks: string[];
  warnings: string[];
};

const chapterDirectives: Array<{
  directive: StageDirective;
  goal: string;
  focus: string[];
}> = [
  {
    directive: {
      stageLabel: "外门试炼",
      focusCharacterIds: ["林焰", "苏雪"],
      intervention: "外门试炼提前开启，玄脉残图的气息第一次被公开逼到台面。",
      qimenOverride: {
        pattern: "惊门临火，暗线先动",
        locationFocus: "外门山城",
        eventType: "试炼开局",
      },
    },
    goal: "写出外门试炼开局时，林焰、苏雪、韩渡围绕玄脉线索第一次正面咬合。",
    focus: ["林焰", "苏雪", "韩渡"],
  },
  {
    directive: {
      stageLabel: "丹谷异火",
      focusCharacterIds: ["苏雪", "韩渡"],
      intervention: "地火丹谷异火提前躁动，苏雪必须在门规和护人之间作出代价更高的选择。",
      qimenOverride: {
        pattern: "杜门藏伤，火中见水",
        locationFocus: "地火丹谷",
        eventType: "暗线反压",
      },
    },
    goal: "承接上一章余波，写出丹谷异火失控前夜，苏雪守规矩与越线护人的矛盾被韩渡利用。",
    focus: ["苏雪", "韩渡", "林焰"],
  },
  {
    directive: {
      stageLabel: "玄脉暗潮",
      focusCharacterIds: ["林焰", "韩渡"],
      intervention: "玄脉坐标露出第二层假象，韩渡设局逼林焰主动暴露赤纹残图。",
      qimenOverride: {
        pattern: "开门见伏，生门反噬",
        locationFocus: "玄脉旧井",
        eventType: "反转追索",
      },
    },
    goal: "写出玄脉坐标真假互套的一轮反转，让林焰的成长、韩渡的野心和苏雪的代价同时向下一章施压。",
    focus: ["林焰", "韩渡", "苏雪"],
  },
];

function parseChapterCount(): number {
  const arg = process.argv.find((item) => item.startsWith("--chapters="));
  const parsed = Number.parseInt(arg?.split("=")[1] ?? "2", 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, chapterDirectives.length)) : 2;
}

function parseFromChapter(): number {
  const arg = process.argv.find((item) => item.startsWith("--from="));
  const parsed = Number.parseInt(arg?.split("=")[1] ?? "1", 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, chapterDirectives.length)) : 1;
}

function parseOutputRoot(stamp: string): string {
  const arg = process.argv.find((item) => item.startsWith("--outputRoot="));
  return arg?.slice("--outputRoot=".length) || join(process.cwd(), ".novel-system", "live-eval", stamp);
}

function evaluateChapter(input: {
  chapter: number;
  stageId: string;
  title: string;
  draft: NarrativeDraft;
  targetLength: [number, number];
  focus: string[];
}): ChapterEval {
  const text = input.draft.chapterText;
  const paragraphs = text.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const checks: Array<[string, boolean]> = [
    ["length within lens target", text.length >= input.targetLength[0] && text.length <= input.targetLength[1]],
    ["reviewer passed", input.draft.review.passed],
    ["fact coverage >= 0.7", input.draft.review.factCoverage >= 0.7],
    ["has multiple prose paragraphs", paragraphs.length >= 6],
    ["has scene drafts", input.draft.sceneDrafts.length >= 4],
    ["contains focus characters", input.focus.every((name) => text.includes(name))],
    ["no visible scene-card headings", !/[【\[]?第[一二三四五六七八九十0-9]+场/.test(text)],
    ["no engineering markers", !/(scene-\d|transitionIn|transitionOut|focusCue|softExpansion|硬事实|已发生状态|```|JSON)/i.test(text)],
    ["has chapter-level forward pull", /(下一章|再退|来不及|没有结束|还没有|真正|逼|代价|余波|钩|裂|暗)/.test(text)],
  ];
  const passedChecks = checks.filter(([, passed]) => passed).map(([label]) => label);
  const failedChecks = checks.filter(([, passed]) => !passed).map(([label]) => label);
  const warnings = [
    ...input.draft.review.warnings,
    ...input.draft.review.issues.map((issue) => `issue: ${issue}`),
  ];
  const score = passedChecks.length;
  const verdict =
    score >= 8 && warnings.length <= 2
      ? "normal-chapter"
      : score >= 6
        ? "usable-with-fixes"
        : "not-normal";
  return {
    chapter: input.chapter,
    stageId: input.stageId,
    title: input.title,
    length: text.length,
    paragraphs: paragraphs.length,
    sceneDrafts: input.draft.sceneDrafts.length,
    reviewerPassed: input.draft.review.passed,
    factCoverage: input.draft.review.factCoverage,
    score,
    maxScore: checks.length,
    verdict,
    passedChecks,
    failedChecks,
    warnings,
  };
}

function chapterMarkdown(input: {
  chapter: number;
  directive: StageDirective;
  lens: NarrativeLens;
  draft: NarrativeDraft;
  evaluation: ChapterEval;
}): string {
  return [
    `# Chapter ${input.chapter}: ${input.directive.stageLabel}`,
    "",
    "## Lens",
    "",
    JSON.stringify(input.lens, null, 2),
    "",
    "## Plan",
    "",
    JSON.stringify(input.draft.plan, null, 2),
    "",
    "## Scene Summaries",
    "",
    ...input.draft.sceneSummaries.map((summary) => `- ${summary}`),
    "",
    "## Provider Review",
    "",
    JSON.stringify(input.draft.review, null, 2),
    "",
    "## Rubric Evaluation",
    "",
    JSON.stringify(input.evaluation, null, 2),
    "",
    "## Chapter Text",
    "",
    input.draft.chapterText,
    "",
  ].join("\n");
}

async function main() {
  const chapters = parseChapterCount();
  const fromChapter = parseFromChapter();
  const sample = await readFile(join(process.cwd(), "examples", "sample-world.md"), "utf8");
  const engine = new WorldHistoryEngine(parseWorldDraft(sample));
  const config = resolveDeepSeekConfig();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputRoot = parseOutputRoot(stamp);
  await mkdir(outputRoot, { recursive: true });
  const memoryStore = await StoryMemoryStore.create({ rootDir: outputRoot });
  const evaluations: ChapterEval[] = [];
  const chapterFiles: string[] = [];

  console.log(
    JSON.stringify(
      {
        outputRoot,
        chapters,
        fromChapter,
        model: config.model,
        thinkingMode: config.thinkingMode,
        reasoningEffort: config.reasoningEffort,
      },
      null,
      2,
    ),
  );

  for (let index = 0; index < chapters; index += 1) {
    const chapter = chapterDirectives[index];
    const stageResult = engine.runStage(chapter.directive);
    const line = engine.getCanonLine();
    await memoryStore.syncFactsFromLine(line);
    if (index + 1 < fromChapter) {
      console.log(`chapter ${index + 1}: skipped drafting ${chapter.directive.stageLabel}`);
      continue;
    }
    const memoryPack = await memoryStore.readMemoryPack({
      lineId: line.lineId,
      focusCharacterIds: chapter.focus,
      stageIds: [],
    });
    const targetLength: [number, number] = [2800, 3300];
    const lens: NarrativeLens = {
      focusCharacterIds: chapter.focus,
      style: "omniscient-web",
      narratorMode: "omniscient-ensemble",
      proseStyle: "web-xianxia-ensemble",
      stageRange: [stageResult.canonStage.id],
      chapterGoal: chapter.goal,
      sceneCount: 5,
      targetLength,
      factConstraint: "medium-expansion",
    };

    console.log(`chapter ${index + 1}: drafting ${chapter.directive.stageLabel}`);
    const draft = await draftNarrativeWithDeepSeek(
      {
        line,
        lens,
        memoryPack,
      },
      {
        maxRetries: 1,
      },
    );

    for (const scene of draft.sceneDrafts) {
      await memoryStore.writeExpression({
        lineId: line.lineId,
        stageId: stageResult.canonStage.id,
        sceneId: scene.sceneId,
        eventIds: draft.selectedEventIds,
        characterIds: chapter.focus,
        relationshipKeys: [],
        summary: scene.summary,
        text: scene.text,
        toneTags: ["web-xianxia", "ensemble"],
        voiceTags: ["omniscient"],
        conflictTags: [draft.plan.mainConflict, draft.plan.secondaryConflict],
        hookTags: [draft.plan.closingHook],
        source: draft.review.passed ? "critic-pass" : "author-final",
      });
    }

    const evaluation = evaluateChapter({
      chapter: index + 1,
      stageId: stageResult.canonStage.id,
      title: chapter.directive.stageLabel,
      draft,
      targetLength,
      focus: chapter.focus,
    });
    evaluations.push(evaluation);
    const file = join(outputRoot, `chapter-${index + 1}.md`);
    await writeFile(
      file,
      chapterMarkdown({
        chapter: index + 1,
        directive: chapter.directive,
        lens,
        draft,
        evaluation,
      }),
      "utf8",
    );
    chapterFiles.push(file);
    console.log(
      `chapter ${index + 1}: ${evaluation.verdict} ${evaluation.score}/${evaluation.maxScore}, length=${evaluation.length}, review=${evaluation.reviewerPassed}`,
    );
  }

  const report = [
    "# Live Multi-Chapter Evaluation",
    "",
    "## Config",
    "",
    JSON.stringify(
      {
        model: config.model,
        thinkingMode: config.thinkingMode,
        reasoningEffort: config.reasoningEffort,
      },
      null,
      2,
    ),
    "",
    "## Files",
    "",
    ...chapterFiles.map((file) => `- ${file}`),
    "",
    "## Evaluations",
    "",
    JSON.stringify(evaluations, null, 2),
    "",
  ].join("\n");
  const reportPath = join(outputRoot, "report.md");
  await writeFile(reportPath, report, "utf8");
  console.log(JSON.stringify({ reportPath, chapterFiles, evaluations }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
