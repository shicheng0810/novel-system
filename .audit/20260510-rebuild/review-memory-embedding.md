# Memory + Embedding Layer Review — 2026-05-10

Scope: `src/memory.ts`, `src/memory-index.ts`, `src/embedding-provider.ts`,
`src/metaphysics/lunar-bazi.ts`, `src/metaphysics.ts`, `src/run-store.ts`,
`src/context-cache.ts`, `src/context-pack.ts`.

Focus: data integrity, concurrency, CJK/FTS5 edge cases, vector blob
correctness, error/promise handling, HTTP robustness, lunar-javascript usage.
Style/tests/architecture-flavor suggestions intentionally excluded.

---

## Findings

### 1. `mirrorIndex()` fire-and-forgets embedding work, dropping rejections and racing concurrent writes

```
SEVERITY: HIGH
src/memory.ts:144-148  Unawaited embedding rebuild after every write
WHY: After every persist, `mirrorIndex()` calls `void this.computeAndStoreEmbeddings()`. That promise is never awaited and never attached to the calling code path. If two `writeExpression` / `syncFactsFromLine` calls overlap (which they will across runs / agent reflections), the second `rebuild()` deletes rows while the first batch's `embed()` is still in flight; the in-flight `upsert(entry, v)` then re-creates rows with stale data — and may race against another `DELETE FROM memory_entries`. Errors inside `computeAndStoreEmbeddings` are also swallowed because nothing observes the rejection. With WAL + multiple processes (allowed by `journal_mode=WAL`) this becomes silent index corruption.
FIX: Serialize writes through a per-store mutex/queue and either await the embedding pass before returning, or move embedding into a background worker that owns its own connection and uses idempotent `(kind,id)` upserts only — never `rebuild()`.
```

### 2. `MemoryIndex.rebuild()` wipes the entire SQLite index on every JSON write

```
SEVERITY: HIGH
src/memory-index.ts:178-188  DELETE FROM memory_entries inside rebuild + invoked per write
WHY: `StoryMemoryStore.mirrorIndex()` calls `index.rebuild(...)` on EVERY write. `rebuild()` runs `DELETE FROM memory_entries` (cascading via triggers into `memory_fts` row-by-row), then re-inserts everything. Beyond the O(N) cost noted in the codebase, the scary part is that this destroys all stored embeddings (`embedding`/`embedding_dim` columns) on every write — `factToIndexed`/`expressionToIndexed`/etc. call `upsertMany(indexed)` without embeddings, so the second arg is undefined and the COALESCE only protects existing rows on conflict. Since the prior rows were just deleted, there is no "existing row" to COALESCE against, so embeddings are lost on every write and have to be recomputed by the fire-and-forget pass — paying the embedding API cost on every chapter write.
FIX: Replace `rebuild()` on the hot path with delta upserts (only the changed entries via stable `(kind,id)`); keep `rebuild()` only for `createInMemoryIndex` / boot hydration.
```

### 3. `cjk_split` registered as deterministic but isn't, plus surrogate-pair blindness

```
SEVERITY: HIGH
src/memory-index.ts:396-411 + 415-417  cjkSplit misses U+20000+ Han chars and lies about determinism
WHY: Two compounding bugs. (a) The loop iterates UTF-16 code units (`text[i]`) and uses `codePointAt(0)` on each unit. Han chars in CJK Unified Ideographs Extensions B-G (U+20000–U+3134F, used widely in xianxia for archaic 仙/丹/灵 names) are encoded as surrogate pairs; the high surrogate (0xD800–0xDBFF) is not in the `0x3400–0x9FFF / 0xF900–0xFAFF` range, so these chars pass through unsplit and become un-tokenized FTS5 garbage. The symmetric `sanitizeFtsQuery` has the same bug, so user queries containing extended-plane chars never hit. (b) The function also misses common plane ranges actually inside BMP: CJK Symbols/Punctuation, Hiragana/Katakana, Hangul, full-width latin (U+FF00-U+FFEF). (c) `db.function("cjk_split", { deterministic: true }, ...)` claims determinism, but `cjkSplit` is a JS closure — if the closure ever changes (HMR / test reload) SQLite will use cached query plans against a now-different function. Marking deterministic on a JS-side function is also legitimately deterministic per-process but tools that read the DB later (re-open with a different cjk_split impl) will mis-tokenize.
FIX: Iterate by code point (`for (const ch of text)` or `Array.from(text)`), expand the range table to cover Extensions A-G + common CJK punctuation/kana/hangul, and either drop the deterministic flag or freeze the implementation behind a SCHEMA_VERSION bump.
```

### 4. FTS5 query sanitization drops characters silently, hiding bugs

