import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { emitCanonVerdict, emitComposeStage } from "../src/world-events/emit";
import {
  closeWorldEvents,
  setWorldEventsDbPath,
} from "../src/world-events/store";
import {
  handleWorldEventsRequest,
  parseWorldEventsQuery,
} from "../src/world-events/route";

const tempDirs: string[] = [];

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), "world-events-route-"));
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

describe("/api/world-events route", () => {
  test("no params: returns all events newest-first", () => {
    emitComposeStage({ runId: "r1", chapterId: "c1", stage: "memory-read", status: "succeeded", summary: "a" });
    emitComposeStage({ runId: "r1", chapterId: "c1", stage: "blueprint", status: "succeeded", summary: "b" });
    const result = handleWorldEventsRequest(new URLSearchParams(""));
    expect(result.events.length).toBe(2);
  });

  test("chapterId filter narrows result", () => {
    emitComposeStage({ runId: "r1", chapterId: "c1", stage: "memory-read", status: "succeeded", summary: "a" });
    emitComposeStage({ runId: "r2", chapterId: "c2", stage: "memory-read", status: "succeeded", summary: "b" });
    const filtered = handleWorldEventsRequest(new URLSearchParams("chapterId=c2"));
    expect(filtered.events.map((e) => e.chapterId)).toEqual(["c2"]);
  });

  test("severity CSV unwraps to array filter", () => {
    emitCanonVerdict({ runId: "rA", verdict: "accepted", summary: "ok", verdictId: "v1" });
    emitCanonVerdict({ runId: "rB", verdict: "rejected", summary: "bad", verdictId: "v2" });
    emitCanonVerdict({ runId: "rC", verdict: "paused-on-risk", summary: "hi", verdictId: "v3" });

    const filter = parseWorldEventsQuery(
      new URLSearchParams("severity=decision-required,notable"),
    );
    expect(filter.severity).toEqual(["decision-required", "notable"]);

    const result = handleWorldEventsRequest(
      new URLSearchParams("severity=decision-required"),
    );
    expect(result.events.every((e) => e.severity === "decision-required")).toBe(
      true,
    );
    expect(result.events.length).toBe(2);
  });
});
