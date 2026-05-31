# Domain Core Code Review — 2026-05-10

Reviewer: Claude Opus 4.7 (1M context)
Scope: 10 domain-core files in `src/` totalling ~28k lines.
Goal: surface real correctness, concurrency, state-machine, and memory issues; ignore style.

---

## src/engine.ts (1132 lines)

```
SEVERITY: HIGH
src/engine.ts:1156-1184 (promoteBranch) + dynamic-character flow:858-913
WHY: addCharacter() injects a new CharacterState into this.currentSnapshot AT
THE TIME OF ADDITION, but pre-existing branches (created by earlier runStage
calls) hold their own cloned snapshots that never receive the new character.
If the user later promotes one of those older branches via promoteBranch(), the
canon line's snapshots, currentSnapshot, and parsed.characters end up
inconsistent: parsed.characters has the dynamic NPC; canon snapshots silently
drop them. Subsequent runStage iterations call snapshot.characters[id] which
returns undefined → bumpCharacter early-returns silently → progress / pressure /
notes are never recorded for that character on the new canon line.
FIX: On promoteBranch, scan parsed.characters and re-bootstrap any
CharacterState absent from the promoted branch's terminal snapshot using the
existing initial-snapshot-builder logic; or refuse to promote a branch whose
forking timestamp pre-dates a still-live dynamic addition.
```

```
SEVERITY: MEDIUM
src/engine.ts:797 (this.branches Map) + getTruthKernel:1201-1207
WHY: this.branches is a Map<string, TimelineLine> that only ever grows.
runStage adds 3 branches per call (deterministic) or N (proposal). promoteBranch
swaps the canon line but never deletes the now-stale branches from the map.
getTruthKernel iterates ALL branches every call and structuredClone-forks each
into a TruthKernel — quadratic memory + clone cost as branches accumulate. A
1000-tick simulation pays ~3000 deep clones per getTruthKernel().
FIX: After promoteBranch, evict branches whose sourceStageId is no longer
reachable from the new canon line's stages (or whose lineId is pre-promoted
ancestors); add a public pruneBranches(retainIds) method.
```

```
SEVERITY: MEDIUM
src/engine.ts:619 (passes = consistency >= 6 && risks.length === 0) ↔ canon-gate.ts:78
WHY: BranchEvaluation.passesConsistencyGate is true ONLY when risks.length === 0.
canon-gate.ts:78 then checks `branchEvaluation.risks.some(r => r.includes("死亡"))`
to decide whether to ask the author — but on the path where this code runs (gate
result is archive-only / ask-author), risks is guaranteed to be empty by the
upstream condition. So the death-risk arm of the gate is unreachable. Author
will never be prompted on lethal proposals; lethal proposals are silently rejected
with no opt-in path.
FIX: Either pass through risks unfiltered to the gate (and let the gate decide),
or move the death heuristic into evaluateConsistency as a softer-than-blocker
flag on BranchEvaluation that the gate inspects directly.
```

```
SEVERITY: MEDIUM
src/engine.ts:1156-1184 promoteBranch + currentSnapshot
WHY: When the promoted branch's stages array is empty (edge case if a branch
was registered but never had a stage attached — currently lineFromStage always
appends one, so this is defensive), `latestStage = undefined`, currentSnapshot
is left untouched and now diverges from canon. Branch reads via getLine(id) for
any subsequently-runStage'd branch derive from preStageCanon, which is a clone
of canonLine *before* promotion — i.e., the promoted branch is correctly the
canon. But the engine's `currentSnapshot` field is the seed for the NEXT
runStage's baseSnapshot. If currentSnapshot wasn't refreshed, the next stage
runs against a stale snapshot that doesn't reflect the promotion.
FIX: When latestStage is missing, fall back to canonLine.snapshots["initial"]
or throw — silent skip is unsafe.
```

```
SEVERITY: LOW
src/engine.ts:560-561 (boundary "不能突然并肩结盟" matches "结盟" status)
WHY: The check `relation.status.includes("结盟")` matches both "并肩结盟" (the
forbidden mutation) and "深度结盟" or "暂时结盟" or any future status containing
"结盟". The boundary string also includes the exact prohibited result, so the
substring match is effectively the right behaviour, but it is brittle: any
status string containing "结盟" — including a soft "结盟试探" — fails the
consistency check, even when allowed. The same brittleness shows in line 561's
"互信" / "盟友" disjunction.
FIX: Use a small set of canonicalised status atoms (UNION literals) instead of
substring includes, or document the substring contract loudly.
```

