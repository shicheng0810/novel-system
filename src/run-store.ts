import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { atomicWrite } from "./atomic-fs";

import type { StageDirective } from "./domain";
import type {
  ArtifactKind,
  ArtifactRef,
  SimulationRun,
  SimulationRunSummary,
  SimulationStep,
  SimulationStepKind,
} from "./runtime-types";

function nowIso(): string {
  return new Date().toISOString();
}

function runIdFromTime(): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `run-${stamp}-${suffix}`;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  // Per review · M (non-atomic writes): atomic rename prevents partial-write
  // corruption on SIGKILL/OOM mid-flush.
  await atomicWrite(path, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"));
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export type SimulationRunStoreConfig = {
  rootDir: string;
};

export type CreateRunInput = {
  worldId: string;
  lineId: string;
  directive: StageDirective;
  baseCanonStageId?: string;
};

export class SimulationRunStore {
  constructor(private readonly config: SimulationRunStoreConfig) {}

  get runsRoot(): string {
    return join(this.config.rootDir, "runs");
  }

  get checkpointsRoot(): string {
    return join(this.config.rootDir, "checkpoints");
  }

  async createRun(input: CreateRunInput): Promise<SimulationRun> {
    await mkdir(this.runsRoot, { recursive: true });
    await mkdir(this.checkpointsRoot, { recursive: true });

    const runId = runIdFromTime();
    const rootDir = join(this.runsRoot, runId);
    await mkdir(rootDir, { recursive: true });
    await Promise.all(
      ["input", "metaphysics", "simulation", "gate", "output"].map((directory) =>
        mkdir(join(rootDir, directory), { recursive: true }),
      ),
    );

    const createdAt = nowIso();
    const run: SimulationRun = {
      runId,
      worldId: input.worldId,
      lineId: input.lineId,
      baseCanonStageId: input.baseCanonStageId,
      status: "running",
      createdAt,
      updatedAt: createdAt,
      directive: input.directive,
      steps: [],
      artifacts: {
        rootDir,
        refs: [],
      },
    };

    await this.writeArtifact(run, {
      refId: "input.directive",
      relativePath: "input/directive.json",
      kind: "json",
      value: input.directive,
    });
    await this.saveRun(run);
    return run;
  }

  async saveRun(run: SimulationRun): Promise<void> {
    const updated: SimulationRun = { ...run, updatedAt: nowIso() };
    await writeJson(join(updated.artifacts.rootDir, "manifest.json"), updated);
    await writeJson(join(this.checkpointsRoot, `${updated.runId}.json`), updated);
  }

  async loadRun(runId: string): Promise<SimulationRun> {
    return readJson<SimulationRun>(join(this.runsRoot, runId, "manifest.json"));
  }

  async listRuns(): Promise<SimulationRunSummary[]> {
    await mkdir(this.runsRoot, { recursive: true });
    const entries = await readdir(this.runsRoot, { withFileTypes: true });
    const runs = await Promise.all(entries.filter((entry) => entry.isDirectory()).map((entry) => this.loadRun(entry.name)));
    return runs
      .map((run) => ({
        runId: run.runId,
        status: run.status,
        worldId: run.worldId,
        lineId: run.lineId,
        stageLabel: run.directive.stageLabel,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        stepCount: run.steps.length,
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async appendStep(run: SimulationRun, step: SimulationStep): Promise<SimulationRun> {
    const updated: SimulationRun = {
      ...run,
      steps: [...run.steps, step],
      updatedAt: nowIso(),
    };
    await this.saveRun(updated);
    return updated;
  }

  async startStep(run: SimulationRun, kind: SimulationStepKind): Promise<SimulationRun> {
    return this.appendStep(run, {
      stepId: `${run.runId}-${run.steps.length + 1}-${kind}`,
      kind,
      status: "started",
      startedAt: nowIso(),
      inputRefs: [],
      outputRefs: [],
    });
  }

  async completeLatestStep(run: SimulationRun, outputRefs: string[] = []): Promise<SimulationRun> {
    const steps = [...run.steps];
    const latest = steps.at(-1);
    if (!latest) {
      throw new Error(`Cannot complete step for run ${run.runId}: no step has started`);
    }
    steps[steps.length - 1] = {
      ...latest,
      status: "completed",
      endedAt: nowIso(),
      outputRefs,
    };
    const updated: SimulationRun = { ...run, steps, updatedAt: nowIso() };
    await this.saveRun(updated);
    return updated;
  }

  async markRun(run: SimulationRun, status: SimulationRun["status"]): Promise<SimulationRun> {
    const updated: SimulationRun = { ...run, status, updatedAt: nowIso() };
    await this.saveRun(updated);
    return updated;
  }

  async writeArtifact(
    run: SimulationRun,
    input: {
      refId: string;
      relativePath: string;
      kind: ArtifactKind;
      value: unknown;
    },
  ): Promise<ArtifactRef> {
    const artifact: ArtifactRef = {
      refId: input.refId,
      path: join(run.artifacts.rootDir, input.relativePath),
      kind: input.kind,
    };
    await mkdir(dirname(artifact.path), { recursive: true });

    if (input.kind === "json") {
      await writeJson(artifact.path, input.value);
    } else if (input.kind === "jsonl") {
      const lines = Array.isArray(input.value) ? input.value : [input.value];
      await writeFile(artifact.path, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`, "utf8");
    } else {
      await writeFile(artifact.path, String(input.value), "utf8");
    }

    if (!run.artifacts.refs.some((ref) => ref.refId === artifact.refId)) {
      run.artifacts.refs.push(artifact);
    }
    return artifact;
  }
}
