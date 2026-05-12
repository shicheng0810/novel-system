-- Novel System v3 · single SQLite schema (one file: world.db)
-- All v3 persistence lives here. Multiple subsystems share the same connection.
-- See plan: /root/.claude/plans/system-reminder-you-re-running-in-buzzing-kitten.md

-- =============================================================================
-- _meta · schema version + arbitrary key/value
-- =============================================================================
CREATE TABLE IF NOT EXISTS _meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- =============================================================================
-- events · WorldEvent log, append-only, single source of truth
-- Every world-state change emits an event before the reducer applies it.
-- =============================================================================
CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,        -- idempotency key: subsystem+phase+sourceRef
  ts          INTEGER NOT NULL,        -- epoch ms
  world_id    TEXT,
  run_id      TEXT,
  chapter_id  TEXT,
  scene_id    TEXT,
  subsystem   TEXT NOT NULL,           -- runtime|compose|memory|atlas|canon|character-agent|qimen|promotion|pause|frame|branches|gate|commit|inscribe
  severity    TEXT NOT NULL,           -- ambient|notable|decision-required
  status      TEXT NOT NULL,           -- started|progress|succeeded|failed|blocked
  phase       TEXT,                    -- frame|agents|branches|gate|commit|memory-read|blueprint|scene-cards|synthesize|review|inscribe|null
  verb        TEXT NOT NULL,           -- literary verb e.g. "取材"
  subject     TEXT NOT NULL,           -- short subject e.g. "本章"
  summary     TEXT NOT NULL,           -- one-line author-readable
  refs_json   TEXT,                    -- JSON blob of related ids
  expires_at  INTEGER                  -- ambient events may be merged after this
);

