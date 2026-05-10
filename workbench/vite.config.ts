import { fileURLToPath, URL } from "node:url";

import { defineConfig, type Plugin } from "vite";

import { createWorkbenchApiMiddleware } from "./src/server";

function workbenchApiPlugin(): Plugin {
  return {
    name: "workbench-api",
    configureServer(server) {
      server.middlewares.use(createWorkbenchApiMiddleware());
    },
  };
}

export default defineConfig({
  plugins: [workbenchApiPlugin()],
  resolve: {
    alias: {
      "@novel": fileURLToPath(new URL("../src/index.ts", import.meta.url)),
    },
  },
});
