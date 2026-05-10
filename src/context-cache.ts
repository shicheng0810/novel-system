import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ContextPack } from "./context-pack";

export type ContextCacheReason = "cold" | "continued" | "evict" | "shutdown" | "canon-gate" | "author-handoff";

export type ContextCacheSnapshot = {
  packId: string;
  blockHashes: string[];
  tokenEstimate: number;
  reason: ContextCacheReason;
  hits: number;
  createdAt: string;
  lastUsedAt: string;
  blockLabels: string[];
  pack: ContextPack;
};

export type ContextCachePrefixMatch = ContextCacheSnapshot & {
  matchedBlockCount: number;
};

export class ContextCache {
  constructor(private readonly input: { rootDir: string }) {}

  get cacheRoot(): string {
    return join(this.input.rootDir, "context-cache");
  }

  async writeSnapshot(pack: ContextPack, reason: ContextCacheReason): Promise<ContextCacheSnapshot> {
    await mkdir(this.cacheRoot, { recursive: true });
    const now = new Date().toISOString();
    const existing = await this.loadSnapshot(pack.packId);
    const snapshot: ContextCacheSnapshot = {
      packId: pack.packId,
      blockHashes: pack.blockHashes,
      tokenEstimate: pack.tokenEstimate,
      reason,
      hits: existing?.hits ?? 0,
      createdAt: existing?.createdAt ?? now,
      lastUsedAt: existing?.lastUsedAt ?? now,
      blockLabels: pack.blocks.map((block) => block.label),
      pack,
    };
    await writeFile(this.snapshotPath(pack.packId), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    return snapshot;
  }

  async loadSnapshot(packId: string): Promise<ContextCacheSnapshot | undefined> {
    try {
      return JSON.parse(await readFile(this.snapshotPath(packId), "utf8")) as ContextCacheSnapshot;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async findReusablePrefix(blockHashes: string[]): Promise<ContextCachePrefixMatch | undefined> {
    await mkdir(this.cacheRoot, { recursive: true });
    const snapshots = await this.listSnapshots();
    const matches = snapshots
      .map((snapshot) => ({ snapshot, matchedBlockCount: commonPrefixLength(snapshot.blockHashes, blockHashes) }))
      .filter((entry) => entry.matchedBlockCount === entry.snapshot.blockHashes.length && entry.matchedBlockCount > 0)
      .sort((left, right) => right.matchedBlockCount - left.matchedBlockCount);
    const best = matches[0];
    if (!best) return undefined;
    const hit = await this.recordHit(best.snapshot.packId);
    return { ...(hit ?? best.snapshot), matchedBlockCount: best.matchedBlockCount };
  }

  async listSnapshots(): Promise<ContextCacheSnapshot[]> {
    await mkdir(this.cacheRoot, { recursive: true });
    const entries = await readdir(this.cacheRoot, { withFileTypes: true });
    return Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) =>
          readFile(join(this.cacheRoot, entry.name), "utf8").then((raw) => JSON.parse(raw) as ContextCacheSnapshot),
        ),
    );
  }

  async recordHit(packId: string): Promise<ContextCacheSnapshot | undefined> {
    const snapshot = await this.loadSnapshot(packId);
    if (!snapshot) return undefined;
    const updated: ContextCacheSnapshot = {
      ...snapshot,
      hits: snapshot.hits + 1,
      lastUsedAt: new Date().toISOString(),
    };
    await writeFile(this.snapshotPath(packId), `${JSON.stringify(updated, null, 2)}\n`, "utf8");
    return updated;
  }

  private snapshotPath(packId: string): string {
    if (!/^[a-f0-9]{64}$/i.test(packId)) {
      throw new Error(`Invalid context pack id: ${packId}`);
    }
    return join(this.cacheRoot, `${packId}.json`);
  }
}

export function commonPrefixLength(left: string[], right: string[]): number {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) return index;
  }
  return limit;
}
