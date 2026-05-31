// core/actors/compose-actor.ts — compose 是 tick 的一个相位(章节=模拟副产品)。
// M2: blueprint(梗概)+ synthesize(正文)两步 LLM。genre-free: 文风/系统提示词来自 pack.composeProfile。
import type { WorldSnapshot } from "../domain/world";
import type { ContentPack } from "../domain/pack";
import type { LLMProvider } from "../services/llm";

export interface ComposedChapter {
  chapterId: string;
  goal: string;
  text: string;
  sceneIds: string[];
}

export async function composeChapter(
  snapshot: WorldSnapshot,
  material: string[],
  pack: ContentPack,
  llm: LLMProvider,
  tick: number
): Promise<ComposedChapter> {
  const sys = pack.composeProfile?.systemPrompt ?? "你是一位小说作者，文笔凝练。";
  const present = Object.values(snapshot.characters)
    .filter((c) => c.present)
    .map((c) => c.name)
    .join("、");
  const mat = material.slice(-8).join("；") || "（世界初开，尚无往事）";

  const blueprintPrompt = `${sys}\n素材(近期角色心象):${mat}\n在场角色:${present}\n用一句话拟定本章核心情节梗概，不超过30字。只回一句。`;
  const goal = (await llm.complete(blueprintPrompt)).replace(/\s+/g, " ").slice(0, 60);

  const writePrompt = `${sys}\n本章梗概:${goal}\n在场角色:${present}\n近期素材:${mat}\n据此写约150字章节正文，承接素材，只输出正文。`;
  const text = (await llm.complete(writePrompt)).trim();

  return { chapterId: `ch-${snapshot.worldId}-t${tick}`, goal, text, sceneIds: [] };
}
