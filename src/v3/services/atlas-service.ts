// Layer 2 · AtlasService.
// Atlas is a derived markdown tree per (worldId, lineId): characters,
// relationships, factions, locations, anchors. Persisted in atlas_nodes;
// (re)compiled from a WorldSnapshot. Emits an `atlas` event on compile.

import type { Db } from "../data/db";
import type { EventBus } from "./event-bus";
import { makeEventId } from "../domain/events";
import type { ParsedWorldDraft, WorldSnapshot } from "../domain/world";

type AtlasRow = {
  node_path: string;
  world_id: string;
  line_id: string;
  kind: string;
  body: string | null;
  updated_at: number;
};

export type AtlasFile = { path: string; body: string };
export type AtlasTreeNode = { path: string; kind: "file" | "directory" };

export class AtlasService {
  private readonly upsert: ReturnType<Db["prepare"]>;
  private readonly listAll: ReturnType<Db["prepare"]>;
  private readonly readNode: ReturnType<Db["prepare"]>;
  private readonly clearLine: ReturnType<Db["prepare"]>;

  constructor(
    private readonly db: Db,
    private readonly bus: EventBus,
  ) {
    this.upsert = db.prepare(
      `INSERT INTO atlas_nodes(node_path, world_id, line_id, kind, body, updated_at)
       VALUES (@path, @worldId, @lineId, @kind, @body, @updatedAt)
       ON CONFLICT(world_id, line_id, node_path) DO UPDATE SET
         kind = excluded.kind,
         body = excluded.body,
         updated_at = excluded.updated_at`,
    );
    this.listAll = db.prepare(
      "SELECT * FROM atlas_nodes WHERE world_id = ? AND line_id = ? ORDER BY node_path ASC",
    );
    this.readNode = db.prepare(
      "SELECT * FROM atlas_nodes WHERE world_id = ? AND line_id = ? AND node_path = ?",
    );
    this.clearLine = db.prepare(
      "DELETE FROM atlas_nodes WHERE world_id = ? AND line_id = ?",
    );
  }

  /**
   * Compile a fresh atlas tree from a parsed draft + snapshot. Replaces the
   * full tree for (worldId, lineId). Emits one `atlas` event.
   */
  compile(input: {
    worldId: string;
    lineId: string;
    parsed: ParsedWorldDraft;
    snapshot: WorldSnapshot;
  }): AtlasFile[] {
    const files = renderAtlas(input.parsed, input.snapshot);
    this.clearLine.run([input.worldId, input.lineId]);
    const seenDirs = new Set<string>();
    for (const file of files) {
      const dir = dirname(file.path);
      if (dir && !seenDirs.has(dir)) {
        this.upsert.run({
          path: dir,
          worldId: input.worldId,
          lineId: input.lineId,
          kind: "directory",
          body: null,
          updatedAt: Date.now(),
        });
        seenDirs.add(dir);
      }
      this.upsert.run({
        path: file.path,
        worldId: input.worldId,
        lineId: input.lineId,
        kind: "file",
        body: file.body,
        updatedAt: Date.now(),
      });
    }

    this.bus.emit({
      id: makeEventId({
        subsystem: "atlas",
        sourceRef: `${input.worldId}:${input.lineId}:${Date.now()}`,
      }),
      ts: Date.now(),
      worldId: input.worldId,
      subsystem: "atlas",
      severity: "ambient",
      status: "succeeded",
      verb: "结图",
      subject: "图谱",
      summary: `图谱已重建 · ${files.length} 节`,
      refs: { lineId: input.lineId, fileCount: files.length },
    });

    return files;
  }

  tree(worldId: string, lineId: string): AtlasTreeNode[] {
    const rows = this.listAll.all([worldId, lineId]) as AtlasRow[];
    return rows.map((row) => ({ path: row.node_path, kind: row.kind as "file" | "directory" }));
  }

  read(worldId: string, lineId: string, path: string): AtlasFile | null {
    const row = this.readNode.get([worldId, lineId, path]) as AtlasRow | undefined;
    if (!row || row.kind !== "file") return null;
    return { path: row.node_path, body: row.body ?? "" };
  }

  write(input: { worldId: string; lineId: string; path: string; body: string }): void {
    this.upsert.run({
      path: input.path,
      worldId: input.worldId,
      lineId: input.lineId,
      kind: "file",
      body: input.body,
      updatedAt: Date.now(),
    });
  }
}

function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(0, i) : "";
}

function renderAtlas(parsed: ParsedWorldDraft, snapshot: WorldSnapshot): AtlasFile[] {
  const files: AtlasFile[] = [];

  files.push({
    path: "world/spec.md",
    body: [
      `# 世界设定`,
      `- 题材：${parsed.worldSpec.genre}`,
      `- 时间尺度：${parsed.worldSpec.timeScale}`,
      `- 修炼体系：${parsed.worldSpec.cultivationSystem}`,
      ``,
      `## 世界规则`,
      ...parsed.worldSpec.worldRules.map((rule) => `- ${rule}`),
    ].join("\n"),
  });

  if (parsed.worldSpec.factions.length) {
    files.push({
      path: "world/factions.md",
      body: [
        `# 势力`,
        ...parsed.worldSpec.factions.map((f) => `- **${f.name}**：${f.description}`),
      ].join("\n"),
    });
  }

  if (parsed.worldSpec.locations.length) {
    files.push({
      path: "world/locations.md",
      body: [
        `# 地点`,
        ...parsed.worldSpec.locations.map((l) => `- **${l.name}**：${l.description}`),
      ].join("\n"),
    });
  }

  for (const character of parsed.characters) {
    const state = snapshot.characters[character.id];
    files.push({
      path: `characters/${character.id}.md`,
      body: [
        `# ${character.name}`,
        ``,
        `- 势力：${character.faction}`,
        `- 角色：${character.role}`,
        `- 特质：${character.traits.join("、")}`,
        `- 目标：${character.goal}`,
        `- 立场：${character.stance}`,
        `- 资源：${character.resource}`,
        ``,
        ...(character.description ? [`> ${character.description}`, ``] : []),
        ...(state
          ? [
              `## 当前状态`,
              `- 进度：${state.progress}`,
              `- 压力：${state.pressure}`,
              `- 上次行动：${state.lastAction}`,
              `- 存活：${state.alive ? "是" : "否"}`,
              ...(state.notes.length ? [``, `## 笔记`, ...state.notes.map((n) => `- ${n}`)] : []),
            ]
          : []),
      ].join("\n"),
    });
  }

  if (parsed.relationships.length) {
    files.push({
      path: "relationships/index.md",
      body: [
        `# 关系`,
        ...parsed.relationships.map((r) => {
          const state = snapshot.relationships[r.id];
          return `- ${r.left} <-> ${r.right} · ${r.status}${
            state ? ` (信任 ${state.trust} / 敌意 ${state.hostility})` : ""
          }`;
        }),
      ].join("\n"),
    });
  }

  if (parsed.characterAnchors.length) {
    files.push({
      path: "anchors/characters.md",
      body: [
        `# 角色锚点`,
        ...parsed.characterAnchors.map(
          (a) =>
            `- **${a.characterId}** | cannot=${a.cannot} | mustTrend=${a.mustTrend} | stageGoal=${a.stageGoal}`,
        ),
      ].join("\n"),
    });
  }

  return files;
}
