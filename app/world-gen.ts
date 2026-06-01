// app/world-gen.ts — 提示词 → WorldConfig(共用: gen-world CLI 与服务器"新建世界"均调此)。
import type { LLMProvider } from "../core/services/llm";

const SPEC = `WorldConfig 字段(全部必填, 严格合法 JSON, 中文用双引号):
- id: 英文小写短标识
- displayName: 世界名(中文)
- bible: 一句话世界设定纲要(须含下面四位主角的名字)
- protagonists: 恰好 4 个 {"name":中文名, "faction":取自下方 factions 之一}
- factions: 5~6 个势力/阵营名(中文)
- locations: 恰好 7 个 {"id":"loc-英文", "name":中文地名, "yield":0.3~1.0 资源/机遇浓度(七处各不相同)}
- tierNames: 恰好 8 个由低到高的"地位/实力阶梯"名(中文, 贴合该世界, 如素人→…→霸主)
- goalMap: 一个对象, 键必须正好是这十个"十神命格"名, 值为 {"label":二字志向, "desc":该志向一句话, "axis":"initiative"|"caution"|"harmony"|"discord"}:
    "七杀格","伤官格","劫财","偏财格","正财格","正官格","比肩","偏印格","正印格","食神格"
    (七杀/伤官刚猛逆锐→initiative/discord；劫财/偏财/正财→搏取财利→initiative/caution；正官/正印/偏印→持重护佑→caution；食神→亲和结缘→harmony)
- storyEvents: 恰好 6 个 {"name":四字大事, "summary":一句, "gatherAt":某 location 的 id, "crisis":一句危机, "stressDelta":0.18~0.32, "factionShifts":[{"a":势力,"b":势力,"delta":-3~2}]}
- arcs: 恰好 10 个由浅入深的长篇情境弧线(每条一句)
- composePrompt: 给小说作者的文风提示词(一句, 贴合该题材)
- spawnNames: 12 个配角名(中文); reviverNames: 6 个"东山再起者"名(中文)
- moodWords: 恰好 4 个心境词(由最焦灼到最平静)`;

export async function generateWorldConfig(prompt: string, llm: LLMProvider): Promise<Record<string, unknown>> {
  const result = await llm.complete(
    `你是"世界设定生成器"。根据用户一句话世界描述，产出一份可直接驱动小说世界引擎的 WorldConfig JSON。\n${SPEC}\n\n用户世界：${prompt}\n\n只输出 JSON 本身，不要任何解释、不要 \`\`\` 代码块标记。`,
    { thinking: false, temperature: 0.4 },
  );
  const m = result.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : result) as Record<string, unknown>;
}
