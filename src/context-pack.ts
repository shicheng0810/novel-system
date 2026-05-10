import { createHash } from "node:crypto";

import type { StageDirective } from "./domain";

export type ContextBlockKind =
  | "directive"
  | "canon"
  | "atlas"
  | "memory"
  | "metaphysics"
  | "reading"
  | "run-history"
  | "model-profile";

export type ContextBlock = {
  blockId: string;
  kind: ContextBlockKind;
  label: string;
  content: unknown;
  hash: string;
  tokenEstimate: number;
};

export type ContextPackInput = {
  worldId: string;
  lineId: string;
  directive: StageDirective;
  canon?: unknown;
  atlas?: unknown;
  memory?: unknown;
  metaphysics?: unknown;
  reading?: unknown;
  runHistory?: unknown;
  modelProfile?: unknown;
};

export type ContextPack = {
  packId: string;
  worldId: string;
  lineId: string;
  blockHashes: string[];
  tokenEstimate: number;
  blocks: ContextBlock[];
};

type BlockSource = {
  kind: ContextBlockKind;
  label: string;
  content: unknown;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stableSerialize(value: unknown): string {
  if (value === undefined) return "\"__undefined__\"";
  if (typeof value === "number" && !Number.isFinite(value)) return JSON.stringify(String(value));
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(",")}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}

export function hashStableValue(value: unknown): string {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

export function estimateContextTokens(value: unknown): number {
  const chars = stableSerialize(value).length;
  return Math.max(1, Math.ceil(chars / 4));
}

function blockIdFor(kind: ContextBlockKind, label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/giu, "-")
    .replace(/^-|-$/g, "");
  return `${kind}:${slug || "block"}`;
}

function contextBlock(source: BlockSource): ContextBlock {
  const blockId = blockIdFor(source.kind, source.label);
  const hash = hashStableValue({ blockId, kind: source.kind, label: source.label, content: source.content });
  return {
    blockId,
    kind: source.kind,
    label: source.label,
    content: source.content,
    hash,
    tokenEstimate: estimateContextTokens(source.content),
  };
}

function pushIfPresent(sources: BlockSource[], kind: ContextBlockKind, label: string, content: unknown): void {
  if (content === undefined) return;
  if (isPlainRecord(content) && Object.keys(content).length === 0) return;
  if (Array.isArray(content) && content.length === 0) return;
  sources.push({ kind, label, content });
}

export function buildContextPack(input: ContextPackInput): ContextPack {
  const sources: BlockSource[] = [];
  pushIfPresent(sources, "directive", "current directive", input.directive);
  pushIfPresent(sources, "canon", "canon head", input.canon);
  pushIfPresent(sources, "atlas", "atlas slice", input.atlas);
  pushIfPresent(sources, "memory", "memory slice", input.memory);
  pushIfPresent(sources, "metaphysics", "metaphysics frame", input.metaphysics);
  pushIfPresent(sources, "reading", "reading artifacts", input.reading);
  pushIfPresent(sources, "run-history", "recent runs", input.runHistory);
  pushIfPresent(sources, "model-profile", "model profile", input.modelProfile);

  const blocks = sources.map(contextBlock);
  const blockHashes = blocks.map((block) => block.hash);
  const packId = hashStableValue({
    worldId: input.worldId,
    lineId: input.lineId,
    blocks: blocks.map((block) => ({ blockId: block.blockId, hash: block.hash })),
  });

  return {
    packId,
    worldId: input.worldId,
    lineId: input.lineId,
    blockHashes,
    tokenEstimate: blocks.reduce((sum, block) => sum + block.tokenEstimate, 0),
    blocks,
  };
}
