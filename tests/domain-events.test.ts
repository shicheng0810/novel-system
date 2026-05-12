import { describe, expect, test } from "vitest";

import {
  PHASE_VERBS,
  PHASE_VERBS_ACTIVE,
  SUBSYSTEM_VERBS,
  makeEventId,
  phaseVerb,
  subsystemVerb,
  type EventSubsystem,
  type TickPhase,
} from "../src/domain/events";
import {
  emptySnapshot,
  cloneSnapshot,
} from "../src/domain/world";
import {
  evaluateAnchorViolations,
  riskFromViolations,
} from "../src/domain/canon";

describe("v3 domain events", () => {
  test("makeEventId is deterministic and idempotent", () => {
    const a = makeEventId({
      subsystem: "compose",
      runId: "r1",
      phase: "synthesize",
      sourceRef: "scene-3",
    });
    const b = makeEventId({
      subsystem: "compose",
      runId: "r1",
      phase: "synthesize",
      sourceRef: "scene-3",
    });
    expect(a).toBe(b);
    expect(a).toContain("compose");
    expect(a).toContain("r1");
  });

  test("PHASE_VERBS covers every TickPhase", () => {
    const phases: TickPhase[] = [
      "frame",
      "agents",
      "branches",
      "gate",
      "commit",
      "memory-read",
      "blueprint",
      "scene-cards",
      "synthesize",
      "review",
      "inscribe",
    ];
    for (const phase of phases) {
      expect(PHASE_VERBS[phase]).toBeTruthy();
      expect(PHASE_VERBS_ACTIVE[phase]).toBeTruthy();
      expect(phaseVerb(phase)).toBe(PHASE_VERBS[phase]);
      expect(phaseVerb(phase, true)).toBe(PHASE_VERBS_ACTIVE[phase]);
    }
  });

  test("SUBSYSTEM_VERBS covers every EventSubsystem", () => {
    const subsystems: EventSubsystem[] = [
      "runtime",
      "frame",
      "agents",
      "branches",
      "gate",
      "commit",
      "compose",
      "memory",
      "atlas",
      "promotion",
      "pause",
      "qimen",
      "character-agent",
    ];
    for (const sub of subsystems) {
      expect(SUBSYSTEM_VERBS[sub]).toBeTruthy();
      expect(subsystemVerb(sub)).toBe(SUBSYSTEM_VERBS[sub]);
    }
  });
});

describe("v3 domain world", () => {
  test("emptySnapshot has the world id and zero state", () => {
    const snap = emptySnapshot("w-1");
    expect(snap.worldId).toBe("w-1");
    expect(snap.stageNumber).toBe(0);
    expect(Object.keys(snap.characters)).toHaveLength(0);
  });

  test("cloneSnapshot deep-copies", () => {
    const snap = emptySnapshot("w-1");
    snap.characters["林焰"] = {
      name: "林焰",
      faction: "青岳宗",
      role: "外门",
      traits: ["倔强"],
      goal: "拿到真传",
      stance: "守宗",
      resource: "赤纹残图",
      progress: 0,
      pressure: 0,
      lastAction: "idle",
      alive: true,
      notes: [],
    };
    const copy = cloneSnapshot(snap);
    copy.characters["林焰"].pressure = 50;
    expect(snap.characters["林焰"].pressure).toBe(0);
  });
});

describe("v3 domain canon", () => {
  test("evaluateAnchorViolations flags death against cannot=提前死亡", () => {
    const snap = emptySnapshot("w-1");
    snap.characters["林焰"] = {
      name: "林焰",
      faction: "青岳宗",
      role: "外门",
      traits: [],
      goal: "x",
      stance: "x",
      resource: "x",
      progress: 0,
      pressure: 0,
      lastAction: "fallen",
      alive: false,
      notes: [],
    };
    const violations = evaluateAnchorViolations(
      {
        worldSpec: {
          genre: "",
          timeScale: "",
          cultivationSystem: "",
          worldRules: [],
          factions: [],
          locations: [],
        },
        characters: [],
        relationships: [],
        characterAnchors: [
          {
            characterId: "林焰",
            cannot: "提前死亡",
            mustTrend: "",
            stageGoal: "",
          },
        ],
        relationshipAnchors: [],
      },
      snap,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].severity).toBe("error");
    expect(riskFromViolations(violations)).toBe("high");
  });

  test("riskFromViolations grades multiple warnings as medium", () => {
    expect(
      riskFromViolations([
        { characterId: "a", anchorField: "mustTrend", message: "x", severity: "warning" },
        { characterId: "b", anchorField: "mustTrend", message: "y", severity: "warning" },
      ]),
    ).toBe("medium");
    expect(
      riskFromViolations([
        { characterId: "a", anchorField: "mustTrend", message: "x", severity: "warning" },
      ]),
    ).toBe("low");
    expect(riskFromViolations([])).toBe("none");
  });
});
