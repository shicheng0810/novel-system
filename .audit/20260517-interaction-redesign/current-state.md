# Current-State Audit · Interaction Logic

## 1. User Journey Map

### Typical Happy Path: "Load World → Start Daemon → Write Chapter"

1. **App loads** (App.tsx:30-35)
   - useEffect() hooks SSE subscribe via `useEventStore.connect({ worldId })`
   - Parallel: `refreshDaemon()` + `refreshSession()` fetch daemon status & world snapshot
   - If `snapshot` is null → show WorldUploader component (App.tsx:77-79)
   - Feedback: no visual spinner; SSE dot in StatusBar silently transitions "idle" → "connecting" → "open"

2. **User clicks "▶ 加载示例世界"** (WorldUploader.tsx:59-61)
   - Trigger: button in main canvas area
   - Feedback: button disables, status text shows "加载中…" (loading) → "已加载 · 4 角色 · 来源 示例世界" (success)
   - Side effect: `refresh()` refetches snapshot; world now loads in CodexRail 世界 tab
   - **Pain point**: No auto-collapse, no navigation prompt. User still sees uploader form below success message.

3. **Daemon starts: BottomPanel form → "▶ 启动" clicked** (BottomPanel.tsx:81-97)
   - Trigger: SimControls button in collapsible BottomPanel
   - Form inputs: targetTicks=5, composeEvery=3, focusCharacterIds=[], chapterGoal="推进核心冲突"
   - Flow: `start()` → api.daemonStart() → SSE starts emitting runtime events
   - Feedback: BottomPanel bar updates: "▢ 0/0" → "▶ 推演 · 1/5" (live via runtime event ingestion)
   - TicLog auto-populates with merged runtime + compose events (newest first, up to 40 items)
   - User sees lamp animation light up in SixStageProgress (新增功能，保持不动)

4. **On composeEvery tick (e.g., tick 3)** (ChapterView.tsx:33-36)
   - SSE emits compose event with phase="inscribe" + status="succeeded"
   - useEffect hook detects inscribeEvent change → `refresh()` refetches chapter list
   - Chapter appears in dropdown; auto-selected if selectedId undefined (ChapterView.tsx:25)
   - User switches to "已成章节" tab, sees new chapter rendered with meta + review notes

5. **Daemon completes** (StatusBar.tsx:13-19, BottomPanel.tsx:14-20)
   - runtime event: status="succeeded", completedTicks=5/5
   - BottomPanel pill changes "▶" to "✓"; TickLog frozen
   - User can pause/resume at any point; "恢复" button only enabled if status.paused=true

### Confusion Points in Journey

- After loading world, user sees uploader still on screen (success message + form)—unclear if they should proceed
- SlashMenu "/" mentioned in placeholder (WritingCanvas.tsx:50) but only works in draft textarea, not intuitive
- DecisionInbox appears in CodexRail Now tab but user doesn't know WHEN to look—no badge/notification
- CommandPalette ⌘K provides daemon-start buttons, duplicating BottomPanel form—user might not discover quick 5-step start

---

## 2. Per-Feature Inventory

### 2.1 WorldUploader
**File**: workbench/src/features/world-uploader/WorldUploader.tsx

| Aspect | Implementation |
|--------|-----------------|
| **Trigger** | App.tsx line 79: only shown if `snapshot === null`. Three buttons: "加载示例" (line 59), file input (line 62), textarea submit (line 78) |
| **Feedback** | Single `status` state: "idle" → "loading" → "success" → "error". Message updates (line 24, 27, 39). Button disabled during loading |
| **Empty state** | Entire component is the empty state; shows hint + three actions |
| **Error state** | status="error", message shows API error or validation error (e.g., "请粘贴 Markdown 内容") |
| **Information hierarchy** | Hint text explains the three paths; success message shows character count + source |
| **Cross-feature coupling** | Calls `useSessionStore.refresh()` on success; no navigation or modal close behavior |

**Interaction issues**:
- Success message does not auto-hide or collapse the form
- No indication to user that they should proceed next (daemon start or explore world)
- File input doesn't give user feedback until after upload completes