```
SEVERITY: MEDIUM
src/memory-index.ts:500-541  sanitizeFtsQuery returns "" for many real queries
WHY: The cleaned regex strips quotes/punctuation and the loop only emits CJK or ASCII alphanumerics. A query like "苏雪 vs 韩渡" is fine, but a query containing accented latin (é, ä), em-dash, or numerics-with-dot ("v3.5") loses the dot and becomes the literal token `"v"`, `"3"`, `"5"` — three required tokens that almost never co-occur. More importantly, an all-punctuation query (e.g., a copy-pasted sentence the LLM produced like "「丹谷」、「外门」") goes through the strip and produces tokens "丹"/"谷"/"外"/"门" — but if the user's intent included quotes (i.e., disambiguating a phrase), the disambiguation is lost. Worse: an empty `tokens` array returns `""`, which the caller treats as "no FTS path"; the query silently degrades to recency-only fallback without any signal.
FIX: When `tokens.length === 0` after sanitization but `raw.trim().length > 0`, log a structured warning and route to vector or recency explicitly; expand the kept-character set to include latin-1 supplement letters and digits-with-dot.
```

### 5. `recall()` semantic-only path uses `semantic > 0` to select branch, masking actual hits with cosine ≤ 0

```
SEVERITY: MEDIUM
src/memory-index.ts:333-344  Score-branch selection conflates "have vector" with "useful similarity"
WHY: The `hasV = semantic > 0` test only fires when `semantic > 0`, i.e. cosine > -1 normalized to > 0.5. For embeddings without normalization (`HttpEmbeddingProvider` with `normalize: false`, or any caller-provided vector), legitimate matches with cosine in [-1, 0] map to semantic ∈ [0, 0.5]. Using `> 0` strictly filters NOTHING (everything is ≥ 0), so this is OK in practice, but the fallback `else if (hasV || req.queryEmbedding)` is reached even when semantic === 0 because no row had an embedding (i.e., entries with `row.embedding == null`). In that case the score becomes `0.55*0 + 0.3*recency + 0.15*importance` instead of the recency-default `0.65*recency + 0.35*importance` — i.e., embedding-less rows mixed into a vector query get a max score of 0.45 (not 1.0). They are reachable to the recall pool only because the JOIN includes them via `m.embedding IS NOT NULL` filter — wait, the vector path filters `m.embedding IS NOT NULL`, so the only way `req.queryEmbedding` is set AND a row with no embedding exists in `rows` is via the BM25 path. That hybrid case demotes BM25-good rows that have no embedding more than the spec implies.
FIX: Track separate booleans `hasQueryVec` (request had embedding) and `hasRowVec` (this specific row matched on embedding); only route to "vector-only" weighting when `hasRowVec`. Otherwise reuse the BM25 weights.
```

### 6. `vectorToBlob` returns a Buffer view sharing the underlying ArrayBuffer — mutation propagates

```
SEVERITY: MEDIUM
src/embedding-provider.ts:65-67  Buffer.from(arrayBuffer, ...) is non-copying
WHY: `Buffer.from(v.buffer, v.byteOffset, v.byteLength)` creates a Buffer that shares memory with the original Float32Array. better-sqlite3 binds blobs by copying at bind-time (so SQLite stores a snapshot), but the returned Buffer is still mutable from the caller's perspective. If the caller reuses the same Float32Array slot (e.g., `provider.embed` returns a pooled buffer) the Buffer reference passed downstream is no longer the value that was embedded. The current `MockEmbeddingProvider` allocates a fresh `Float32Array(this.dim)` per call, so this is latent. But `HttpEmbeddingProvider` builds fresh too — until someone introduces pooling. Combined with the fact that `vectorToBlob` is also exported for external use, this is a footgun.
FIX: Copy into a fresh Buffer: `Buffer.from(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength))` or `const b = Buffer.allocUnsafe(v.byteLength); b.set(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)); return b;`.
```

### 7. Float32 endianness is implicitly little-endian and not declared in schema

```
SEVERITY: MEDIUM
src/embedding-provider.ts:65-80 + src/memory-index.ts:438  Stored vectors break on big-endian readers
WHY: `vectorToBlob`/`blobToVector` use the host's native byte order (typed array views). All current Node deployments are LE, but the `embedding` column has no marker recording that. If an index DB is ever moved to a BE host (e.g., zSeries, big-endian ARM build, or even via a future CI on different arch) the stored floats become garbage with no schema-level error. SCHEMA_VERSION = 1 carries no endianness/format tag, so detection is impossible after the fact.
FIX: Document LE-only in `embedding-provider.ts`, OR write floats explicitly via `DataView.setFloat32(i*4, v[i], true)` and read with `getFloat32(..., true)`. Bump SCHEMA_VERSION and reject mismatched format.
```

### 8. HTTP embedding provider lacks retries and trusts response shape blindly

