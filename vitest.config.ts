import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/_legacy/**",
      "tests/_legacy/**",
      "tests/deepseek.integration.test.ts",
    ],
  },
});
