// tests/core/architecture.test.ts — 静态守卫: 机器强制 §2.7 引擎↔内容包分离
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN = /bazi|qimen|cultivation|境界/i;

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walkTs(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("architecture guard (§2.7 引擎↔包分离)", () => {
  const coreRoot = join(process.cwd(), "core");

  it("core/ 不含 genre 字面量(bazi/qimen/cultivation/境界)", () => {
    const offenders: string[] = [];
    for (const f of walkTs(coreRoot)) {
      if (FORBIDDEN.test(readFileSync(f, "utf8"))) offenders.push(f.replace(process.cwd(), "."));
    }
    expect(offenders, `这些 core 文件含 genre 字面量, 应移进 pack: ${offenders.join(", ")}`).toEqual([]);
  });

  it("core/ 不 import packs/(引擎不依赖具体包)", () => {
    const offenders: string[] = [];
    for (const f of walkTs(coreRoot)) {
      if (/from\s+["'][^"']*packs\//.test(readFileSync(f, "utf8"))) offenders.push(f.replace(process.cwd(), "."));
    }
    expect(offenders, `这些 core 文件 import 了 packs/: ${offenders.join(", ")}`).toEqual([]);
  });
});