```
SEVERITY: MEDIUM
src/embedding-provider.ts:158-200  No retry on transient failure; assumes data[].embedding is well-formed
WHY: `HttpEmbeddingProvider.embedBatch` does a single fetch with no retry on 429/5xx/timeout; the caller (memory store) only `console.warn`s and skips, leaving entries permanently un-embedded until the next mirrorIndex rebuild (which currently runs on every write — see #2 — but if that's fixed, the gap is permanent). Additionally the response is parsed as `{ data?: { embedding: number[] }[] }` with no validation: if the provider returns `{ data: [{ embedding: null }] }` (some providers do this for over-length input), `new Float32Array(d.embedding.length)` throws TypeError on `null.length`, which is caught nowhere along the path; if the provider returns embeddings with wrong dim (e.g., model mismatch), it silently stores them and the recall code's `v.length === req.queryEmbedding.length` check rejects them at recall time but the corrupt blob lives forever. There's also no Content-Type sniffing — a 200 response that returns HTML (cloudflare challenge) hits `res.json()` which throws SyntaxError as an unhelpful failure mode.
FIX: Add bounded exponential-backoff retry on 429/5xx/AbortError; validate `Array.isArray(d.embedding) && d.embedding.length === this.dim`; type-narrow before constructing Float32Array; record dim mismatches as poison entries rather than silently storing them.
```

### 9. JSON persist + checkpoint writes are non-atomic — partial-write corruption

```
SEVERITY: MEDIUM
src/memory.ts:53-56, src/run-store.ts:24-27, src/context-cache.ts:46,92  writeFile is not atomic
WHY: All three flush helpers use plain `writeFile(path, JSON.stringify(...))`. If the process is killed mid-write (SIGINT, OOM, watchdog), the file ends up truncated/empty/partial. On next read, `readJson` either throws (run-store, context-cache) or silently returns `EMPTY_STATE` because `memory.ts::readJson` swallows any parse error in its catch — meaning a SIGKILL during memory persist resets `state` to empty on next boot, but the SQLite mirror still holds the prior data. The two get out of sync without any error surface. For `run-store.saveRun`, a partial write of `manifest.json` plus a successful checkpoint write leaves the run unloadable but checkpoint-restorable, also without an error.
FIX: Write to `${path}.tmp`, fsync, then `rename(.tmp, path)` for all three. Optionally compute checksum into the JSON payload itself for self-validation on read.
```

### 10. `lunar-bazi.ts` accepts impossible dates and silently rolls them

```
SEVERITY: MEDIUM
src/metaphysics/lunar-bazi.ts:175-217  computeBaziFromBirth({year:2025,month:2,day:30}) does not throw
WHY: lunar-javascript's `Solar.fromYmdHms` only checks `m∈[1,12]` and `d∈[1,31]`; it does not validate that the day exists in the month. Feb 30, Apr 31, Feb 29 in non-leap years all pass through and produce SOME pillar (lunar-javascript internally rolls via its own date arithmetic — the result depends on internals and is not the right pillar for the user's intent). For a xianxia narrative, getting the wrong year-pillar at boundary cases would silently propagate to FateProfile and downstream NPC personality. Worse: the wrapper neither pre-validates against `new Date(y, m-1, d)` round-trip nor surfaces the rolled date back to the caller.
FIX: Pre-validate via `const probe = new Date(y, m-1, d); if (probe.getFullYear()!==y || probe.getMonth()!==m-1 || probe.getDate()!==d) throw ...` before calling Solar.fromYmdHms.
```

### 11. `parseBaziSpec` regex accepts impossible time values

```
SEVERITY: LOW
src/metaphysics/lunar-bazi.ts:274-295  Time tokens unbounded in regex
WHY: The dispatcher regex matches `(\d{1,2}):(\d{1,2})`, accepting "1981-08-19 25:99" — the captured groups go into `computeBaziFromBirth` which throws via lunar-javascript's hour validation but ALSO the regex permits 2-digit days >31 and months >12 to dispatch into the datetime path and only fail at lunar-javascript layer with a generic "wrong month" / "wrong hour" error, not a user-meaningful "spec invalid". Combined with #10, a borderline-invalid spec like "1981-13-01 12:00" gets a confusing error.
FIX: Tighten the regex to year/month/day/hour ranges, OR catch lunar-javascript errors and re-throw with the original spec for traceability.
```

### 12. `parsePillarsRaw` day-master assumes a fixed pillar order that the wrapper doesn't enforce

```
SEVERITY: LOW
src/metaphysics/lunar-bazi.ts:230-264  dayMaster = pillars[2][0] is convention-based
WHY: The function accepts ANY 4 stem-branch pairs. For "辛巳,癸酉,己亥,乙丑" the day pillar is conventionally the third — but that's not enforceable from the input alone. If a fixture file or user enters pillars in non-standard order (e.g., chronological from "now back to year"), `dayMaster` is wrong, and everything downstream that consumes `tenGodHints`/`favorableElements` is wrong. There's no way to detect this. The legacy `metaphysics.ts::parseBaziRaw` chains into this so the same risk exists for legacy callers.
FIX: Document the convention prominently in the type's JSDoc and in `BaziChart` domain type; better, accept named pillars `{year,month,day,hour: StemBranch}` as the public input form and provide `parsePillarsRawNamed`.
```

