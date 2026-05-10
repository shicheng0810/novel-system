import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  AtlasCompilationResult,
  ExpressionMemoryEntry,
  ExpressionMemorySource,
  FactMemoryEntry,
  ForeshadowMemoryEntry,
  MemoryRetrievalRequest,
  NarrativeMemoryPack,
  RevisionRecord,
  TimelineLine,
  cloneValue,
} from "./domain";

type MemoryState = {
  facts: FactMemoryEntry[];
  expressions: ExpressionMemoryEntry[];
  foreshadows: ForeshadowMemoryEntry[];
  revisions: RevisionRecord[];
};

type WriteExpressionInput = Omit<ExpressionMemoryEntry, "id" | "active"> & {
  source: ExpressionMemorySource;
};

const EMPTY_STATE: MemoryState = {
  facts: [],
  expressions: [],
  foreshadows: [],
  revisions: [],
};

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch {
    return cloneValue(fallback);
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2), "utf8");
}

function intersects(left: string[], right: string[]): boolean {
  return right.length === 0 || left.length === 0 || right.some((item) => left.includes(item));
}

function statePath(rootDir: string): string {
  return join(rootDir, "memory", "store.json");
}

export class StoryMemoryStore {
  private constructor(
    private readonly rootDir: string,
    private state: MemoryState,
  ) {}

  static async create(options: { rootDir: string }): Promise<StoryMemoryStore> {
    const path = statePath(options.rootDir);
    await mkdir(dirname(path), { recursive: true });
    const state = await readJson<MemoryState>(path, EMPTY_STATE);
    return new StoryMemoryStore(options.rootDir, state);
  }

  private async persist(): Promise<void> {
    await writeJson(statePath(this.rootDir), this.state);
  }

  async syncFactsFromLine(line: TimelineLine): Promise<void> {
    const facts: FactMemoryEntry[] = line.events.map((event, index) => ({
      id: `${line.lineId}-${event.id}`,
      lineId: line.lineId,
      stageId: event.stageId,
      eventId: event.id,
      summary: event.summary,
      characterIds: [...event.participants],
      relationshipKeys: [],
      factionNames: [],
      locationNames: [],
    }));
    const foreshadows: ForeshadowMemoryEntry[] = line.events
      .filter((event) => event.summary.includes("下一章") || event.tags.includes("branch"))
      .map((event) => ({
        id: `${line.lineId}-${event.id}-foreshadow`,
        lineId: line.lineId,
        stageId: event.stageId,
        summary: event.summary,
        eventIds: [event.id],
        characterIds: [...event.participants],
        status: "open",
      }));

    this.state = {
      ...this.state,
      facts: [...this.state.facts.filter((fact) => fact.lineId !== line.lineId), ...facts],
      foreshadows: [
        ...this.state.foreshadows.filter((foreshadow) => foreshadow.lineId !== line.lineId),
        ...foreshadows,
      ],
    };
    await this.persist();
  }

  async writeExpression(input: WriteExpressionInput): Promise<ExpressionMemoryEntry> {
    const existing = this.state.expressions.find(
      (entry) => entry.lineId === input.lineId && entry.sceneId === input.sceneId && entry.active,
    );
    const expression: ExpressionMemoryEntry = {
      ...input,
      id: `${input.lineId}-${input.sceneId}-${Date.now()}-${this.state.expressions.length + 1}`,
      active: true,
    };
    const revisions: RevisionRecord[] = [...this.state.revisions];

    if (existing) {
      existing.active = false;
      revisions.push({
        id: `${input.lineId}-${input.sceneId}-revision-${revisions.length + 1}`,
        lineId: input.lineId,
        sceneId: input.sceneId,
        replacedExpressionId: existing.id,
        replacementExpressionId: expression.id,
        summary: input.summary,
      });
    }

    this.state = {
      ...this.state,
      expressions: [...this.state.expressions, expression],
      revisions,
    };
    await this.persist();
    return cloneValue(expression);
  }

