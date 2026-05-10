import { describe, expect, test } from "vitest";

import {
  assertDeepSeekLongContextProfile,
  buildDefaultBatch,
  buildDeepSeekBatchPrompt,
  buildReadingArtifactMarkdown,
  parseReadingQueueTsv,
  summarizeReadingQueue,
} from "../src/reading-artifacts";
import { DEFAULT_DEEPSEEK_PROFILE } from "../src/deepseek-profile";

const sampleQueue = [
  "queue_id\tsource_type\tlanguage\ttitle\tauthor\tsource_path\tstatus",
  "fiction_en:frankenstein\tfiction\ten\tFrankenstein\tMary Shelley\tcorpus/raw/gutenberg/frankenstein.txt\tfull_text",
  "fiction_zh:hongloumeng\tfiction\tzh\t紅樓夢\t曹雪芹\tcorpus/raw/gutenberg-zh/hongloumeng.txt\tfull_text",
  "craft:craft-001\tcraft\tmixed\tPoetics\tAristotle\tcorpus/raw/writing-craft/poetics-aristotle.txt\tfull_text",
  "craft:craft-012\tcraft\tmixed\tModern Book\tExample\t\tneeds_legal_copy",
].join("\n");

describe("reading artifacts", () => {
  test("parses and summarizes the reading queue", () => {
    const entries = parseReadingQueueTsv(sampleQueue);
    const summary = summarizeReadingQueue(entries);

    expect(entries).toHaveLength(4);
    expect(summary.fullText).toBe(3);
    expect(summary.needsLegalCopy).toBe(1);
    expect(summary.byLanguage.zh).toBe(1);
    expect(summary.bySourceType.craft).toBe(2);
  });

  test("generates a fiction artifact skeleton with agent sections", () => {
    const [entry] = parseReadingQueueTsv(sampleQueue);
    const markdown = buildReadingArtifactMarkdown(entry);

    expect(markdown).toContain('artifact_id: "fiction_en-frankenstein"');
    expect(markdown).toContain("## Narrative Engine");
    expect(markdown).toContain("## World Logic");
    expect(markdown).toContain("## CanonGate Checks");
    expect(markdown).toContain("WorldDaemon inputs");
  });

  test("builds a mixed first batch from available full text sources", () => {
    const entries = parseReadingQueueTsv(sampleQueue);
    const batch = buildDefaultBatch(entries);

    expect(batch.entries.map((entry) => entry.queueId)).toEqual([
      "fiction_en:frankenstein",
      "fiction_zh:hongloumeng",
      "craft:craft-001",
    ]);
  });

  test("requires DeepSeek V4 1M with high reasoning for batch prompts", () => {
    expect(() => assertDeepSeekLongContextProfile(DEFAULT_DEEPSEEK_PROFILE)).not.toThrow();
    expect(() =>
      assertDeepSeekLongContextProfile({
        ...DEFAULT_DEEPSEEK_PROFILE,
        model: "deepseek-reasoner",
      }),
    ).toThrow(/DeepSeek V4/);
  });

  test("generates a DeepSeek batch prompt that targets structured artifacts", () => {
    const batch = buildDefaultBatch(parseReadingQueueTsv(sampleQueue));
    const prompt = buildDeepSeekBatchPrompt(batch);

    expect(prompt).toContain("DeepSeek V4 Pro 1M");
    expect(prompt).toContain("WorldDaemon, SimulationRun, CanonGate, and Memory");
    expect(prompt).toContain("corpus/raw/gutenberg-zh/hongloumeng.txt");
  });
});
