import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, test } from "vitest";

describe("package scripts", () => {
  test("demo entrypoints referenced by package scripts exist", () => {
    const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    for (const scriptName of ["sandbox"]) {
      const script = packageJson.scripts[scriptName];
      const match = /^tsx\s+(.+)$/.exec(script);
      expect(match?.[1], `${scriptName} should run a tsx entrypoint`).toBeTruthy();
      expect(existsSync(resolve(match![1])), `${scriptName} entrypoint should exist`).toBe(true);
    }
  });
});