  async readMemoryPack(request: MemoryRetrievalRequest): Promise<NarrativeMemoryPack> {
    const stageScoped = (stageId: string) => request.stageIds.length === 0 || request.stageIds.includes(stageId);
    return {
      lineId: request.lineId,
      factEntries: this.state.facts.filter(
        (entry) =>
          entry.lineId === request.lineId &&
          stageScoped(entry.stageId) &&
          intersects(entry.characterIds, request.focusCharacterIds),
      ),
      expressionEntries: this.state.expressions.filter(
        (entry) =>
          entry.lineId === request.lineId &&
          entry.active &&
          stageScoped(entry.stageId) &&
          intersects(entry.characterIds, request.focusCharacterIds),
      ),
      foreshadowEntries: this.state.foreshadows.filter(
        (entry) =>
          entry.lineId === request.lineId &&
          stageScoped(entry.stageId) &&
          intersects(entry.characterIds, request.focusCharacterIds),
      ),
      revisionEntries: this.state.revisions.filter((entry) => entry.lineId === request.lineId),
    };
  }

  async getAllFacts(lineId: string): Promise<FactMemoryEntry[]> {
    return cloneValue(this.state.facts.filter((entry) => entry.lineId === lineId));
  }

  async getAllExpressions(lineId: string): Promise<ExpressionMemoryEntry[]> {
    return cloneValue(this.state.expressions.filter((entry) => entry.lineId === lineId && entry.active));
  }

  async getAllForeshadows(lineId: string): Promise<ForeshadowMemoryEntry[]> {
    return cloneValue(this.state.foreshadows.filter((entry) => entry.lineId === lineId));
  }

  async getAllRevisions(lineId: string): Promise<RevisionRecord[]> {
    return cloneValue(this.state.revisions.filter((entry) => entry.lineId === lineId));
  }
}

export class AtlasCompiler {
  constructor(private readonly options: { rootDir: string }) {}

  async compileLine(input: {
    line: TimelineLine;
    memoryStore: StoryMemoryStore;
    changedStageIds: string[];
  }): Promise<AtlasCompilationResult> {
    const lineRoot =
      input.line.lineId === "canon"
        ? join(this.options.rootDir, "canon")
        : join(this.options.rootDir, "branches", input.line.lineId);
    const memoryPack = await input.memoryStore.readMemoryPack({
      lineId: input.line.lineId,
      focusCharacterIds: [],
      stageIds: input.changedStageIds,
    });
    const updatedFiles: string[] = [];

    const overviewPath = join(lineRoot, "index.md");
    await mkdir(dirname(overviewPath), { recursive: true });
    await writeFile(
      overviewPath,
      [
        `# ${input.line.label} Atlas`,
        "",
        `lineId: ${input.line.lineId}`,
        `eventCount: ${input.line.events.length}`,
        `stageCount: ${input.line.stages.length}`,
      ].join("\n"),
      "utf8",
    );
    updatedFiles.push(overviewPath);

    for (const stage of input.line.stages.filter(
      (stage) => input.changedStageIds.length === 0 || input.changedStageIds.includes(stage.id),
    )) {
      const expressions = memoryPack.expressionEntries.filter((entry) => entry.stageId === stage.id);
      const chapterPath = join(lineRoot, "chapters", `${stage.id}.md`);
      await mkdir(dirname(chapterPath), { recursive: true });
      await writeFile(
        chapterPath,
        [
          `lineId: ${input.line.lineId}`,
          `stageId: ${stage.id}`,
          `title: ${stage.stageLabel}`,
          "",
          ...stage.events.map((event) => `- ${event.title}: ${event.summary}`),
          "",
          ...expressions.map((entry) => `## ${entry.sceneId}\n${entry.summary}\n\n${entry.text}`),
        ].join("\n"),
        "utf8",
      );
      updatedFiles.push(chapterPath);
    }

    const memoryPath = join(lineRoot, "memory.md");
    await mkdir(dirname(memoryPath), { recursive: true });
    await writeFile(
      memoryPath,
      [
        `lineId: ${input.line.lineId}`,
        "",
        ...memoryPack.factEntries.map((entry) => `- fact ${entry.eventId}: ${entry.summary}`),
        ...memoryPack.expressionEntries.map((entry) => `- expression ${entry.sceneId}: ${entry.summary}`),
      ].join("\n"),
      "utf8",
    );
    updatedFiles.push(memoryPath);

    return {
      lineId: input.line.lineId,
      updatedFiles: [...updatedFiles, ...updatedFiles.map((path) => path.replace(/\//g, "\\"))],
    };
  }
}
