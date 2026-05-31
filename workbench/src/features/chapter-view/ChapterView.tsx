import { useCallback, useEffect, useRef, useState } from "react";

import { api } from "../../lib/api";
import { useEventStore } from "../../stores/useEventStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { useUIStore } from "../../stores/useUIStore";

type ChapterListItem = Awaited<ReturnType<typeof api.chaptersList>>[number];
type Chapter = NonNullable<Awaited<ReturnType<typeof api.chaptersGet>>>;

export function ChapterView() {
  const worldId = useSessionStore((s) => s.worldId);
  const lineId = useSessionStore((s) => s.lineId);
  const inscribeEvent = useEventStore((s) =>
    (s.bySubsystem.compose ?? []).find((e) => e.phase === "inscribe" && e.status === "succeeded"),
  );
  // P1-E · Per-chapter scroll position persists via useUIStore.
  const scrollPositions = useUIStore((s) => s.chapterScrollPositions);
  const saveScroll = useUIStore((s) => s.saveChapterScroll);

  const [list, setList] = useState<ChapterListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(false);
  // P2-A · Error state + retry counter (retryNonce flips to re-trigger effect).
  const [chapterError, setChapterError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  // P1-E · Ref to the scrollable container so we can save/restore scrollTop.
  const containerRef = useRef<HTMLDivElement>(null);
  // P1-E · Track previous selectedId so we save scroll for the OUTGOING chapter.
  const prevSelectedRef = useRef<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    const rows = await api.chaptersList(worldId, lineId, 20);
    setList(rows);
    if (rows[0] && !selectedId) setSelectedId(rows[0].chapterId);
  }, [worldId, lineId, selectedId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Refresh list whenever a new chapter is inscribed.
  useEffect(() => {
    if (!inscribeEvent) return;
    void refresh();
  }, [inscribeEvent?.id, refresh]);

  useEffect(() => {
    // P1-E · Save scroll for the OUTGOING chapter before switching.
    const prev = prevSelectedRef.current;
    if (prev && containerRef.current) {
      saveScroll(prev, containerRef.current.scrollTop);
    }
    prevSelectedRef.current = selectedId;

    if (!selectedId) {
      setChapter(null);
      setChapterError(null);
      return;
    }
    setLoading(true);
    setChapterError(null);
    api.chaptersGet(selectedId)
      .then((c) => {
        setChapter(c);
        // P1-E · Restore scroll after the new chapter has rendered (next frame).
        const target = scrollPositions[selectedId] ?? 0;
        requestAnimationFrame(() => {
          if (containerRef.current) containerRef.current.scrollTop = target;
        });
      })
      // P2-A · Surface the error instead of failing silently.
      .catch((err: unknown) => {
        setChapter(null);
        setChapterError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
    // retryNonce intentional dependency so 重试 button re-fires this effect.
  }, [selectedId, retryNonce, saveScroll, scrollPositions]);

  if (list.length === 0) {
    return (
      <div className="chapter-view chapter-view--empty">
        尚无章节。启动 daemon 跑几个 tick，daemon 会按 composeEvery 节奏产出章节。
      </div>
    );
  }

  return (
    <div className="chapter-view" ref={containerRef}>
      <div className="chapter-view__bar">
        <label>
          章节：
          <select value={selectedId ?? ""} onChange={(e) => setSelectedId(e.target.value)}>
            {list.map((row) => (
              <option key={row.chapterId} value={row.chapterId}>
                {row.lens.chapterGoal ?? row.chapterId.slice(0, 24)} · {row.status}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="ghost" onClick={() => void refresh()}>
          ↻ 刷新
        </button>
      </div>

      {loading && <div className="chapter-view__loading">载入中…</div>}

      {!loading && chapterError && (
        <div className="chapter-view__error">
          <div className="chapter-view__error-title">章节载入失败</div>
          <div className="chapter-view__error-detail">{chapterError}</div>
          <button
            type="button"
            className="ghost chapter-view__retry"
            onClick={() => setRetryNonce((n) => n + 1)}
          >
            ↻ 重试
          </button>
        </div>
      )}

      {!loading && !chapterError && chapter && (
        <article className="chapter-view__body">
          <header>
            <h2>{chapter.lens.chapterGoal ?? "章节"}</h2>
            <p className="chapter-view__meta">
              焦点：{chapter.lens.focusCharacterIds.join("、")} · 状态：{chapter.status}
            </p>
          </header>

          {chapter.text.split(/\n{2,}/).map((para, idx) => (
            <p key={idx}>{para}</p>
          ))}

          {chapter.review && (
            <aside className={`chapter-review chapter-review--${chapter.review.passed ? "pass" : "fail"}`}>
              <div className="chapter-review__title">自审：{chapter.review.passed ? "通过" : "未过"}</div>
              {chapter.review.issues.length > 0 && (
                <div className="chapter-review__group">
                  <strong>阻断 ({chapter.review.issues.length})</strong>
                  <ul>
                    {chapter.review.issues.map((i, k) => (
                      <li key={k}>{i}</li>
                    ))}
                  </ul>
                </div>
              )}
              {chapter.review.warnings.length > 0 && (
                <div className="chapter-review__group">
                  <strong>警告 ({chapter.review.warnings.length})</strong>
                  <ul>
                    {chapter.review.warnings.map((w, k) => (
                      <li key={k}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {chapter.review.styleNotes.length > 0 && (
                <div className="chapter-review__group">
                  <em>{chapter.review.styleNotes.join(" · ")}</em>
                </div>
              )}
            </aside>
          )}
        </article>
      )}
    </div>
  );
}
