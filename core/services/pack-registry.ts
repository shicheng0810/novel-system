// core/services/pack-registry.ts — 加载/取内容包。引擎只通过 id 拿 ContentPack, 不 import 任何具体包。
import type { ContentPack } from "../domain/pack";

export class PackRegistry {
  private packs = new Map<string, ContentPack>();

  register(pack: ContentPack): void {
    this.packs.set(pack.id, pack);
  }

  get(id: string): ContentPack {
    const p = this.packs.get(id);
    if (!p) throw new Error(`pack not found: ${id} (registered: ${[...this.packs.keys()].join(", ") || "none"})`);
    return p;
  }

  has(id: string): boolean {
    return this.packs.has(id);
  }
}