---

## src/director.ts (391 lines)

```
SEVERITY: MEDIUM
src/director.ts:140-156 + 219-221 (focusHistory bounded shift breaks lastAppearance)
WHY: focusHistory is shifted (line 219-221) when length exceeds recencyWindow*4,
but lastAppearance(charId, history) returns history.length when charId is
absent — meaning a character last seen 50 stages ago and a character never seen
both return the same value (12, the cap). selectFocus capping with Math.min(3,
lastSeen) masks the issue today, but if anyone removes the cap (or raises
recencyWindow), the rotation logic confuses "absent forever" with "absent for a
window". focusCounts grows without bound but is fine for cumulative use.
FIX: Track the absolute observedStages-index-of-last-focus in a separate
Map<characterId, number>, which survives shifts and is the right semantics.
```

```
SEVERITY: LOW
src/director.ts:300-307 (stagesIntoPhase ignores phase argument in open-ended mode)
WHY: When totalStages is null, the function unconditionally returns
this.state.observedStages regardless of which phase the caller asks about. As a
result tensionTargetFor("rising") in open-ended mode keeps incrementing the
target by 0.4 per observed stage even after the phase has advanced past rising
to climax/falling. The Math.min(7.5,…) cap saves us; but the heuristic isn't
doing what its name promises in open-ended runs.
FIX: Track a per-phase `phaseEnteredAtObservedStage` map; in open-ended mode
return observedStages - phaseEnteredAt[phase] (or 0 if phase not yet entered).
```

```
SEVERITY: LOW
src/director.ts:316-343 (selectFocus when characters.length === 0 returns [])
WHY: For empty characters, plan() returns focusCharacterIds=[] and toDirective
emits a directive with focusCharacterIds=[]. WorldHistoryEngine.runStage then
runs with an empty focus set — `chooseAction` for each character checks
`isFocus = focusCharacterIds.includes(...)` which is false; coreSummary picks
`focusNames[0] ?? cast[0] ?? "局中人"` which falls back to cast — fine.
But if the world has zero characters AND the director is wired in, the engine's
runStage still iterates parsed.characters (empty) producing zero-event stages.
That cascade is non-fatal but produces zero observability — Director.observe
sees stage.events.length === 0 → eventScore=0 → tensionEMA decays. Minor edge
case worth a guard.
FIX: Have Director.plan() throw or return a no-op plan with a clear "no
characters" rationale rather than silently emitting empty focus.
```

---

## src/character-agent.ts (518 lines)

```
SEVERITY: HIGH
src/character-agent.ts:286-291 (hydrate sets memoryIdCounter = memoryStream.length)
WHY: hydrate restores memoryStream then sets memoryIdCounter to its length. But
appendMemory (line 305-320) prunes oldest low-importance observations when the
stream exceeds memoryCap — the surviving stream length is much smaller than the
maximum id counter ever reached. After hydrate, nextId() returns
mem-{charId}-{length+1} which collides with surviving entries that have higher
numeric suffixes. AgentMemoryEntry.id is used by lastReflectionId, plan.basis
references, and downstream consumers — colliding ids silently corrupt memory
graph traversal and reflection lookup.
FIX: Persist memoryIdCounter as part of AgentSnapshot and restore it directly;
or scan memoryStream and set counter to max numeric suffix + 1.
```

```
SEVERITY: MEDIUM
src/character-agent.ts:108-112 (eventInvolves substring name match)
WHY: eventInvolves uses event.summary.includes(characterName) — for Chinese
names this fires false positives whenever one character's name is a substring
of another's (e.g., "李" vs "李雪"; "玄" vs "玄夜"). The shorter-named character
will absorb every observation written about the longer-named one, polluting
their memory stream and reflections. Determinism survives but agent reasoning
quality degrades silently.
FIX: Require that participants list be authoritative (use only id/name
membership in event.participants); do the prose-mention scan only over a
boundary-aware regex, e.g., disallow the match when the next char in summary
is part of any other known character's name.
```

