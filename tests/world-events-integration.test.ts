import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  emitCanonVerdict,
  emitComposeStage,
  emitConfirmFinalCascade,
  emitMemoryWrite,
  emitPause,
  emitPromotion,
  emitRuntimeTick,
  emitSimulationStep,
} from "../src/world-events/emit";
import {
  closeWorldEvents,
  queryWorldEvents,
  setWorldEventsDbPath,
} from "../src/world-events/store";
import { SIX_STAGE_ORDER } from "../src/world-events/verbs";

const tempDirs: string[] = [];

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), "world-events-integration-"));
  tempDirs.push(dir);
  setWorldEventsDbPath(join(dir, "events.sqlite"));
});

afterEach(async () => {
  closeWorldEvents();
  setWorldEventsDbPath(null);
  await Promise.all(
    tempDirs.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("world-events emit integration", () => {
  test("six compose stages each produce a started + succeeded event", () => {
    const runId = "run-001";
    const chapterId = "chap-1";
    for (const stage of SIX_STAGE_ORDER) {
      emitComposeStage({ runId, chapterId, stage, status: "started", summary: `${stage} 开始` });
      emitComposeStage({ runId, chapterId, stage, status: "succeeded", summary: `${stage} 完成` });
    }
    const events = queryWorldEvents({ subsystem: ["compose"], runId, limit: 100 });
    expect(events.length).toBe(SIX_STAGE_ORDER.length * 2);
    const succeededPhases = events
      .filter((e) => e.status === "succeeded")
      .map((e) => e.phase)
      .sort();
    expect(succeededPhases).toEqual([...SIX_STAGE_ORDER].sort());
  });

  test("confirm-final cascade emits a single notable summary event", () => {
    emitConfirmFinalCascade({
      runId: "run-2",
      chapterId: "chap-2",
      summary: "终稿入史 · 记忆 +7",
      refs: { sceneCount: 7 },
    });
    const events = queryWorldEvents({ subsystem: ["compose"], runId: "run-2" });
    const cascade = events.find((e) => e.phase === "confirm-final");
    expect(cascade).toBeTruthy();
    expect(cascade?.severity).toBe("notable");
    expect(cascade?.refs).toMatchObject({ sceneCount: 7 });
  });

  test("canon verdict routes severity by result", () => {
    emitCanonVerdict({ runId: "rA", verdict: "accepted", summary: "通过", verdictId: "vA" });
    emitCanonVerdict({ runId: "rB", verdict: "rejected", summary: "拒绝", verdictId: "vB" });
    emitCanonVerdict({ runId: "rC", verdict: "paused-on-risk", summary: "高风险", verdictId: "vC" });
    const events = queryWorldEvents({ subsystem: ["canon"], limit: 10 });
    const bySeverity = Object.fromEntries(events.map((e) => [e.runId, e.severity]));
    expect(bySeverity).toEqual({
      rA: "notable",
      rB: "decision-required",
      rC: "decision-required",
    });
  });

  test("memory + promotion + pause + runtime tick + simulation step all land", () => {
    emitMemoryWrite({ chapterId: "chap-3", count: 3, breakdown: "伏笔" });
    emitPromotion({ branchId: "branch-X", refs: { reason: "approved" } });
    emitPause({ runId: "rP", reason: "需作者裁决", severity: "decision-required" });
    emitRuntimeTick({ runId: "rT", phase: "started", tickIndex: 1, summary: "tick 1" });
    emitSimulationStep({ runId: "rS", stepIndex: 1, summary: "sim step 1" });
    const subsystems = queryWorldEvents({ limit: 100 }).map((e) => e.subsystem).sort();
    expect(subsystems).toEqual(["memory", "pause", "promotion", "runtime", "runtime"]);
  });

  test("query with severity=decision-required surfaces only blocked items", () => {
    emitCanonVerdict({ runId: "x1", verdict: "accepted", summary: "ok", verdictId: "v1" });
    emitCanonVerdict({ runId: "x2", verdict: "rejected", summary: "bad", verdictId: "v2" });
    emitPause({ runId: "x3", reason: "stop", severity: "decision-required" });
    const decisions = queryWorldEvents({ severity: ["decision-required"] });
    expect(decisions.length).toBe(2);
    expect(decisions.every((e) => e.severity === "decision-required")).toBe(true);
  });
});
