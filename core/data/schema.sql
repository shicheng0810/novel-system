-- Novel System · 清白重写 (架构 B: Actor / 监督运行时)
-- M0 数据基座。单文件 world.db。events 是唯一真相;其余表可由其 fold/投影重建。
-- 约定: ts = unixepoch 毫秒(应用层写); *_json 列存 JSON 文本。
-- §2.7 约束: 本文件零 genre 字面量(无 bazi/qimen/cultivation/境界);pack_id 通用。

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── 事件日志: append-only, 幂等 by id, seq 全局单调(fold 顺序) ────────
CREATE TABLE IF NOT EXISTS events (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  id           TEXT NOT NULL UNIQUE,              -- 幂等键 subsystem:runId:phase:sourceRef
  world_id     TEXT NOT NULL,
  line_id      TEXT,                              -- 世界线/分支
  tick         INTEGER,
  kind         TEXT NOT NULL,                     -- DomainEvent 判别 (StageCommitted/AuthorRuled/...)
  subsystem    TEXT NOT NULL,                     -- 展示词典 (frame/agents/branches/gate/commit/compose/...) 可由 pack 扩
  severity     TEXT NOT NULL DEFAULT 'ambient',   -- ambient | notable | decision-required
  verb         TEXT,
  subject      TEXT,
  summary      TEXT,
  payload_json TEXT,                              -- 强类型 DomainEvent payload(可重放)
  refs_json    TEXT,
  ts           INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_world_seq  ON events(world_id, seq);
CREATE INDEX IF NOT EXISTS idx_events_world_tick ON events(world_id, tick);
CREATE INDEX IF NOT EXISTS idx_events_severity   ON events(world_id, severity);

-- ── 世界快照(投影, 可由 events fold 重建); last_seq = 已 fold 到的 seq ──
CREATE TABLE IF NOT EXISTS world_state (
  world_id      TEXT PRIMARY KEY,
  snapshot_json TEXT NOT NULL,
  last_seq      INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL
);

-- ── tick 运行记录 ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runs (
  id         TEXT PRIMARY KEY,
  world_id   TEXT NOT NULL,
  tick       INTEGER NOT NULL,
  status     TEXT NOT NULL,                       -- running | completed | failed | paused
  started_at INTEGER NOT NULL,
  ended_at   INTEGER,
  error      TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_world ON runs(world_id, tick);

-- ── checkpoint: 多 actor 状态(Director/registry/...) + generation ──
-- 修旧系统头号 bug: director.tension / agent 记忆没进 checkpoint → 重启空状态导演
CREATE TABLE IF NOT EXISTS checkpoints (
  world_id          TEXT NOT NULL,
  tick              INTEGER NOT NULL,
  phase             TEXT NOT NULL,
  gen               INTEGER NOT NULL,
  actor_states_json TEXT NOT NULL,                -- {director, registry:{full:[],compacted:{}}, ...}
  created_at        INTEGER NOT NULL,
  PRIMARY KEY (world_id, tick, phase)
);

-- ── scheduler: generation 号 + 下一 tick(防并发双 step, 持久化进度) ──
CREATE TABLE IF NOT EXISTS scheduler_state (
  world_id   TEXT PRIMARY KEY,
  gen        INTEGER NOT NULL DEFAULT 0,
  next_tick  INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'idle',        -- idle | running | paused | stopped
  updated_at INTEGER NOT NULL
);

-- ── 输入队列: 人/agent/作者裁决 同一种 input (ai-town inputHandler 纪律) ──
-- world 状态任何变化必由一条 input 引起 → WorldActor 单写者 drain 后改 snapshot + emit
CREATE TABLE IF NOT EXISTS input_queue (
  id           TEXT PRIMARY KEY,
  world_id     TEXT NOT NULL,
  type         TEXT NOT NULL,                     -- candidate | director-beat | author-verdict | world-edit
  payload_json TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',   -- pending | processed | rejected
  created_at   INTEGER NOT NULL,
  processed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_input_pending ON input_queue(world_id, status, created_at);

-- ════════════════════════════════════════════════════════════════════
-- 以下表数据模型现在定义(锁定设计), 由 M1+ 里程碑填充
-- ════════════════════════════════════════════════════════════════════

-- 记忆 (M1+): 真相在 events(MemoryRecorded), 此表是投影; embedding 背景 worker 填(绝不全量 rebuild)
CREATE TABLE IF NOT EXISTS memory_entries (
  entry_id     TEXT PRIMARY KEY,
  world_id     TEXT NOT NULL,
  character_id TEXT,
  kind         TEXT NOT NULL,                     -- observation | reflection | plan
  body         TEXT NOT NULL,
  payload_json TEXT,
  importance   REAL DEFAULT 0,
  ts           INTEGER NOT NULL,
  embedding    BLOB                               -- NULL → 待背景 embed
);
CREATE INDEX IF NOT EXISTS idx_mem_world_char ON memory_entries(world_id, character_id);
CREATE INDEX IF NOT EXISTS idx_mem_embed_null ON memory_entries(world_id) WHERE embedding IS NULL;

-- FTS5 contentless 镜像(CJK 分词在应用层按 code-point 预切, 不靠 unicode61)
CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
  body, entry_id UNINDEXED, content='', tokenize='trigram'
);

-- 章节 (M2+): compose 是 phase 的产物
CREATE TABLE IF NOT EXISTS chapters (
  id             TEXT PRIMARY KEY,
  world_id       TEXT NOT NULL,
  line_id        TEXT,
  goal           TEXT,
  text           TEXT,
  status         TEXT NOT NULL DEFAULT 'drafted', -- drafted | critiqued | inscribed
  scene_ids_json TEXT,
  refs_json      TEXT,
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chapters_world ON chapters(world_id, created_at);

-- canon 知识图 (M3+): 节点=角色/势力/地点/伏笔; 边=关系/因果/foreshadow→payoff
-- edge.stage_id 支持 retroactive history(事后补动机, 不改既成事实)
CREATE TABLE IF NOT EXISTS kg_nodes (
  id         TEXT PRIMARY KEY,
  world_id   TEXT NOT NULL,
  type       TEXT NOT NULL,                       -- character | faction | location | foreshadow | item | ...
  label      TEXT NOT NULL,
  props_json TEXT,
  stage_id   TEXT
);
CREATE INDEX IF NOT EXISTS idx_kgnodes_world_type ON kg_nodes(world_id, type);
CREATE TABLE IF NOT EXISTS kg_edges (
  id         TEXT PRIMARY KEY,
  world_id   TEXT NOT NULL,
  src        TEXT NOT NULL,
  dst        TEXT NOT NULL,
  type       TEXT NOT NULL,                       -- lineage | mentor | cause | foreshadow_pay | ...
  props_json TEXT,
  stage_id   TEXT
);
CREATE INDEX IF NOT EXISTS idx_kgedges_src ON kg_edges(world_id, src);
CREATE INDEX IF NOT EXISTS idx_kgedges_dst ON kg_edges(world_id, dst);

-- prior frame (M1+, deterministic): frame_hash 入 events 供重放复用(不重算 prior)
CREATE TABLE IF NOT EXISTS prior_frames (
  frame_id        TEXT PRIMARY KEY,
  world_id        TEXT NOT NULL,
  tick            INTEGER NOT NULL,
  pack_id         TEXT NOT NULL,
  frame_hash      TEXT NOT NULL,
  influences_json TEXT NOT NULL,
  ts              INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_frames_world_tick ON prior_frames(world_id, tick);

-- Director storylet/beat (M4+): NL-storylet(作者用自然语言定义触发, 不写 DSL)
CREATE TABLE IF NOT EXISTS director_beats (
  id             TEXT PRIMARY KEY,
  world_id       TEXT NOT NULL,
  trigger_nl     TEXT NOT NULL,
  behavior       TEXT NOT NULL,
  tension_effect REAL DEFAULT 0,
  props_json     TEXT,
  pack_id        TEXT
);
