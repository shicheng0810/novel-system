import { dirname, join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { DEFAULT_DEEPSEEK_PROFILE, type DeepSeekModelProfile } from "./deepseek-profile";

export type ReadingSourceType = "fiction" | "craft";
export type ReadingLanguage = "en" | "zh" | "mixed";
export type ReadingStatus = "full_text" | "needs_legal_copy";

export type ReadingQueueEntry = {
  queueId: string;
  sourceType: ReadingSourceType;
  language: ReadingLanguage;
  title: string;
  author: string;
  sourcePath: string;
  status: ReadingStatus;
};

export type ReadingQueueSummary = {
  total: number;
  fullText: number;
  needsLegalCopy: number;
  bySourceType: Record<ReadingSourceType, number>;
  byLanguage: Record<ReadingLanguage, number>;
};

export type ReadingBatchPlan = {
  batchId: string;
  entries: ReadingQueueEntry[];
  objective: string;
};

export type ReadingArtifactWriteResult = {
  artifactCount: number;
  manifestPath: string;
  batchPath: string;
  promptPath: string;
  artifactRoot: string;
};

const QUEUE_HEADER = ["queue_id", "source_type", "language", "title", "author", "source_path", "status"];

const FICTION_SECTIONS = [
  "Narrative Engine",
  "World Logic",
  "Character System",
  "Relationship Net",
  "Scene Mechanics",
  "Reader Retention Devices",
  "Style And Voice",
  "Agent Rules",
  "CanonGate Checks",
];

const CRAFT_SECTIONS = [
  "Core Thesis",
  "Actionable Rules",
  "Failure Modes",
  "Diagnostic Questions",
  "Revision Heuristics",
  "Agent Rules",
  "CanonGate Checks",
];

function asSourceType(value: string): ReadingSourceType {
  if (value === "fiction" || value === "craft") {
    return value;
  }
  throw new Error(`Unsupported source_type: ${value}`);
}

function asLanguage(value: string): ReadingLanguage {
  if (value === "en" || value === "zh" || value === "mixed") {
    return value;
  }
  throw new Error(`Unsupported language: ${value}`);
}

function asStatus(value: string): ReadingStatus {
  if (value === "full_text" || value === "needs_legal_copy") {
    return value;
  }
  throw new Error(`Unsupported status: ${value}`);
}

function escapeYaml(value: string): string {
  return JSON.stringify(value);
}

function artifactId(entry: ReadingQueueEntry): string {
  return entry.queueId.replace(/:/g, "-");
}

export function parseReadingQueueTsv(text: string): ReadingQueueEntry[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const header = lines[0].split("\t");
  if (header.join("\t") !== QUEUE_HEADER.join("\t")) {
    throw new Error(`Unexpected reading queue header: ${header.join(", ")}`);
  }

  return lines.slice(1).map((line, index) => {
    const fields = line.split("\t");
    if (fields.length !== QUEUE_HEADER.length) {
      throw new Error(`Invalid reading queue row ${index + 2}: expected ${QUEUE_HEADER.length} fields`);
    }
    return {
      queueId: fields[0],
      sourceType: asSourceType(fields[1]),
      language: asLanguage(fields[2]),
      title: fields[3],
      author: fields[4],
      sourcePath: fields[5],
      status: asStatus(fields[6]),
    };
  });
}

export function summarizeReadingQueue(entries: ReadingQueueEntry[]): ReadingQueueSummary {
  const summary: ReadingQueueSummary = {
    total: entries.length,
    fullText: 0,
    needsLegalCopy: 0,
    bySourceType: { fiction: 0, craft: 0 },
    byLanguage: { en: 0, zh: 0, mixed: 0 },
  };

  for (const entry of entries) {
    if (entry.status === "full_text") {
      summary.fullText += 1;
    } else {
      summary.needsLegalCopy += 1;
    }
    summary.bySourceType[entry.sourceType] += 1;
    summary.byLanguage[entry.language] += 1;
  }

  return summary;
}

export function fullTextEntries(entries: ReadingQueueEntry[]): ReadingQueueEntry[] {
  return entries.filter((entry) => entry.status === "full_text" && entry.sourcePath.trim().length > 0);
}

export function artifactPathFor(entry: ReadingQueueEntry, artifactRoot: string): string {
  return join(artifactRoot, `${artifactId(entry)}.md`);
}

function sectionTemplate(section: string): string {
  return [`## ${section}`, "", "- Pending extraction.", ""].join("\n");
}

export function buildReadingArtifactMarkdown(entry: ReadingQueueEntry): string {
  const sections = entry.sourceType === "fiction" ? FICTION_SECTIONS : CRAFT_SECTIONS;
  return [
    "---",
    `artifact_id: ${escapeYaml(artifactId(entry))}`,
    `queue_id: ${escapeYaml(entry.queueId)}`,
    `source_title: ${escapeYaml(entry.title)}`,
    `author: ${escapeYaml(entry.author)}`,
    `language: ${escapeYaml(entry.language)}`,
    `source_type: ${escapeYaml(entry.sourceType)}`,
    `source_path: ${escapeYaml(entry.sourcePath)}`,
    `analysis_depth: "first_pass"`,
    `legal_status: ${escapeYaml(entry.status)}`,
    `status: "pending_extraction"`,
    "---",
    "",
    `# ${entry.title}`,
    "",
    "This artifact is a structured extraction target for the long-form novel agent.",
    "It should be filled from the local full text without copying long source passages.",
    "",
    ...sections.flatMap((section) => sectionTemplate(section).split("\n")),
    "## Agent Consumption",
    "",
    "- WorldDaemon inputs: pending.",
    "- SimulationRun inputs: pending.",
    "- CanonGate inputs: pending.",
    "- Memory items: pending.",
    "",
  ].join("\n");
}

export function buildDefaultBatch(entries: ReadingQueueEntry[], batchId = "batch-001"): ReadingBatchPlan {
  const full = fullTextEntries(entries);
  const english = full.filter((entry) => entry.sourceType === "fiction" && entry.language === "en").slice(0, 8);
  const chinese = full.filter((entry) => entry.sourceType === "fiction" && entry.language === "zh").slice(0, 8);
  const craft = full.filter((entry) => entry.sourceType === "craft").slice(0, 4);
  return {
    batchId,
    entries: [...english, ...chinese, ...craft],
    objective:
      "Establish the first bilingual comparative pass: English plot/scene craft, Chinese fate-world-relationship logic, and public-domain craft vocabulary.",
  };
}

export function buildBatchTsv(batch: ReadingBatchPlan, artifactRoot: string): string {
  return [
    ["batch_id", "queue_id", "source_type", "language", "title", "author", "source_path", "artifact_path"].join("\t"),
    ...batch.entries.map((entry) =>
      [
        batch.batchId,
        entry.queueId,
        entry.sourceType,
        entry.language,
        entry.title,
        entry.author,
        entry.sourcePath,
        artifactPathFor(entry, artifactRoot),
      ].join("\t"),
    ),
  ].join("\n");
}

export function buildArtifactManifestTsv(entries: ReadingQueueEntry[], artifactRoot: string): string {
  const full = fullTextEntries(entries);
  return [
    ["artifact_id", "queue_id", "source_type", "language", "title", "author", "source_path", "artifact_path", "status"].join(
      "\t",
    ),
    ...full.map((entry) =>
      [
        artifactId(entry),
        entry.queueId,
        entry.sourceType,
        entry.language,
        entry.title,
        entry.author,
        entry.sourcePath,
        artifactPathFor(entry, artifactRoot),
        "pending_extraction",
      ].join("\t"),
    ),
  ].join("\n");
}

export function assertDeepSeekLongContextProfile(profile: DeepSeekModelProfile = DEFAULT_DEEPSEEK_PROFILE): void {
  if (!profile.model.toLowerCase().startsWith("deepseek-v4-")) {
    throw new Error(`Reading extraction requires a DeepSeek V4 profile, got ${profile.model}`);
  }
  if (profile.contextWindowTokens < 1_000_000) {
    throw new Error(`Reading extraction requires at least 1M context tokens, got ${profile.contextWindowTokens}`);
  }
  if (profile.reasoningEffort !== "high" && profile.reasoningEffort !== "max") {
    throw new Error(`Reading extraction requires high or max reasoning effort, got ${profile.reasoningEffort}`);
  }
}

export function buildDeepSeekBatchPrompt(batch: ReadingBatchPlan): string {
  assertDeepSeekLongContextProfile();
  return [
    "# DeepSeek V4 Pro 1M Reading Extraction Prompt",
    "",
    "Use the configured DeepSeek V4 Pro profile with high reasoning effort and the 1M context window.",
    "The task is not generic summary. Produce structured reading artifacts that can improve a long-form novel agent.",
    "",
    `Batch: ${batch.batchId}`,
    `Objective: ${batch.objective}`,
    "",
    "For each source, read the local full text and fill the artifact sections already generated for that source.",
    "Do not copy long passages. Quote only tiny phrases when necessary for evidence.",
    "",
    "Extraction priorities:",
    "",
    "1. Preserve cross-chapter causality and delayed payoff.",
    "2. Extract reusable craft rules without imitating prose.",
    "3. Track world logic, social pressure, relationship debt, fate signals, and taboo rules.",
    "4. Convert findings into WorldDaemon, SimulationRun, CanonGate, and Memory inputs.",
    "5. Mark uncertain claims instead of inventing evidence.",
    "",
    "Batch sources:",
    "",
    ...batch.entries.map((entry, index) =>
      [
        `## ${index + 1}. ${entry.title}`,
        "",
        `- queue_id: ${entry.queueId}`,
        `- author: ${entry.author}`,
        `- language: ${entry.language}`,
        `- source_path: ${entry.sourcePath}`,
        `- artifact_path: ${artifactPathFor(entry, "corpus/derived/reading-artifacts/first-pass")}`,
        "",
      ].join("\n"),
    ),
  ].join("\n");
}

export async function writeReadingArtifacts(input: {
  queuePath: string;
  outputRoot: string;
  batchId?: string;
}): Promise<ReadingArtifactWriteResult> {
  const queueText = await readFile(input.queuePath, "utf8");
  const entries = parseReadingQueueTsv(queueText);
  const artifactRoot = join(input.outputRoot, "first-pass");
  await mkdir(artifactRoot, { recursive: true });

  const full = fullTextEntries(entries);
  for (const entry of full) {
    const outputPath = artifactPathFor(entry, artifactRoot);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, buildReadingArtifactMarkdown(entry), "utf8");
  }

  const manifestPath = join(input.outputRoot, "manifest.tsv");
  await writeFile(manifestPath, `${buildArtifactManifestTsv(entries, artifactRoot)}\n`, "utf8");

  const batch = buildDefaultBatch(entries, input.batchId);
  const batchPath = join(input.outputRoot, `${batch.batchId}.tsv`);
  await writeFile(batchPath, `${buildBatchTsv(batch, artifactRoot)}\n`, "utf8");

  const promptPath = join(input.outputRoot, `${batch.batchId}-deepseek-prompt.md`);
  await writeFile(promptPath, `${buildDeepSeekBatchPrompt(batch)}\n`, "utf8");

  return {
    artifactCount: full.length,
    manifestPath,
    batchPath,
    promptPath,
    artifactRoot,
  };
}