```
SEVERITY: MEDIUM
src/character-agent.ts:305-320 (appendMemory cap silently breached)
WHY: The cap-respecting prune only removes 'observation' entries. If
memoryStream contains memoryCap reflections+plans plus k observations and a
new observation is appended, only k observations are eligible for pruning —
overflow is min(needToRemove, k). When k < needToRemove, the cap is breached
and stays breached forever (subsequent appends keep growing). Long runs with
high reflection cadence will leak memory unboundedly while purporting to be
capped.
FIX: When observation pool is exhausted, fall back to evicting the oldest
reflection or plan to honor the cap.
```

```
SEVERITY: LOW
src/character-agent.ts:506-516 (AgentRegistry.hydrate doesn't clear existing agents)
WHY: hydrate adds agents from the snapshot to this.agents but never clears
existing agents. Calling hydrate on an in-use registry leaves stale agents from
the previous run mixed with the snapshot's agents. Only impactful on test
patterns or hot-swap-style restoration but easy to misuse.
FIX: this.agents.clear() before iterating snap.agents.
```

---

## src/character-synthesizer.ts (318 lines)

```
SEVERITY: LOW
src/character-synthesizer.ts:181-194 (overlapping bit-shift seeds)
WHY: Faction (seed >>> 16) and role (seed >>> 20) share the upper 12 bits;
likewise stance (>>> 26) and resource (>>> 28) share upper 4 bits. The picks
are therefore correlated — a name that maps to faction[3] is much more likely
to also map to role[3]. The character pool of distinguishable NPCs is
significantly smaller than (factions × roles × stances × resources) suggests.
For determinism this is intentional; for variety it understates the seed.
FIX: Use sequential consume-and-rehash (e.g., LCG step between picks) so each
pick uses 32 fresh bits, instead of overlapping windows of the same hash.
```

```
SEVERITY: LOW
src/character-synthesizer.ts:285-300 (extractCandidateNames over-generates)
WHY: extractCandidateNames does a sliding window of every (minLen..maxLen)-
length substring of every CJK run. For a run of length 8 with min=2 max=4 this
produces (8-2+1)+(8-3+1)+(8-4+1) = 18 candidates, most of which are partial
prefixes/infixes that don't correspond to actual character names. Downstream
callers must filter — if any caller blindly synthesizeCharacter()'s the
extracted candidates, they create N junk characters per text block.
FIX: Either constrain to known name shapes (likely 2-3 char names) or document
explicitly that the output is a candidate-set requiring downstream NER.
```

---

## src/graph-runtime-daemon.ts (565 lines)

```
SEVERITY: HIGH
src/graph-runtime-daemon.ts:80-83 (runIds reducer is append) + start():382-418
WHY: The runIds annotation reducer is `(a, b) => [...a, ...b]` (append). The
SqliteSaver persists state per-thread. When a daemon completes a run on
thread "default" and the user calls start() again with a new request, the
graph re-invokes on the same thread. The new initial input has runIds: [], and
since the input passes through the reducer, the EXISTING runIds from the prior
completed run remain in state. Each new tick's runId append produces a list
that is OLD_RUN_IDS + NEW_RUN_IDS. status() then reports a runIds list that
includes ids from a prior, unrelated run. The Director / agent registry are
fine because they aren't in the graph state, but external consumers reading
runIds for "this run's run ids" get stale data.
FIX: Either explicitly reset runIds in start() by calling
compiled.updateState(cfg, { runIds: persistedThenZeroedHack }) before invoke,
or change the reducer to `(_a, b) => b` and have the run_tick node return
[...prev, newId] (requires reading prior runIds inside the node).
```