### 13. `context-cache.findReusablePrefix` has a TOCTOU + read race against concurrent writers

```
SEVERITY: LOW
src/context-cache.ts:59-70 + 84-94  recordHit reads-then-writes without locking
WHY: `findReusablePrefix` calls `listSnapshots()` which reads every JSON file, then for the best match calls `recordHit` which re-reads the file and writes back with `hits+1`. Two concurrent runs sharing one cache directory will lose a hit (classic lost-update). Worse, on macOS a partial `writeFile` from a parallel `recordHit` mid-`listSnapshots` will cause `JSON.parse` in `listSnapshots` to throw and crash the entire pack lookup. (See #9 for the underlying non-atomic write issue.)
FIX: Either use a file-lock library (proper-lockfile) around the read-then-write pair, or store hit counts in SQLite where atomicity is free.
```

### 14. `run-store.writeArtifact` mutates input.run.artifacts.refs, breaking caller's "immutable run" assumption

```
SEVERITY: LOW
src/run-store.ts:167-196  Mutating push on caller's artifacts.refs array
WHY: All other methods (`appendStep`, `completeLatestStep`, `markRun`) return a fresh `SimulationRun` via spread. `writeArtifact` instead mutates `run.artifacts.refs.push(artifact)` in-place AND does not call `saveRun()` — so the artifact ref is persisted only if the caller runs `saveRun(run)` afterwards. `createRun` calls `writeArtifact` then `saveRun(run)`, which works, but any later `writeArtifact` (e.g., a step that produces an output artifact) without a follow-up `saveRun` leaves the manifest out-of-sync with the on-disk file. Since multiple steps' output writes typically don't call `saveRun` between them, refs accumulate in memory but aren't persisted until the next `appendStep`/`saveRun`.
FIX: Either (a) make writeArtifact return a new run object and force callers to use it, or (b) call `saveRun(updated)` inside writeArtifact after pushing the ref.
```

### 15. `MemoryIndex.upsert`'s `rowid` collision risk between memory_entries and memory_fts

```
SEVERITY: LOW
src/memory-index.ts:454-462  Triggers insert with rowid=NULL → autoincrement, no link to memory_entries.rowid
WHY: The FTS5 trigger does `INSERT INTO memory_fts(rowid, summary, text, kind, id) VALUES (NULL, ...)` — using NULL means SQLite auto-assigns the next rowid. After many insert/delete cycles, the FTS5 rowid space drifts away from `memory_entries.rowid`. The DELETE trigger uses `WHERE id = old.id AND kind = old.kind` which is correct logically, but since `id` and `kind` are UNINDEXED columns on the FTS5 virtual table, every delete is an O(N) scan of the index. Combined with the fact that `mirrorIndex` does `DELETE FROM memory_entries` (firing N DELETE triggers, each scanning all rows), purging a 10k-entry index becomes O(N²). With current rebuild-on-every-write, this hits production hard once the index grows.
FIX: Instead of (rowid=NULL, id=str), use a stable hash like `rowid = hash(kind || ':' || id) & 0x7fff_ffff` so DELETEs become O(log N), or — better — switch to FTS5 contentless (`content=''` + manual sync) and key on a deterministic composite key. Also add `INSERT OR IGNORE` semantics around triggers to make them idempotent.
```

---

## Confidence summary

- High confidence on findings #1, #2, #3 (mirrorIndex unawaited + rebuild-on-every-write + cjk_split surrogate pairs): these are read directly from the code and the runtime impact is concrete (silent embedding loss, perf cliff, CJK extension chars unsearchable).
- High confidence on #4-#7 (FTS5 sanitization, score-branch selection, blob aliasing, endianness): visible from code; severity calibrated by realistic xianxia workload.
- Medium-high confidence on #8, #9 (HTTP retry, atomic writes): straightforward gaps verified by reading the code paths end-to-end.
- High confidence on #10, #11 (date validation): verified directly against the bundled lunar-javascript source — `Solar.fromYmdHms` does NOT validate day-in-month, only `m∈[1,12]` and `d∈[1,31]`.
- Medium confidence on #13-#15 (cache TOCTOU, run-store mutation, FTS5 rowid drift): real bugs but lower production impact for the current single-process workbench mode; will sting when concurrency lands.

The dominant risk class is **silent corruption from unawaited async + non-atomic writes + index rebuild semantics**. Fixing #1 + #2 + #9 in one pass would eliminate roughly 80% of the data-integrity attack surface.
