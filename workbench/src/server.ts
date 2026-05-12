// Vite middleware glue. The v3 server (src/v3/server) owns all /api/*
// routing including SSE. This file is intentionally tiny — it exists
// only because vite.config.ts imports `createWorkbenchApiMiddleware`.

import { existsSync, mkdirSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createServer, type ServerHandle } from "../../src/v3/server";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

export type WorkbenchMiddlewareOptions = {
  rootDir?: string;
};

let serverHandle: ServerHandle | null = null;

export function createWorkbenchApiMiddleware(options: WorkbenchMiddlewareOptions = {}) {
  const rootDir = options.rootDir ?? join(REPO_ROOT, ".novel-system");
  if (!existsSync(rootDir)) mkdirSync(rootDir, { recursive: true });
  if (!serverHandle) serverHandle = createServer({ rootDir });
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    void serverHandle!.requestHandler(req, res, next);
  };
}
