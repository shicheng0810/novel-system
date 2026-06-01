// app/retitle.ts — 一次性维护脚本: 用新标题风格(pack.composeProfile.titleStyle)重写【已存章节】的标题。
//   只改 goal(裸 UPDATE, 保留正文/created_at 顺序), 同步重写 .md 文件头。
//   ⚠️ 运行前必须先停对应世界的 longrun(避免 DB 写冲突)。按世界传 env: NOVEL_SAGA_DIR/NOVEL_PACK/NOVEL_WORLD_CONFIG。
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, existsSync } from "node:fs";
import { openDb } from "../core/services/db";
import { makeLLM } from "./llm-factory";
import * as store from "../core/services/store";
import { PACK } from "./pack-select";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", ".novel-output", process.env["NOVEL_SAGA_DIR"] ?? "saga");
const db = openDb(join(ROOT, "world.db"));
const worldId = "saga";
const llm = makeLLM();
const sys = PACK.composeProfile?.systemPrompt ?? "你是一位小说作者。";
const titleStyle = PACK.composeProfile?.titleStyle ?? "简洁自然、有画面感的标题，避免堆砌并列短语与生硬对仗";

function clean(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/[《》「」#*_~`\n]/g, "")
    .replace(/^[\s\-—•·*]+/, "")
    .replace(/^第[零〇一二三四五六七八九十百千两\d]+[章回][:：\s]*/, "")
    .replace(/^节拍[零〇一二三四五六七八九十\d]+[：:、.\s]*/, "")
    .slice(0, 20);
}

const ONLY = process.env["RETITLE_ONLY"]?.split(",").map((x) => Number(x.trim())).filter((x) => !Number.isNaN(x));

async function main(): Promise<void> {
  const chapters = store.readChapters(db, worldId).filter((c) => c.id.startsWith("saga-ch-"));
  console.log(`[retitle] ${process.env["NOVEL_SAGA_DIR"] ?? "saga"}: ${chapters.length} 章待重命名`);
  const upd = db.prepare("UPDATE chapters SET goal=? WHERE world_id=? AND id=?");
  for (const ch of chapters) {
    const n = Number(ch.id.replace("saga-ch-", ""));
    if (ONLY && !ONLY.includes(n)) continue; // 定点重命名指定章
    const raw = await llm.complete(
      `${sys}\n下面是某一章的正文节选。为这一章起一个标题：紧扣本章核心转折，自然、有画面感、含一点悬念；≤12字；${titleStyle}。不含"第X章"字样。只回标题本身：\n${ch.text.slice(0, 1500)}`,
      { thinking: false, temperature: 1.0 },
    );
    const goal = clean(raw);
    if (!goal) continue;
    upd.run(goal, worldId, ch.id);
    const f = join(ROOT, "chapters", `ch-${String(n).padStart(4, "0")}.md`);
    if (existsSync(f)) writeFileSync(f, `# 第${n}章　${goal}\n\n${ch.text}\n`, "utf8");
    console.log(`  ${n}. ${goal}`);
  }
  console.log(`[retitle] ${process.env["NOVEL_SAGA_DIR"] ?? "saga"} done`);
}

void main();
