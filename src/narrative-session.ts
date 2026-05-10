import { commonPrefixLength } from "./context-cache";
import type { ContextPack } from "./context-pack";

export type NarrativeSessionSyncMode = "reuse" | "extend" | "replace";

export type NarrativeSessionSyncResult = {
  mode: NarrativeSessionSyncMode;
  packId: string;
  commonBlockCount: number;
  previousPackId?: string;
  revision: number;
};

export type NarrativeSessionSnapshot = {
  packId?: string;
  blockHashes: string[];
  tokenEstimate: number;
  revision: number;
  lastSync?: NarrativeSessionSyncResult;
};

export class NarrativeSession {
  private current?: ContextPack;
  private revisionValue = 0;
  private lastSyncResult?: NarrativeSessionSyncResult;

  sync(pack: ContextPack): NarrativeSessionSyncResult {
    const previous = this.current;
    const commonBlockCount = previous ? commonPrefixLength(previous.blockHashes, pack.blockHashes) : 0;
    const mode = this.syncMode(previous, pack, commonBlockCount);
    if (mode !== "reuse") {
      this.current = pack;
      this.revisionValue += 1;
    }
    this.lastSyncResult = {
      mode,
      packId: pack.packId,
      previousPackId: previous?.packId,
      commonBlockCount,
      revision: this.revisionValue,
    };
    return this.lastSyncResult;
  }

  snapshot(): NarrativeSessionSnapshot {
    return {
      packId: this.current?.packId,
      blockHashes: this.current?.blockHashes ?? [],
      tokenEstimate: this.current?.tokenEstimate ?? 0,
      revision: this.revisionValue,
      lastSync: this.lastSyncResult,
    };
  }

  reset(): void {
    this.current = undefined;
    this.lastSyncResult = undefined;
    this.revisionValue += 1;
  }

  private syncMode(
    previous: ContextPack | undefined,
    next: ContextPack,
    commonBlockCount: number,
  ): NarrativeSessionSyncMode {
    if (!previous) return "replace";
    if (previous.packId === next.packId) return "reuse";
    if (commonBlockCount === previous.blockHashes.length && next.blockHashes.length >= previous.blockHashes.length) {
      return "extend";
    }
    return "replace";
  }
}