```
SEVERITY: HIGH
src/graph-runtime-daemon.ts:317-326 + resume():437-478 ("ask-author" pause not actually resumable)
WHY: When kernel.tick returns status="paused" because canon-gate hit
ask-author, the run_tick node sets paused=true with a CanonGate-paused reason.
The graph then routes to finalize → END. resume() detects paused, clears the
flag, re-invokes from START — but this RE-RUNS prepare_tick → run_tick on the
NEXT tick (completedTicks isn't decremented). The previously-paused tick is
abandoned: the canon line was already mutated by engine.runStage* (canon stage
unconditionally pushed at engine.ts:968-971), but the BRANCH that triggered
ask-author is never accepted/rejected/promoted. Subsequent tick runs against a
canon that includes the deterministic-canon stage but ignored the proposed
high-risk branch entirely. Author has no way to actually accept it.
FIX: Surface gate-paused state with the candidate branchId; add an
acceptBranch / rejectBranch RPC on the daemon that calls
engine.promoteBranch(branchId) when accept, then clears pause and continues.
This is the real semantics the gate's ask-author result requires.
```

```
SEVERITY: MEDIUM
src/graph-runtime-daemon.ts:283-316 (in-graph mutation of director / agent registry)
WHY: The run_tick node calls director.observe(...) and
agentRegistry.observeStage(...) and reflectAll(...). These mutate JS objects on
the daemon instance — they are NOT in graph state and NOT persisted to the
SqliteSaver checkpoint. After a true process kill, resumeFromCheckpoint
correctly restores graph state but director/agent state is lost (an in-memory
instance is empty). The comment at lines 195-201 acknowledges this for the
director, but resumeFromCheckpoint then runs the next run_tick which calls
director.observe() against a fresh-state director — its tensionEMA, phase, and
focusHistory are wrong.
FIX: Either (a) include director/agent state in the graph annotation root and
update it through reducers, or (b) have resumeFromCheckpoint accept a hydration
callback that re-derives director/agent state from the engine's canon line
history before invoking.
```

```
SEVERITY: MEDIUM
src/graph-runtime-daemon.ts:551 (recursionLimit derived from cachedSnapshot.targetTicks)
WHY: invokeSafely reads recursionLimit from this.cachedSnapshot.targetTicks. On
resume() / resumeFromCheckpoint(), cachedSnapshot is updated *before* the call
(line 475, 539), so this generally works. But if a caller invokes
loadFromCheckpoint() (which sets cachedSnapshot to persisted) and then calls
start() with a NEW targetTicks, start() sets cachedSnapshot to the new initial
including new targetTicks (line 414-418) before invokeSafely — fine.
However, the formula `targetTicks * 8 + 50` underestimates when reflection
cadence triggers extra async work. Each tick traverses prepare_tick, run_tick,
the conditional edge function, plus delay (or set_pause) — that's 4 nodes per
tick (3 if pause-bound). 8 is conservative for 4-node loops; the cap should
hold. But if anyone adds more nodes (W3 plans for reflect/plan subgraphs as the
top of file states), this number quietly invalidates and graphs fail with
GraphRecursionError mid-run.
FIX: Compute recursionLimit from the actual node count, or simply bump to a
generous static value (e.g., targetTicks * 32 + 100).
```

```
SEVERITY: LOW
src/graph-runtime-daemon.ts:300-313 (reflect-cadence runs every reflectEveryNTicks)
WHY: The cadence check `(s.completedTicks + 1) % cadence === 0` is computed on
the about-to-be-completed tick number. If reflectEveryNTicks=3 and
completedTicks=2 going in, condition is true (3 % 3 === 0). After the await,
completedTicks becomes 3 (returned in the next state update). But the await
runs reflectAll for ALL agents — if reflectFn is LLM-backed, this is a long
async call that holds the run_tick node. A pause request during this await
won't be observed until the await resolves (pauseRequested is JS-only, not in
graph state). Acceptable but worth documenting; reflectAll has no abort path.
FIX: Pass an AbortSignal through to reflectFn; check pauseRequested before
calling reflectAll and skip-and-defer if true.
```

---

## src/persistent-runtime-daemon.ts (195 lines)

```
SEVERITY: MEDIUM
src/persistent-runtime-daemon.ts:86-107 (resume re-uses lastRequest with mutated directive)
WHY: start() stores
  this.lastRequest.directive = directiveForTick(request.directive, 1, 1)
which strips any tick suffix (because targetTicks=1 in that call). resume()
then re-enters runLoop with this lastRequest and applies directiveForTick
again at every iteration. That's idempotent and correct — but lastRequest's
directive is no longer reference-equal to the original request's directive,
so any external observer that retained the original directive object sees
divergence. Also: if resume() is called when lastRequest is undefined (no
prior start), the function early-returns at line 87 — silent NO-OP, which
hides programmer errors. Acceptable, but `start` after a `failed` state never
clears `lastRequest` so a subsequent `resume` with no fresh `start` will run
the FAILED request's directive, potentially re-failing.
FIX: Clear lastRequest on terminal states (failed/completed) and have resume()
return failed snapshot if lastRequest is missing.
```