---

### 2.2 CommandPalette (⌘K)
**File**: workbench/src/features/command-palette/CommandPalette.tsx

| Aspect | Implementation |
|--------|-----------------|
| **Trigger** | Global keybinding ⌘K / Ctrl+K (App.tsx:53-54) OR topbar button click (App.tsx:72) |
| **Feedback** | Modal overlay appears, input autofocus. Selection highlighted. Enter executes; Esc closes. Click overlay closes |
| **Empty state** | If query matches no commands, shows "没有匹配命令" (line 134) |
| **Error state** | None—commands are pre-defined, no API calls except embedded in command run() |
| **Information hierarchy** | 7 commands, each with label + optional hint (API endpoint or constraint). Search filter (case-insensitive substring) |
| **Cross-feature coupling** | Directly invokes daemon start/pause, settings open, mode/tab switches |

**Seven commands** (CommandPalette.tsx:31-77):
1. "加载示例世界" - POST /api/world/apply-draft (duplicate of WorldUploader button)
2. "启动 daemon · 5 步 · composeEvery=3" - convenience preset
3. "启动 daemon · 1 步（不 compose）" - single-step debug mode
4. "暂停 daemon" - pause button
5. "打开 AI 设置" - toggles SettingsModal
6. "切到 Codex Rail · 记忆 tab" - setMode("memory")
7. "切到 Codex Rail · 图谱 tab" - setMode("atlas")

**Interaction issues**:
- **Redundancy**: daemon-start commands duplicate BottomPanel SimControls form. User doesn't know which to use
- **Discoverability**: no tutorial or hint that this palette exists beyond ⌘K button in topbar
- **Load-sample redundancy**: also in WorldUploader—two paths to same action

---

### 2.3 SettingsModal (AI config)
**File**: workbench/src/features/settings/SettingsModal.tsx

| Aspect | Implementation |
|--------|-----------------|
| **Trigger** | Topbar ⚙ button (App.tsx:73) OR CommandPalette "打开 AI 设置" |
| **Feedback** | useEffect (line 41-62) fetches current settings on open. Save button disables during save. Status message: "已保存 · LLM + embedder 已重建" or error |
| **Empty state** | Form pre-populated with defaults (lines 19-30). Saved mask shows e.g., "sk-...bc9a" in help text (line 102) |
| **Error state** | status="error", message shows fetch/save error. Form preserves user input |
| **Information hierarchy** | Two sections: DeepSeek (LLM) + Embedding (optional). Saved API key mask displayed, "留空保留" hint |
| **Cross-feature coupling** | api.settingsAiGet() on mount, api.settingsAiSave(payload) on submit |

**Save flow** (SettingsModal.tsx:64-87):
- Validates only that payload excludes blank keys (lines 78-79)
- No client-side validation of API key format or baseURL syntax
- Success message acknowledges server will rebuild LLM + embedder
- **Pain point**: No indication of how long rebuild takes or if it blocks daemon

---

### 2.4 DecisionInbox
**File**: workbench/src/features/decision-inbox/DecisionInbox.tsx

| Aspect | Implementation |
|--------|-----------------|
| **Trigger** | Only visible in CodexRail Now tab (CodexRail.tsx:45-51). Events are auto-ingested via SSE |
| **Feedback** | useEventStore selector filters events with severity="decision-required". Items show verb + summary (no action buttons) |
| **Empty state** | "没有待裁决项" (line 7)—entire component shrinks |
| **Error state** | None—passive display of streamed events |
| **Information hierarchy** | Heading shows count "待裁决 · {count}". Each item is a li with verb (bold) + summary (muted) |
| **Cross-feature coupling** | Reads from useEventStore.decisions (populated in useEventStore.ingest, line 40-43) |

**Event decision lifecycle** (useEventStore.ts:40-43):
- Severity="decision-required" events are prepended to decisions array (maxlen=20)
- When same event.id re-ingests with status="succeeded", it's removed (line 43)
- **Major issue**: No UI affordance to "resolve" or "dismiss" a decision. User can't interact. Unclear what "resolve" even means.

