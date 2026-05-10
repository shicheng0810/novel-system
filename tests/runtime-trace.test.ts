import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { SimulationRunStore } from "../src/run-store";
import { RuntimeTrace } from "../src/runtime-trace";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("RuntimeTrace", () => {
  test("records events and writes a runtime trace artifact", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "runtime-trace-"));
    tempDirs.push(rootDir);
    const runStore = new SimulationRunStore({ rootDir });
    const run = await runStore.createRun({
      worldId: "world-a",
      lineId: "canon",
      directive: { stageLabel: "外门试炼", focusCharacterIds: ["林焰"] },
    });
    const trace = new RuntimeTrace();

    trace.event("session-sync", "session replace", { mode: "replace" });
    const refs = await trace.writeArtifacts(runStore, run);

    expect(refs[0].refId).toBe("runtime.trace");
    const traceFile = await readFile(refs[0].path, "utf8");
    expect(traceFile).toContain("\"type\":\"session-sync\"");
    expect(trace.toJSONL()).toContain("\"message\":\"session replace\"");
    const saved = await runStore.loadRun(run.runId);
    expect(saved.artifacts.refs.some((ref) => ref.refId === "runtime.trace")).toBe(true);
  });
});