```
SEVERITY: LOW
src/persistent-runtime-daemon.ts:74-83 (pause flips snapshot.paused but leaves active=true until tick boundary)
WHY: pause() sets snapshotValue.paused=true while keeping active=true (the
runLoop only flips active=false at the next tick boundary when it observes
pauseRequested). status() then reports both active=true AND paused=true for a
brief window — semantically inconsistent for any caller using
`active && !paused` as "actually running" check. Same hazard if status is
polled mid-tick.
FIX: Either (a) accept and document this transient state, or (b) flip
active=false in pause() immediately and let the loop verify pauseRequested.
```

---

## src/canon-gate.ts (120 lines)

```
SEVERITY: MEDIUM
src/canon-gate.ts:45-69 + 110-119 (rejected high-risk death branches never reach ask-author)
WHY: See engine.ts:619 cross-reference (above). The gate's ask-author warning
on line 78 (`risks.some(r => r.includes("死亡"))`) is unreachable because
passesConsistencyGate is gated on risks.length===0. As a result, the gate
returns "reject" + riskLevel="fatal" for any branch whose risks include a
death — the requireAuthorOnHighRisk knob has no effect on this case. Authors
relying on the knob to be prompted on lethal stakes are silently blocked.
FIX: Pass branchEvaluation.risks through unchanged and let the gate distinguish
"hard blocker" from "ask-author warning" categories at this layer instead of
upstream collapsing both into risks[].
```

```
SEVERITY: LOW
src/canon-gate.ts:84 (CanonGateDecision.result type union has unreachable "accept-canon")
WHY: runtime-types.ts:84 declares result: "accept-canon" | "archive-only" |
"reject" | "ask-author". canon-gate.ts only ever produces "reject" |
"ask-author" | "archive-only". Nothing in this codebase emits "accept-canon".
WorldDaemon.tick searches gateDecisions for "ask-author" and "archive-only" but
never "accept-canon", and there's no path that auto-promotes a branch.
Implication: the type implies an auto-canon-acceptance feature that doesn't
exist, and consumers writing exhaustive switches will produce dead branches.
FIX: Either remove "accept-canon" from the union or implement an auto-promote
gate path for branches that are also recommended.
```

---

## src/world-daemon.ts (71 lines)

```
SEVERITY: HIGH
src/world-daemon.ts:53-60 (resume marks paused → completed without selecting a branch)
WHY: When a tick returns paused (because gate said ask-author), the SimulationRun
is marked "paused" with the candidate decision attached. resume(runId) is the
ONLY user-facing path to clear that pause. It does:
  if run.status !== "paused" return …
  await markRun(run, "completed")
That is, it simply flips the status to completed without invoking
engine.promoteBranch, without writing the author's choice anywhere, without
emitting a new RunRecord. The canon line is unchanged from BEFORE the pause;
the proposed branch is left orphaned in engine.branches forever; the gate
question is answered by silently doing nothing. Author input has zero effect on
canon integrity.
FIX: resume() must take an author choice (accept | archive | reject |
revise-directive) and route to engine.promoteBranch(branchId) on accept;
update the run record and run-store accordingly.
```

```
SEVERITY: LOW
src/world-daemon.ts:35-44 (high-risk pause requires both decision present AND config flag)
WHY: highRiskDecision is found via `gateDecisions?.find(d => d.result ===
"ask-author")`. ask-author is ONLY emitted by canon-gate.ts when
requireAuthorOnHighRisk is true AND the qimen condition is met. So the second
check `&& this.input.config.autonomy.requireAuthorOnCanonRisk` is redundant in
practice, since the upstream gate wouldn't have produced ask-author without
requireAuthorOnHighRisk being passed (and the daemon does pass it through —
see how SimulationJob does at orchestration.ts:416). The redundancy is benign
but means the code path documenting "the daemon can override the gate"
doesn't actually exist; if anyone changes the config wiring, the failure mode
is silent canon contamination.
FIX: Simplify to `if (highRiskDecision) { … }` and let the gate be the single
source of truth.
```