---

### 2.5 WorldEchoes (event feed)
**File**: workbench/src/features/world-echoes/WorldEchoes.tsx

| Aspect | Implementation |
|--------|-----------------|
| **Trigger** | CodexRail Now tab, auto-visible. Events streamed via SSE |
| **Feedback** | Selector filters to severity != "ambient", limits to 8 items (line 10-11). Time + severity badge + verb + summary displayed |
| **Empty state** | "还没有回响" (line 15) |
| **Error state** | None—passive display |
| **Information hierarchy** | Timestamp (muted), severity label ("·" ambient / "★" notable / "!" decision), verb (bold), summary |
| **Cross-feature coupling** | Reads from useEventStore.events. Subscribed via useEventStore.connect() in App.tsx |

**Interaction issues**:
- Events are read-only, no click-to-expand or detail view
- Filtering logic hard-coded to exclude ambient + limit 8; user can't configure which subsystems to monitor
- **Auto-scroll not implemented**: new events prepend to list but don't scroll into view

---

### 2.6 ChapterView (chapter reader + switcher)
**File**: workbench/src/features/chapter-view/ChapterView.tsx

| Aspect | Implementation |
|--------|-----------------|
| **Trigger** | WritingCanvas.tsx tab="chapters". Auto-fetches list on mount (line 29) and when new inscribe event arrives (line 33-36) |
| **Feedback** | Loading spinner shows "载入中…" (line 75) while chapter detail loads. Select dropdown shows chapterId + status + goal |
| **Empty state** | "尚无章节。启动 daemon…" (line 50-54)—explains what to do |
| **Error state** | If api.chaptersGet() fails, chapter stays null; no error message shown |
| **Information hierarchy** | Goal (h2) prominent; metadata (focus characters, status) muted; review notes (issues/warnings/style) in aside below prose |
| **Cross-feature coupling** | Reads worldId + lineId from useSessionStore. Subscribes to inscribeEvent from useEventStore to auto-refresh |

**Chapter selection**:
- Dropdown filled from chaptersList(); selectedId state (line 18)
- Auto-select first chapter if list[0] exists and selectedId unset (line 25)
- **Pain point**: Scroll position not preserved when switching chapters (no useMemo or scroll-to-top)
- Refresh button manually re-fetches list (line 70)

---

### 2.7 BottomPanel (simulation controls + log)
**File**: workbench/src/features/bottom-panel/BottomPanel.tsx

| Aspect | Implementation |
|--------|-----------------|
| **Trigger** | Always visible at bottom. Bar is clickable (line 24, toggles open). Content inside collapsible section |
| **Feedback** | Summary pill updates live: "▢ 0/0" → "▶ 1/5" → "✓ 5/5" (status from useDaemonStore). Chevron "▾/▴" toggles on expand |
| **Empty state** | When daemon never started, pill shows "▢ 0/0"; decisions shows "· ★ 0 决策" |
| **Error state** | None—status is always readable even if daemon encounters error |
| **Information hierarchy** | Bar: summary pill (left) + decision count (center) + chevron (right). Body: SimControls form + TickLog list |
| **Cross-feature coupling** | useDaemonStore.status drives pill update; useEventStore.decisions shows decision count; SimControls refs parsed characters |

**SimControls form** (BottomPanel.tsx:39-103):
- Input fields: targetTicks (1-50), composeEvery (1-20), sceneCount (2-8)
- "焦点：" toggles—click character name to add to focusIds array
- Default focus: if focusIds empty, use first 2 characters (line 85)
- "▶ 启动" disabled if busy OR status.active OR !parsed (line 83)
- Pause/Resume buttons (line 98-99): disabled if not active/paused respectively
- **Interaction issue**: focusIds state local to BottomPanel component; if user closes panel and re-opens, selections are reset

