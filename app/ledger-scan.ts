// app/ledger-scan.ts — D20 容器材质漂移校准/巡检 CLI(零LLM)。
//   用法:
//     tsx app/ledger-scan.ts <file.md|dir> [<file|dir> ...]      # 逐章报 D20 命中
//     tsx app/ledger-scan.ts --fp <世界chapters目录> [N]          # 误杀巡检: 抽 N 章统计 D20 命中率
//   章文件首行 `# 第X章 标题` 作 title, 其余作正文。names 传空(D20 不依赖人名)。
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { auditContainerDrift } from "./lint-seams";

function loadChapter(path: string): { title: string; body: string } {
  const raw = readFileSync(path, "utf8");
  const lines = raw.split("\n");
  let title = "";
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!.trim();
    if (!l) { start = i + 1; continue; }
    if (l.startsWith("#")) { title = l.replace(/^#+\s*/, "").replace(/^第[零一二三四五六七八九十百\d]+章[　\s]*/, ""); start = i + 1; break; }
    break;
  }
  return { title, body: lines.slice(start).join("\n").trim() };
}

const driftOf = (path: string): string[] => auditContainerDrift(loadChapter(path).body);

const expandMd = (p: string): string[] =>
  statSync(p).isDirectory() ? readdirSync(p).filter((f) => f.endsWith(".md")).map((f) => join(p, f)) : [p];

const args = process.argv.slice(2);
if (args[0] === "--fp") {
  const dir = args[1]!;
  const limit = args[2] ? +args[2] : 99999;
  const files = readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => join(dir, f)).slice(0, limit);
  let hit = 0;
  const samples: string[] = [];
  for (const f of files) {
    const d = driftOf(f);
    if (d.length) { hit++; if (samples.length < 12) samples.push(`${f.split("/").pop()}: ${d[0]}`); }
  }
  console.log(`\n[FP巡检] ${dir}\n  扫描 ${files.length} 章 · D20 命中 ${hit} 章 (${(hit / files.length * 100).toFixed(1)}%)`);
  for (const s of samples) console.log(`   • ${s}`);
} else {
  for (const a of args) for (const f of expandMd(a)) {
    const d = driftOf(f);
    const tag = d.length ? `⛓ 命中×${d.length}` : "· 干净";
    console.log(`\n${tag}  ${f.split("/").slice(-1)[0]}`);
    for (const x of d) console.log(`   ${x}`);
  }
}