CREATE INDEX IF NOT EXISTS idx_events_ts            ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_run           ON events(run_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_chapter       ON events(chapter_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_subsystem     ON events(subsystem, ts);
CREATE INDEX IF NOT EXISTS idx_events_severity      ON events(severity, ts);
CREATE INDEX IF NOT EXISTS idx_events_world         ON events(world_id, ts);

-- =============================================================================
-- runs · per-tick run record
-- =============================================================================
CREATE TABLE IF NOT EXISTS runs (
  run_id        TEXT PRIMARY KEY,
  world_id      TEXT NOT NULL,
  thread_id     TEXT NOT NULL,        -- daemon thread / session
  tick_index    INTEGER NOT NULL,
  started_at    INTEGER NOT NULL,
  finished_at   INTEGER,
  status        TEXT NOT NULL,        -- running|paused|completed|failed
  directive_json TEXT NOT NULL,       -- StageDirective as JSON
  result_json   TEXT                  -- TickResult summary as JSON (when complete)
);

CREATE INDEX IF NOT EXISTS idx_runs_thread ON runs(thread_id, tick_index);
CREATE INDEX IF NOT EXISTS idx_runs_world  ON runs(world_id, started_at);

-- =============================================================================
-- world_state · latest snapshot per world (one row per worldId)
-- snapshot_json is the materialized view; rebuilt by replaying events.
-- =============================================================================
CREATE TABLE IF NOT EXISTS world_state (
  world_id        TEXT PRIMARY KEY,
  parsed_json     TEXT NOT NULL,        -- ParsedWorldDraft (frozen at apply-draft time)
  snapshot_json   TEXT NOT NULL,        -- WorldSnapshot (live, mutated by reducer)
  last_event_id   TEXT,                 -- watermark: last event applied to snapshot
  updated_at      INTEGER NOT NULL
);

-- =============================================================================
-- world_history · committed stages, ordered by stage_number
-- =============================================================================
CREATE TABLE IF NOT EXISTS world_history (
  stage_id       TEXT PRIMARY KEY,
  world_id       TEXT NOT NULL,
  line_id        TEXT NOT NULL,        -- "canon" or branch id
  stage_number   INTEGER NOT NULL,
  stage_label    TEXT NOT NULL,
  ts             INTEGER NOT NULL,
  events_json    TEXT NOT NULL,        -- HistoryEvent[]
  snapshot_json  TEXT NOT NULL         -- WorldSnapshot after this stage
);

CREATE INDEX IF NOT EXISTS idx_history_line ON world_history(world_id, line_id, stage_number);

-- =============================================================================
-- chapters · chapter drafts + scene cards (compose pipeline output)
-- =============================================================================
CREATE TABLE IF NOT EXISTS chapters (
  chapter_id     TEXT PRIMARY KEY,
  world_id       TEXT NOT NULL,
  line_id        TEXT NOT NULL,
  stage_id       TEXT,
  status         TEXT NOT NULL,       -- drafting|reviewed|inscribed|rejected
  lens_json      TEXT NOT NULL,       -- NarrativeLens
  scenes_json    TEXT,                -- SceneCard[]
  draft_text     TEXT,
  review_json    TEXT,                -- ReviewReport
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chapters_world ON chapters(world_id, updated_at);

-- =============================================================================
-- memory · facts / expressions / foreshadows / revisions
-- One table with `kind` discriminator + dedicated FTS5 mirror.
-- =============================================================================
CREATE TABLE IF NOT EXISTS memory_entries (
  entry_id       TEXT PRIMARY KEY,
  world_id       TEXT NOT NULL,
  line_id        TEXT NOT NULL,
  kind           TEXT NOT NULL,       -- fact|expression|foreshadow|revision
  character_ids  TEXT,                -- JSON array
  importance     REAL NOT NULL DEFAULT 0,
  recency_ts     INTEGER NOT NULL,
  active         INTEGER NOT NULL DEFAULT 1,
  payload_json   TEXT NOT NULL,       -- full entry (kind-specific shape)
  embedding      BLOB,                -- Float32Array LE bytes; NULL if no embedder
  created_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_kind   ON memory_entries(world_id, line_id, kind, recency_ts);
CREATE INDEX IF NOT EXISTS idx_memory_active ON memory_entries(world_id, line_id, active);

-- FTS5 mirror for keyword recall. Triggers below keep it in sync.
-- trigram tokenizer handles CJK (every 3-character window is a token); the
-- memory-service in Phase 2 will pad shorter author queries with `LIKE`
-- fallbacks so 2-character names like "苏雪" still match.
CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
  entry_id UNINDEXED,
  body,
  tokenize = 'trigram'
);

CREATE TRIGGER IF NOT EXISTS memory_fts_insert AFTER INSERT ON memory_entries BEGIN
  INSERT INTO memory_fts(entry_id, body) VALUES (new.entry_id, new.payload_json);
END;
CREATE TRIGGER IF NOT EXISTS memory_fts_update AFTER UPDATE ON memory_entries BEGIN
  DELETE FROM memory_fts WHERE entry_id = old.entry_id;
  INSERT INTO memory_fts(entry_id, body) VALUES (new.entry_id, new.payload_json);
END;
CREATE TRIGGER IF NOT EXISTS memory_fts_delete AFTER DELETE ON memory_entries BEGIN
  DELETE FROM memory_fts WHERE entry_id = old.entry_id;
END;

-- =============================================================================
-- atlas_nodes · derived markdown tree per line
-- =============================================================================
CREATE TABLE IF NOT EXISTS atlas_nodes (
  node_path     TEXT NOT NULL,
  world_id      TEXT NOT NULL,
  line_id       TEXT NOT NULL,
  kind          TEXT NOT NULL,        -- file|directory
  body          TEXT,                 -- markdown content for files
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (world_id, line_id, node_path)
);

-- =============================================================================
-- metaphysics_frames · one frame per tick (audit + UI breakdown)
-- =============================================================================
CREATE TABLE IF NOT EXISTS metaphysics_frames (
  frame_id      TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL,
  world_id      TEXT NOT NULL,
  stage_number  INTEGER NOT NULL,
  ts            INTEGER NOT NULL,
  frame_json    TEXT NOT NULL         -- MetaphysicsFrame
);

CREATE INDEX IF NOT EXISTS idx_frames_run   ON metaphysics_frames(run_id);
CREATE INDEX IF NOT EXISTS idx_frames_world ON metaphysics_frames(world_id, ts);

-- =============================================================================
-- checkpoints · per-tick + per-phase checkpoint for crash recovery
-- =============================================================================
CREATE TABLE IF NOT EXISTS checkpoints (
  thread_id     TEXT NOT NULL,
  tick_index    INTEGER NOT NULL,
  phase         TEXT NOT NULL,       -- frame|agents|...|inscribe
  ts            INTEGER NOT NULL,
  state_json    TEXT NOT NULL,       -- partial TickContext
  PRIMARY KEY (thread_id, tick_index, phase)
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_thread ON checkpoints(thread_id, tick_index);

-- =============================================================================
-- ai_settings · single row, persisted DeepSeek profile (replaces studio-config.json)
-- =============================================================================
CREATE TABLE IF NOT EXISTS ai_settings (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  api_key        TEXT,
  base_url       TEXT,
  model          TEXT,
  timeout_ms     INTEGER,
  thinking_mode  TEXT,
  reasoning_effort TEXT,
  context_window_tokens INTEGER,
  max_output_tokens INTEGER,
  embedding_api_key   TEXT,
  embedding_base_url  TEXT,
  embedding_model     TEXT,
  embedding_dim       INTEGER,
  updated_at     INTEGER NOT NULL
);