**TickLog** (BottomPanel.tsx:105-123):
- Merged list of runtime + compose events, sorted newest-first, limited to 40 items
- Shows time (muted) + verb + summary per event
- Status indicated via CSS class (tick-log__row--{status})
- **Issue**: No click-to-detail; no way to see full event.refs or phase info

---

### 2.8 CodexRail (4-tab sidebar)
**File**: workbench/src/features/codex-rail/CodexRail.tsx

| Aspect | Implementation |
|--------|-----------------|
| **Trigger** | Right sidebar, visible unless railCollapsed (toggled by ⌘\\ or App.tsx:56-57) |
| **Feedback** | Active tab button highlighted. Tab content swaps instantly (no loading state between tabs) |
| **Empty state** | Each tab has its own: WorldEchoes "还没有回响", DecisionInbox "没有待裁决项", MemoryTab "没有命中", AtlasTab "未加载世界 · 图谱尚未编译" |
| **Error state** | MemoryTab: query error silently caught; shows "没有命中" (line 124). AtlasTab: fetch errors not handled |
| **Information hierarchy** | Now tab: echoes (newest 8, badges) + decisions (with count). World: characters + relationships. Memory: search results ranked by score. Atlas: file tree + detail |
| **Cross-feature coupling** | Now tab reuses WorldEchoes + DecisionInbox. All tabs read from stores; Memory/Atlas perform API calls |

**MemoryTab** (CodexRail.tsx:88-137):
- Query input + search button. OnKeyDown Enter also runs query
- Results show entry kind + total score + body
- **Issue**: No pagination; limit=20 hardcoded. No relevance slider or filter options

**AtlasTab** (CodexRail.tsx:139-180):
- Fetches tree on mount (line 147)
- Click file in tree → fetches body, displays in pre (line 176)
- **Issue**: Folder nodes are not clickable; tree doesn't collapse/expand

---

### 2.9 StatusBar (footer pill)
**File**: workbench/src/features/status-bar/StatusBar.tsx

| Aspect | Implementation |
|--------|-----------------|
| **Trigger** | Always visible at bottom footer |
| **Feedback** | Left: SSE dot (sse-dot--{state}) + heartbeat text (latest non-ambient event). Right: runtime pill (▶/⏸/✓ {completed}/{target}) |
| **Empty state** | SSE state="idle", heartbeat="静观 · 等待事件", pill="▢ 0/0" |
| **Error state** | SSE state="error"—dot shows error color. Heartbeat frozen. Daemon status may be stale |
| **Information hierarchy** | Left side shows current activity; right side shows daemon progress |
| **Cross-feature coupling** | Reads sseState + latestPulse from useEventStore, status from useDaemonStore. No click handlers |

**Heartbeat text** (StatusBar.tsx:9-11):
- Displays latest event (any subsystem, excluding ambient) verb + first 32 chars of summary
- Updates whenever useEventStore.latestPulse changes
- **Pain point**: No click-to-detail; can't expand truncated summary

**Runtime pill** (StatusBar.tsx:13-19):
- Shows same info as BottomPanel bar but in smaller space
- **Issue**: No click handler (line 28). Topbar ⚙ + ⌘K are clickable but pill is not

---

### 2.10 SlashMenu (inline "/" command palette)
**File**: workbench/src/features/slash-menu/SlashMenu.tsx

| Aspect | Implementation |
|--------|-----------------|
| **Trigger** | Detects "/" at line start or after space in textarea (line 77). Menu positioned at caret (line 149) |
| **Feedback** | Menu appears below textarea. Arrow keys navigate, Enter selects. Esc or click-outside closes |
| **Empty state** | Not applicable—four static commands |
| **Error state** | None—all commands are local (except one step() call) |
| **Information hierarchy** | Each command shows label + optional hint (line 164-165) |
| **Cross-feature coupling** | "让 daemon 推 1 步" calls useDaemonStore.step(). "打开命令面板" toggles CommandPalette. Others disabled (stubs) |

**Four slash commands** (SlashMenu.tsx:35-60):
1. "让 daemon 推 1 步" - enabled if daemon not active (line 40, hint shows constraint)
2. "打开命令面板 ⌘K" - always enabled
3. "搜记忆…" - disabled (stub)
4. "保存当前段为 fact 记忆" - disabled (stub)

