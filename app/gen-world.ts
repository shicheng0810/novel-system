// app/gen-world.ts — 提示词 → 世界配置(WorldConfig JSON), 命令行版。
// 用法: NOVEL_WORLD_PROMPT="赛博朋克东京" NOVEL_WORLD_OUT=.novel-output/worlds/tokyo.json npx tsx app/gen-world.ts
// 然后: NOVEL_PACK=freeform NOVEL_WORLD_CONFIG=...tokyo.json NOVEL_SAGA_DIR=tokyo npx tsx app/longrun.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { makeLLM } from "./llm-factory";
import { generateWorldConfig } from "./world-gen";

const prompt = process.env["NOVEL_WORLD_PROMPT"] ?? "民国上海滩，黑帮、谍战与名伶";
const out = process.env["NOVEL_WORLD_OUT"] ?? "";
const llm = makeLLM();

async function main(): Promise<void> {
  console.error(`◇ 据提示词生成世界（LLM=${llm.id}）：${prompt}`);
  try {
    const cfg = await generateWorldConfig(prompt, llm);
    const pretty = JSON.stringify(cfg, null, 2);
    if (out) {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, pretty, "utf8");
      console.error(`✅ 世界「${String(cfg["displayName"])}」已写入 ${out}`);
      console.error(`   开跑: NOVEL_PACK=freeform NOVEL_WORLD_CONFIG=${out} NOVEL_SAGA_DIR=<新目录> npx tsx app/longrun.ts`);
    } else {
      console.log(pretty);
    }
  } catch (e) {
    console.error("⚠️ 生成失败:", String(e).slice(0, 150));
    process.exit(1);
  }
}
void main();
