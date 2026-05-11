import type { WritingStage } from "../domain";

export const STAGE_VERBS: Record<WritingStage, string> = {
  "memory-read": "取材",
  blueprint: "立骨",
  "scene-expand": "铺场",
  synthesize: "成文",
  critique: "自审",
  rewrite: "润色",
  "memory-write": "入史",
  "atlas-compile": "结图",
};

export const STAGE_VERBS_ACTIVE: Record<WritingStage, string> = {
  "memory-read": "取材中",
  blueprint: "立骨中",
  "scene-expand": "铺场中",
  synthesize: "成文中",
  critique: "自审中",
  rewrite: "润色中",
  "memory-write": "入史中",
  "atlas-compile": "结图中",
};

export const SIX_STAGE_ORDER: WritingStage[] = [
  "memory-read",
  "blueprint",
  "scene-expand",
  "synthesize",
  "critique",
  "memory-write",
];

export const CANON_VERB = "裁决";
export const PROMOTION_VERB = "扶正";
export const RUNTIME_TICK_VERB = "推演";
export const RUNTIME_TICK_ACTIVE_VERB = "推演中";
export const PAUSE_VERB = "驻笔";
export const MEMORY_WRITE_VERB = "落册";
export const CONFIRM_FINAL_VERB = "入史";
export const IDLE_ACTIVE_VERB = "静观";

export function stageVerb(stage: WritingStage): string {
  return STAGE_VERBS[stage] ?? stage;
}

export function stageActiveVerb(stage: WritingStage): string {
  return STAGE_VERBS_ACTIVE[stage] ?? `${stage}中`;
}