**Interaction**:
- After selecting command, "/" is removed from textarea (line 108)
- Menu positioned via caretPosition() (line 173-176) which reads getBoundingClientRect()
- **Issue**: Only triggered in draft textarea (WritingCanvas.tsx:46), not in other inputs. Placeholder says "/弹 inline 菜单" but slash-only triggers

---

### 2.11 SixStageProgress (lamp track animation)
**File**: workbench/src/features/six-stage-progress/SixStageProgress.tsx

| Aspect | Implementation |
|--------|-----------------|
| **Trigger** | Always visible between WritingCanvas header and ChapterView/draft textarea |
| **Feedback** | Animated lamp progression with breathing/halo effects (新增，保持不动) |
| **Empty state** | Displays current stage from snapshot.stageNumber |
| **Error state** | None |
| **Information hierarchy** | Six lamps corresponding to stages; current stage highlighted |
| **Cross-feature coupling** | Reads snapshot.stageNumber from useSessionStore |

**Note**: This component was just added with lamp animations. Audit leaves it untouched per instructions.

---

## 3. Cross-Feature Couplings

### Zustand Store Dependencies

- **useUIStore**: UI-only state (no persistence). Controls activeMode, codexRailTab, railCollapsed, bottomPanelOpen, showCommandPalette, showSettings
- **useSessionStore**: World state (worldId, lineId, parsed, snapshot, draftText). Refreshed on mount + after world upload
- **useDaemonStore**: Daemon status + control (status, busy, start, pause, resume, step, ingestRuntimeEvent)
- **useEventStore**: Event stream + subscriptions (events[], bySubsystem, decisions, latestPulse, sseState)

### Critical Flows

1. **SSE Event → Daemon Status**: App.tsx useEffect (line 38-47) subscribes to newest event; if subsystem in [runtime, commit], calls ingestRuntimeEvent() → refresh status
2. **New Chapter Inscribed**: ChapterView detects inscribeEvent (phase="inscribe", status="succeeded") → refresh() → dropdown updates + auto-selects
3. **Decision Received**: useEventStore.ingest() prepends severity="decision-required" to decisions array; DecisionInbox reads + displays
4. **World Loaded**: WorldUploader calls refresh() → useSessionStore updates parsed + snapshot → App re-renders to show WritingCanvas

### Reactive Chains at Risk

- **ChapterView.refresh() circular dependency** (line 26): depends on selectedId, but refresh modifies list which may affect selectedId
- **focusIds state lost** (BottomPanel line 49): local state, reset on re-render. User loses selections if panel closes
- **MemoryTab query not auto-run** (CodexRail line 115-121): user types query but must press Enter. No debounce.

---

## 4. Pain Points (Interaction-layer)

### Critical Issues

1. **WorldUploader Success Has No Affordance** (WorldUploader.tsx:16-29)
   - After "已加载 · 4 角色 · 来源 示例世界" message, form is still visible with empty textarea
   - User doesn't know: "Should I close this? Proceed to daemon? Explore world first?"
   - Suggested: auto-collapse, show "Ready! Press ▶ Start daemon below or explore Codex Rail 世界 tab"

2. **Two Conflicting Daemon-Start Paths** (CommandPalette.tsx:42-49 vs BottomPanel.tsx:81-97)
   - ⌘K opens palette with "启动 daemon · 5 步 · composeEvery=3" (quick preset)
   - BottomPanel form allows full customization (targetTicks/composeEvery/focusIds/goal)
   - User learns both; unclear which to use. Discoverability hidden behind keybinding.
   - Suggested: primary path is BottomPanel form. CommandPalette is quick-start for power users. Add help text.

3. **DecisionInbox Has No Interaction Model** (DecisionInbox.tsx:1-22)
   - Events with severity="decision-required" appear as read-only list items
   - No button to "resolve", "dismiss", or "see details"
   - User sees item but can't act. Does clicking do anything? (No.)
   - Suggested: add "resolve" button per item, or explain in docs what "decision" means (e.g., daemon paused waiting for user directive)

