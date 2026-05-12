// Layer-isolation enforcement.
// domain/* MUST NOT import services/* / engine/* / daemon/* / server/*.
// services/* MUST NOT import engine/* / daemon/* / server/*.
// engine/* MUST NOT import daemon/* / server/*.
// daemon/* MUST NOT import server/*.
//
// Implementation note: we statically grep import statements in src/.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

const ROOT = new URL("../src/", import.meta.url).pathname;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...walk(path));
    } else if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      out.push(path);
    }
  }
  return out;
}

function imports(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const found: string[] = [];
  const re = /from\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    found.push(m[1]);
  }
  return found;
}

function inLayer(file: string, layer: string): boolean {
  return file.includes(`/${layer}/`);
}

function importsLayer(file: string, layer: string): boolean {
  return imports(file).some((spec) => spec.includes(`/${layer}/`) || spec.endsWith(`./${layer}`) || spec.includes(`/${layer}`));
}

describe("architecture · layer isolation", () => {
  const files = walk(ROOT).filter((f) => !f.endsWith("/index.ts") && !f.endsWith("/sandbox.ts"));

  test("domain/* does not import services/engine/daemon/server", () => {
    for (const file of files.filter((f) => inLayer(f, "domain"))) {
      for (const banned of ["services", "engine", "daemon", "server", "director", "agents", "verify", "metaphysics"]) {
        expect(importsLayer(file, banned), `${file} imports ${banned}/*`).toBe(false);
      }
    }
  });

  test("services/* does not import engine/daemon/server/director/agents", () => {
    for (const file of files.filter((f) => inLayer(f, "services"))) {
      for (const banned of ["engine", "daemon", "server", "director", "agents"]) {
        expect(importsLayer(file, banned), `${file} imports ${banned}/*`).toBe(false);
      }
    }
  });

  test("engine/* does not import daemon/server", () => {
    for (const file of files.filter((f) => inLayer(f, "engine"))) {
      for (const banned of ["daemon", "server"]) {
        expect(importsLayer(file, banned), `${file} imports ${banned}/*`).toBe(false);
      }
    }
  });

  test("daemon/* does not import server", () => {
    for (const file of files.filter((f) => inLayer(f, "daemon"))) {
      expect(importsLayer(file, "server"), `${file} imports server/*`).toBe(false);
    }
  });

  test("metaphysics/* does not import services/engine/daemon/server", () => {
    for (const file of files.filter((f) => inLayer(f, "metaphysics"))) {
      for (const banned of ["services", "engine", "daemon", "server"]) {
        expect(importsLayer(file, banned), `${file} imports ${banned}/*`).toBe(false);
      }
    }
  });

  test("verify/* is pure (only domain imports)", () => {
    for (const file of files.filter((f) => inLayer(f, "verify"))) {
      for (const banned of ["services", "engine", "daemon", "server", "director", "agents", "metaphysics"]) {
        expect(importsLayer(file, banned), `${file} imports ${banned}/*`).toBe(false);
      }
    }
  });
});