---

## src/orchestration.ts (459 lines)

```
SEVERITY: MEDIUM
src/orchestration.ts:259-260, 269-272 (state.plan! non-null assertion can crash)
WHY: In the synthesize and critique cases of executeStage, the second arg to
expandScenes uses
  this.state.sceneCards ?? (await this.input.provider.expandScenes(context, this.state.plan!))
The `state.plan!` is a non-null assertion. The default expression on the
preceding line is `state.plan ?? (await provider.planChapter(context))` — but
this only RETURNS the resolved plan; it does not assign back to state.plan.
So when state.plan is undefined and state.sceneCards is also undefined, the
expandScenes call dereferences `state.plan!` which is still undefined → a
crash with TS-suppressed null. Normal flow (runUntil walking STAGE_ORDER) sets
state.plan in the blueprint stage so this only fires if a caller resumes from
a checkpoint that has sceneCards but lost state.plan, or explicitly executes
synthesize without prior stages — possible in test paths.
FIX: Capture the awaited plan into a local: `const plan = state.plan ??
(state.plan = await provider.planChapter(context));` — or restructure to
always populate state.plan before reading it again.
```

```
SEVERITY: MEDIUM
src/orchestration.ts:393-429 (SimulationJob.run marks run completed before WorldDaemon overrides to paused)
WHY: SimulationJob.run does
  await runStore.completeLatestStep(...)
  currentRun = await runStore.markRun(currentRun, "completed")
unconditionally — even when the gate decision is ask-author. Then the
SimulationJob returns; WorldDaemon.tick reads the result and checks for
ask-author; if found, calls runStore.loadRun(runId) → markRun(run, "paused").
There's a brief window where the run-store is in "completed" while the daemon
is about to flip to "paused". Any external poller (memory store, monitoring,
another worker) that reads the run-store between those two writes sees
"completed" and may make decisions accordingly. Cross-process consumers without
locking will race. Single-process is fine because of the worker queue.
FIX: Have SimulationJob propagate the gate decision into its own
mark logic: only call markRun(completed) when no ask-author result exists;
otherwise leave the run in "running" until the daemon decides.
```

```
SEVERITY: LOW
src/orchestration.ts:288-306 (memory-write only writes when review.passed)
WHY: When the critic fails, sceneDrafts are NEVER written to the expression
memory store. That is by design but the run record still says "已写入表达记忆"
(line 307) — misleading. A failed-review chapter has zero memory residue, so a
subsequent re-run of WritingJob has no record that the critic rejected this
content; it could regenerate something nearly identical without anti-feedback.
FIX: Differentiate the run-record summary based on whether memory was actually
written ("已写入" vs "复核未通过，已跳过表达记忆"); or write a "rejected" memory
entry so the next pass has signal.
```

---

## src/novel-runtime-kernel.ts (146 lines)

no findings

The kernel is a thin orchestrator: it builds a context pack, syncs the session,
delegates to WorldDaemon, attaches artifacts. All the failure modes (LLM
errors, gate-paused) propagate from WorldDaemon and are captured upstream. The
worker queue around tick/resume serialises both — no race. The only behavioral
quirk is `attachRuntimeArtifacts` does not check whether the run still exists
(it could have been deleted), but that's a runtime concern not a code bug.

---

## Summary

Confidence: **medium**. The Park-style memory + Director arc-pacing layers are
new code with ID-counter and substring-name-match bugs that will silently
corrupt agent state on resume. The graph-runtime-daemon ↔ canon-gate ↔
world-daemon contract has a major correctness gap: when canon-gate emits
"ask-author" the run is paused but no machinery exists to actually accept,
reject, or promote the proposed branch — author input has zero effect, and the
author-prompted death-warning code path is unreachable because consistency
risks make the branch fail upstream. Engine.ts has a real dynamic-character
correctness bug around promoteBranch, plus an unbounded branches Map that
serves as a slow leak. There are 4 HIGH issues — none of which are simulator-
deterministic-equality breaking on a single non-resumed run, but ALL of which
break the resume / author-decision contract that the system claims to support.