4. **SlashMenu "/" Trigger Is Hidden** (WritingCanvas.tsx:50, SlashMenu.tsx:1-19)
   - Placeholder text says "输入 / 弹 inline 菜单" but slash doesn't work mid-word
   - Only triggers at line-start or after space (SlashMenu.tsx:77)
   - User types "/" in middle of sentence, menu doesn't appear—confusion
   - Suggested: improve placeholder: "行首输入 / 打开菜单（step / 搜记忆 / 保存段落）"

5. **Chapter Scroll Position Not Preserved** (ChapterView.tsx:38-47)
   - Switching chapters via dropdown fetches new content
   - If user scrolled through chapter 1, switches to chapter 2, then back to chapter 1 → scrolled to top
   - No scroll position restoration (no ref or window.scrollY save)
   - Suggested: use useCallback dependency on selectedId to memo scroll position in object

6. **SettingsModal Save Has No Validation Feedback** (SettingsModal.tsx:64-87)
   - No client-side validation of API key format (e.g., must start with "sk-")
   - No validation of baseUrl syntax
   - Error only shown if server rejects (after delay)
   - Suggested: validate apiKey.length > 0 and baseUrl matches /^https?:\/\// before submit

7. **MemoryTab Query UX Is Awkward** (CodexRail.tsx:88-137)
   - Input field doesn't auto-focus
   - No live-search (must click button or press Enter)
   - No debounce; rapid typing + Enter spams API
   - Limit=20 hardcoded; no pagination
   - Suggested: auto-focus on tab switch, debounce 300ms, show result count, add "Load more"

8. **Heartbeat Text Truncated Without Expand** (StatusBar.tsx:9-11)
   - Summary limited to first 32 chars; cut off mid-word
   - No click-to-see-full or tooltip
   - User misses important detail from event
   - Suggested: add title={fullSummary} to span, or click-to-expand inline

9. **AtlasTab Has No Folder Expand/Collapse** (CodexRail.tsx:139-180)
   - Folder nodes (kind="folder") are not clickable
   - Tree is flat list, all files at once
   - Suggested: add tree structure with toggleable folders

10. **focusIds Toggle State Lost on Panel Close** (BottomPanel.tsx:49, 71-78)
    - User selects 2 characters, then closes BottomPanel
    - Re-opens panel: focusIds is reset to [] (line 49 re-initializes on re-render)
    - User has to re-select
    - Suggested: persist focusIds to useUIStore or useSessionStore

### Minor Issues

11. **No Error Recovery for Failed Chapters** (ChapterView.tsx:44-46)
    - If api.chaptersGet(selectedId) throws, chapter stays null
    - No error message; retry button would help
    - Line 44 silently fails

12. **WorldEchoes Doesn't Auto-Scroll** (WorldEchoes.tsx:1-34)
    - New events prepend to list (useEventStore selector line 10-11 slices [0:8])
    - Screen doesn't scroll to show new event
    - User might miss realtime feedback if not looking at that tab

13. **No Loading State Between CodexRail Tabs** (CodexRail.tsx:35-40)
    - Switching from Now → Memory tab: no placeholder while query loads
    - Switching from Memory → Atlas: no placeholder while tree fetches
    - Suggested: render "로딩 중…" placeholder while data in flight

14. **CommandPalette Doesn't Close on Command Execution Edge Case** (CommandPalette.tsx:99-104)
    - If filtered.length === 0 and user presses Enter, nothing happens (no error shown)
    - Suggested: beep or show "No command selected"

15. **SSE Error Doesn't Prompt Manual Refresh** (StatusBar.tsx:24, useEventStore.ts:69)
    - If SSE enters error state, dot turns red
    - No button or message prompting user to reconnect
    - Daemon status may be stale
    - Suggested: show "SSE error · Reconnect" message with button

---

## 5. Strengths to Preserve

### Well-Designed Interactions

