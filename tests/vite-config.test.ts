import { describe, expect, test } from "vitest";

import viteConfig from "../workbench/vite.config";

function flattenPlugins(plugins: unknown): Array<{ name?: string }> {
  if (!Array.isArray(plugins)) {
    return [];
  }
  return plugins.flatMap((plugin) => (Array.isArray(plugin) ? flattenPlugins(plugin) : [plugin as { name?: string }]));
}

describe("workbench vite config", () => {
  test("registers the workbench API middleware for dev server requests", async () => {
    const config = await viteConfig;
    const plugins = flattenPlugins(config.plugins);

    expect(plugins.some((plugin) => plugin.name === "workbench-api")).toBe(true);
  });
});