1. **Zustand Store Selectors Are Precise**
   - Each component subscribes to only the fields it needs (e.g., BottomPanel line 9-12)
   - Prevents unnecessary re-renders
   - Pattern should be kept for new features

2. **SSE Real-Time Status Updates Are Smooth**
   - Runtime events stream in, daemon status auto-updates (useDaemonStore line 78-82)
   - No polling; low latency
   - User sees live progress in BottomPanel pill

3. **Modal Overlay Pattern (Settings/CommandPalette)**
   - Click overlay to close (CommandPalette.tsx:121, SettingsModal.tsx:92)
   - Esc key closes (CommandPalette.tsx:91, SettingsModal impl missing but standard)
   - Consistent keyboard nav (Arrow + Enter)
   - Keep for consistency

4. **Chapter List Auto-Refresh on New Inscribe**
   - ChapterView detects inscribeEvent (line 13-15) and auto-refreshes (line 35)
   - No manual "refresh" click needed (though button exists as safety)
   - User sees new chapter immediately after daemon composes
   - Pattern excellent; apply to DecisionInbox if it gets interactions

5. **Daemon Status Lifecycle Clearly Visible**
   - Pill states: "▢ 0/0" → "▶ 1/5" (active) → "⏸ 3/5" (paused) → "✓ 5/5" (done)
   - Three buttons (Start/Pause/Resume) are contextually disabled
   - User always knows daemon state at a glance
   - Preserve this clarity

6. **Form Reset on Modal Open**
   - SettingsModal (line 41-62) fetches fresh data and clears status on open
   - CommandPalette (line 111-116) resets query and highlight on open
   - Prevents stale UI from previous session
   - Pattern works well; reuse

7. **Caret-Positioned SlashMenu**
   - Menu appears at user's cursor, not fixed position (SlashMenu.tsx:149)
   - Uses caretPosition() to calculate viewport-relative coords
   - Excellent UX for inline menus
   - Keep design

8. **WorldEchoes Severity Badges**
   - "·" (ambient), "★" (notable), "!" (decision) icons at a glance (WorldEchoes.tsx:3-7)
   - Color-coded via CSS (echo--{severity})
   - Quick visual scan of what's important
   - Extend to all event displays if redesign touches them

9. **TickLog Timestamp Format**
   - Events show time in Chinese locale, 24-hour format (BottomPanel.tsx:116)
   - Consistent with StatusBar (StatusBar.tsx doesn't show full time, just verb)
   - Readable without excess detail
   - Maintain format

10. **Global Keybindings Centralized**
    - App.tsx (line 49-63) handles ⌘K and ⌘\\ globally
    - Consistent key parsing (metaKey || ctrlKey)
    - Easy to add new shortcuts in one place
    - Pattern scales well

---

## 6. Technical Observations (Not Interaction, But Context for Redesign)

### Zustand Patterns
- No immer middleware; stores use simple object spread (e.g., useSessionStore line 27-39)
- Works fine for this scale; watch mutation bugs if stores grow

### SSE Subscription
- Single global subscription per EventStore (useEventStore.ts line 23)
- Closes old subscription before opening new (line 63)
- Handles both default /api/events and named subsystem events (sse.ts line 59-70)
- Heartbeat lines (server-side) don't fire onmessage; keep-alive is implicit

### API Error Handling
- All api.json() calls throw on non-2xx (lib/api.ts line 9-15)
- Callers catch; most show error.message in UI
- No retry logic; user must retry manually (button or re-open)
- Consider adding exponential backoff for transient failures

### Component Composition
- Features loosely coupled (import paths are explicit)
- No shared theme context; colors + fonts in CSS only
- Good for redesign—can refactor UI without touching store logic

---

## Summary

This audit identifies 10 critical interaction friction points and 5 minor issues across 11 major features. Key strengths (SSE real-time updates, Zustand selectors, modal UX, severity badges) should be preserved. Top priorities for redesign: (1) World upload success affordance, (2) daemon-start path consolidation, (3) DecisionInbox resolve flow, (4) SlashMenu trigger clarity, (5) memory search UX improvement.
