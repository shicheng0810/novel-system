// core/runtime/world-actor.ts — 单写者 WorldActor。一个 step(异步, 因含 LLM)= 一轮:
//   plan(focus) → drainInputs → frame → agents(reflect+plan via LLM) → branches → gate → commit → director → saveStep(单事务)
// 铁律: 只有这里写 world 表; events + 快照 + checkpoint + scheduler 全在 saveStep 同一事务 → 无半提交。
import type { DB } from "../services/db";
import type { ContentPack, ScoredCandidate } from "../domain/pack";
import type { WorldSnapshot, CandidateAction, CharacterState } from "../domain/world";
import type { DomainEvent, WorldEventRecord, StateDelta } from "../domain/events";
import type { LLMProvider } from "../services/llm";
import { EVENT_SUBSYSTEM } from "../domain/events";
import { reflectAndPlan } from "../actors/character-actor";
import { composeChapter, type ComposedChapter } from "../actors/compose-actor";
import { initialDirectorState, planDirector, type DirectorState } from "../actors/director-actor";
import { rngFor } from "../util/rng";
import * as store from "../services/store";

function eventId(subsystem: string, runId: string, kind: string, i: number): string {
  return `${subsystem}:${runId}:${kind}:${i}`;
}

function uniformScore(c: CandidateAction): ScoredCandidate {
  return {
    candidate: c,
    weight: 0.5,
    breakdown: { base: 0.5, influence: 0, opposing: 0, bias: 0, total: 0.5 },
    contributingInfluences: [],
    explain: "uniform(无 prior)",
  };
}

function applyDeltas(snapshot: WorldSnapshot, deltas: StateDelta[]): void {
  for (const d of deltas) {
    if (!d.characterId) continue;
    const ch = snapshot.characters[d.characterId];
    if (!ch || !d.set) continue;
    for (const [k, v] of Object.entries(d.set)) {
      if (k === "narrativeStress" && typeof v === "number") ch.narrativeStress = v;
      else if (k === "locationId" && typeof v === "string") ch.locationId = v;
      else if (k === "progressionTier" && typeof v === "string") ch.progressionTier = v;
      else ch.props[k] = v;
    }
  }
}

// 事件主体(从强类型 payload 取名字/详情, 喂前端事件流; 纯字段读取, 无 genre 字面量)
function evSubject(ev: DomainEvent): string | undefined {
  switch (ev.kind) {
    case "CharacterEntered":
      return `${ev.name}（${ev.faction}）`;
    case "CharacterFell":
      return `${ev.name} — ${ev.cause}`;
    case "FactionDissolved":
      return `${ev.faction}一脉为${ev.into}所并`;
    case "VengeanceResolved":
      return `${ev.characterId} 为${ev.avenged}·${ev.outcome}`;
    case "CharacterTranscended":
      return `${ev.name} 登顶${ev.toTier}、功成身退`;
    case "StoryEventTriggered":
      return ev.name;
    case "ProgressionAdvanced":
      return `${ev.characterId} ${ev.fromTier}→${ev.toTier}`;
    case "DecisionRequired":
    case "StageCommitted":
      return ev.summary;
    case "AuthorRuled":
      return `${ev.decisionId} ${ev.verdict}`;
    default:
      return undefined;
  }
}

interface PendingDecision {
  decisionId: string;
  candidateId: string;
  charId: string;
  deltas: StateDelta[];
  summary: string;
  hint?: string; // 奇门给作者的吉凶建议
  omen?: string; // 吉/平/凶 → 无人值守时据此自动裁决
}

export interface StepResult {
  ran: boolean;
  tick: number;
  eventCount: number;
  chosenId: string | null;
}

export async function step(db: DB, worldId: string, pack: ContentPack, llm: LLMProvider): Promise<StepResult> {
  const sched = store.getSchedulerState(db, worldId);
  const tick = sched.nextTick;
  const gen = sched.gen;

  const loaded = store.loadSnapshot(db, worldId);
  if (!loaded) throw new Error(`no world snapshot for ${worldId}; seed first`);
  const snapshot = JSON.parse(JSON.stringify(loaded.snapshot)) as WorldSnapshot;
  const pending: PendingDecision[] = Array.isArray(snapshot.props["pendingDecisions"])
    ? (snapshot.props["pendingDecisions"] as PendingDecision[])
    : [];

  const cp = store.loadLatestCheckpoint(db, worldId);
  const directorState: DirectorState = (cp?.actorStates["director"] as DirectorState | undefined) ?? initialDirectorState();
  // 先定导演计划(focus 决定本 tick 谁登场, 轮转); 事件稍后在 director 相位 emit
  const { plan, next: nextDirector } = planDirector(directorState, snapshot);

  const runId = `${worldId}-t${tick}`;
  const evs: DomainEvent[] = [];
  evs.push({ kind: "RunStarted", runId, tick });

  // drainInputs: 处理作者裁决(M3)——人/agent 同一种 input。accept → 真正改正史(头号 REDO)。
  for (const inp of store.drainPendingInputs(db, worldId)) {
    if (inp.type === "author-verdict") {
      const decisionId = String(inp.payload["decisionId"] ?? "");
      const verdict = inp.payload["verdict"] === "accept" ? "accept" : "reject";
      const idx = pending.findIndex((p) => p.decisionId === decisionId);
      if (idx >= 0) {
        const p = pending[idx]!;
        evs.push({ kind: "AuthorRuled", decisionId, verdict });
        if (verdict === "accept") {
          applyDeltas(snapshot, p.deltas);
          evs.push({ kind: "BranchPromoted", branchId: p.candidateId, intoLineId: snapshot.lineId });
          // M4: 突破成功 → 进阶状态机推进(单调; 仅经作者裁决 + pack 允许 → 防 power-creep)
          const ch = snapshot.characters[p.charId];
          if (ch) {
            const tiers = pack.progression.tiers;
            const curIdx = tiers.findIndex((t) => t.id === ch.progressionTier);
            if (curIdx >= 0 && curIdx < tiers.length - 1) {
              const next = tiers[curIdx + 1]!;
              evs.push({ kind: "ProgressionAdvanced", characterId: ch.id, fromTier: ch.progressionTier ?? "", toTier: next.id });
              ch.progressionTier = next.id;
              ch.props["actCount"] = 0; // 重置, 为下一阶累积
              ch.props["resource"] = 0; // 进阶耗尽积蓄的资源, 须重新累积(门槛随阶位递增)
              ch.narrativeStress = Math.max(0, ch.narrativeStress - 0.3); // 突破后心境舒缓
              // 世代更替: 登顶最高阶 → 功成身退/飞升(退出活跃舞台, 为新生代腾位; 主角亦然)
              if (curIdx + 1 === tiers.length - 1) {
                ch.present = false;
                evs.push({ kind: "CharacterTranscended", characterId: ch.id, name: ch.name, toTier: next.id });
              }
            }
          }
        } else {
          evs.push({ kind: "BranchArchived", branchId: p.candidateId, reason: "author-reject" });
        }
        pending.splice(idx, 1);
      }
    } else if (inp.type === "spawn-character") {
      const ch = inp.payload["character"] as CharacterState | undefined;
      if (ch && ch.id && !snapshot.characters[ch.id]) {
        snapshot.characters[ch.id] = ch;
        evs.push({ kind: "CharacterEntered", characterId: ch.id, name: ch.name, faction: String(ch.props["faction"] ?? "") });
      }
    }
    store.markInputProcessed(db, inp.id, Date.now());
  }

  // frame(deterministic prior; 可空 = 纯涌现包)
  const frame = pack.priorSystem?.buildFrame({ snapshot, tick });
  if (frame) evs.push({ kind: "FrameDerived", frameId: frame.frameId, packId: frame.packId, frameHash: frame.frameHash });

  // agents: 本 tick 登场者(focus 轮转)reflect+plan(LLM); 其余角色本 tick 不动(lazy)
  const worldSeed = typeof snapshot.props["seed"] === "string" ? (snapshot.props["seed"] as string) : "";
  const acting = Object.values(snapshot.characters).filter((c) => c.present && plan.focus.includes(c.id));
  const candidates: CandidateAction[] = [];
  for (const ch of acting) {
    const turn = await reflectAndPlan(ch, snapshot, pack, llm, rngFor(worldId, worldSeed, "agent", tick, ch.id));
    candidates.push(...turn.candidates);
    evs.push({ kind: "AgentThought", characterId: ch.id, candidateIds: turn.candidates.map((c) => c.id) });
    evs.push({ kind: "MemoryRecorded", entryId: `mem-${ch.id}-t${tick}`, characterId: ch.id, memoryKind: "reflection", body: turn.reflection, importance: 0.3 });
  }

  // branches: 打分 → argmax(确定性, id 平手)
  const scored: ScoredCandidate[] = candidates.map((c) =>
    frame && pack.priorSystem ? pack.priorSystem.scoreCandidate(c, frame) : uniformScore(c)
  );
  scored.sort((a, b) => b.weight - a.weight || a.candidate.id.localeCompare(b.candidate.id));
  const chosen: ScoredCandidate | null = scored.length > 0 ? scored[0]! : null;
  evs.push({
    kind: "CandidatesScored",
    scored: scored.map((s) => ({ candidateId: s.candidate.id, weight: s.weight })),
    chosenId: chosen ? chosen.candidate.id : null,
  });

  // gate(M3): 高风险分支(act 且该角色 actCount>=3 = 突破尝试)→ 请作者裁决, 暂不入正史, 落安全替代; 世界不停。
  let committed = chosen;
  let gateVerdict: "pass" | "ask-author" = "pass";
  if (chosen) {
    const actingChar = snapshot.characters[chosen.candidate.characterId];
    const canBreak = actingChar ? pack.progression.canAdvance(actingChar, snapshot).ok : false;
    const risky = (chosen.candidate.kind === "act" || chosen.candidate.kind === "engage") && canBreak; // 突破尝试(独修/历练)→ 请作者裁决(进阶只经裁决)
    const alreadyPending = pending.some((p) => p.charId === chosen.candidate.characterId);
    if (risky && !alreadyPending) {
      gateVerdict = "ask-author";
      const decisionId = `dec-${runId}`;
      const deltas = (chosen.candidate.payload["deltas"] as StateDelta[] | undefined) ?? [];
      const div = pack.divine?.(tick); // 奇门为这桩突破起局, 给作者吉凶建议
      pending.push({ decisionId, candidateId: chosen.candidate.id, charId: chosen.candidate.characterId, deltas, summary: chosen.candidate.summary, hint: div?.hint, omen: div?.omen });
      evs.push({ kind: "DecisionRequired", decisionId, branchId: chosen.candidate.id, options: ["accept", "reject"], summary: chosen.candidate.summary, hint: div?.hint ?? "" });
      committed = scored.find((s) => s.candidate.characterId === chosen.candidate.characterId && s.candidate.kind === "observe") ?? null;
    }
  }
  evs.push({ kind: "GateEvaluated", chosenId: committed ? committed.candidate.id : null, verdict: gateVerdict, violations: gateVerdict === "ask-author" ? ["high-stakes"] : [] });

  // commit
  if (committed) {
    const deltas = (committed.candidate.payload["deltas"] as StateDelta[] | undefined) ?? [];
    applyDeltas(snapshot, deltas);
    evs.push({ kind: "StageCommitted", stageNumber: tick, chosenCandidateId: committed.candidate.id, deltas, summary: committed.candidate.summary });
    // 认知②: 落定的行动 → 显著情景记忆 + 历练累积(喂叙事召回与决策, 非每 tick 反思的流水账)
    const ckind = committed.candidate.kind;
    const imp = ckind === "engage" ? 0.6 : ckind === "act" ? 0.4 : 0.2;
    if (imp >= 0.4) {
      const actor = snapshot.characters[committed.candidate.characterId];
      if (actor) {
        evs.push({ kind: "MemoryRecorded", entryId: `mem-${actor.id}-t${tick}-act`, characterId: actor.id, memoryKind: ckind === "engage" ? "episode" : "deed", body: committed.candidate.summary, importance: imp });
        if (imp >= 0.6) actor.props["历练"] = (typeof actor.props["历练"] === "number" ? (actor.props["历练"] as number) : 0) + 1;
      }
    }
  }
  snapshot.tick = tick + 1;
  snapshot.clock.tick = tick + 1; // 推进故事时钟(评估: 之前冻结在 0)
  snapshot.props["pendingDecisions"] = pending;

  // 经济 + 离场也有戏: 在场者累积资源; 非焦点者另有微动(心境回落 + 偶尔迁徙, 无 LLM, 确定性) → 世界处处有人活动
  const locKeys = Object.keys(snapshot.locations);
  for (const c of Object.values(snapshot.characters)) {
    if (!c.present) continue;
    const loc = snapshot.locations[c.locationId ?? ""];
    const y = loc && typeof loc.props["yield"] === "number" ? (loc.props["yield"] as number) : 0.3;
    c.props["resource"] = (typeof c.props["resource"] === "number" ? (c.props["resource"] as number) : 0) + y;
    if (plan.focus.includes(c.id)) continue; // 焦点者已由 agent 循环主理
    const sig = c.id.charCodeAt(c.id.length - 1);
    c.narrativeStress = c.narrativeStress > 0.3 ? Math.max(0.3, c.narrativeStress - 0.03) : Math.min(0.3, c.narrativeStress + 0.015); // 久不登场→心境渐归平静
    if ((tick + sig) % 6 === 0 && locKeys.length > 1) {
      const dest = locKeys[(sig + Math.floor(tick / 6)) % locKeys.length]!; // 确定性游走, 错开 → 散布全图
      if (dest !== c.locationId) c.locationId = dest;
    }
  }

  // 系统级剧情事件(势力战争/秘境副本/魔道入侵…): 涉事角色聚集 + 抬张力 + 设世界危机
  const story = pack.nextStoryEvent?.(snapshot, tick) ?? null;
  if (story) {
    const present2 = Object.values(snapshot.characters).filter((c) => c.present);
    const targets =
      !story.involve || story.involve === "all"
        ? present2
        : present2.filter((c) => (story.involve as string[]).includes(c.id) || (story.involve as string[]).includes(String(c.props["faction"] ?? "")));
    for (const c of targets) {
      if (story.gatherAt && snapshot.locations[story.gatherAt]) c.locationId = story.gatherAt;
      if (story.stressDelta) c.narrativeStress = Math.max(0, Math.min(1, c.narrativeStress + story.stressDelta));
    }
    if (story.crisis !== undefined) snapshot.props["crisis"] = story.crisis;
    if (story.factionShifts) {
      const fr = (snapshot.props["factionRelations"] as Record<string, Record<string, number>> | undefined) ?? {};
      for (const sh of story.factionShifts) {
        const A = (fr[sh.a] = fr[sh.a] ?? {});
        const B = (fr[sh.b] = fr[sh.b] ?? {});
        A[sh.b] = (A[sh.b] ?? 0) + sh.delta;
        B[sh.a] = (B[sh.a] ?? 0) + sh.delta;
      }
      // 派系覆灭/吞并: 关系彻底崩坏(≤-6)的一对, 在场人少者被强者吞并; 主角所在派系免疫(版图随之真变动)
      const protectedFac = new Set(
        Object.values(snapshot.characters)
          .filter((c) => c.present && c.id.startsWith("c") && typeof c.props["faction"] === "string")
          .map((c) => c.props["faction"] as string),
      );
      const membersOf = (f: string): CharacterState[] => Object.values(snapshot.characters).filter((c) => c.present && c.props["faction"] === f);
      for (const sh of story.factionShifts) {
        if ((fr[sh.a]?.[sh.b] ?? 0) > -6) continue;
        const loser = membersOf(sh.a).length <= membersOf(sh.b).length ? sh.a : sh.b;
        const winner = loser === sh.a ? sh.b : sh.a;
        if (protectedFac.has(loser) || membersOf(loser).length === 0) continue;
        for (const c of membersOf(loser)) c.props["faction"] = winner; // 残部归并强者
        delete fr[loser];
        for (const k of Object.keys(fr)) {
          const row = fr[k];
          if (row) delete row[loser];
        }
        snapshot.props["crisis"] = `${String(snapshot.props["crisis"] ?? "")}　${loser}一脉覆灭，残部为${winner}所并`;
        evs.push({ kind: "FactionDissolved", faction: loser, into: winner });
      }
      snapshot.props["factionRelations"] = fr;
    }
    // 奇门吉凶决定大事结果: 吉→机缘进展(阅历+1, 张力舒缓); 凶→危殆折损(张力顶满, 首二人反目, 首人道途受挫)
    const numProp = (c: CharacterState, k: string): number => (typeof c.props[k] === "number" ? (c.props[k] as number) : 0);
    // 复仇了断: 大事临头, 怀仇者借奇门吉凶了结恩怨(吉→雪恨, 凶→配角同归/主角受挫, 平→释怀); 了结即清仇念, 不无限挂着
    for (const c of present2) {
      const av = typeof c.props["avenge"] === "string" ? (c.props["avenge"] as string) : "";
      if (!av) continue;
      let outcome: string;
      if (story.omen === "吉") {
        outcome = "雪恨功成";
        c.narrativeStress = Math.max(0, c.narrativeStress - 0.3);
        c.props["actCount"] = numProp(c, "actCount") + 1;
      } else if (story.omen === "凶") {
        if (c.id.startsWith("s")) {
          outcome = "同归于尽";
          c.present = false;
        } else {
          outcome = "复仇受挫";
          c.narrativeStress = 1;
        }
      } else {
        outcome = "恩怨释怀";
        c.narrativeStress = Math.max(0, c.narrativeStress - 0.15);
      }
      delete c.props["avenge"];
      evs.push({ kind: "VengeanceResolved", characterId: c.id, avenged: av, outcome });
    }
    if (story.omen === "吉") {
      for (const c of targets) {
        c.props["actCount"] = numProp(c, "actCount") + 1;
        c.narrativeStress = Math.max(0, c.narrativeStress - 0.1);
      }
    } else if (story.omen === "凶") {
      for (const c of targets) c.narrativeStress = 1;
      const a = targets[0];
      const b = targets[1];
      if (a && b) {
        a.props[`bond:${b.id}`] = numProp(a, `bond:${b.id}`) - 2;
        b.props[`bond:${a.id}`] = numProp(b, `bond:${a.id}`) - 2;
      }
      if (a) a.props["actCount"] = Math.max(0, numProp(a, "actCount") - 1);
      // 凶事折损: 涉事配角(动态登场者 id 以 s 开头)有一人陨落 — 世界有真生死(主角生死留给作者裁决)
      const fallen = targets.find((c) => c.id.startsWith("s") && c.present);
      if (fallen) {
        fallen.present = false;
        evs.push({ kind: "CharacterFell", characterId: fallen.id, name: fallen.name, cause: story.name });
        // 立碑·复仇: 与逝者羁绊最深的在场者起复仇之心(后续章节自动生复仇/追杀线)
        let avenger: CharacterState | undefined;
        let bestBond = 0;
        for (const c of Object.values(snapshot.characters)) {
          if (!c.present || c.id === fallen.id) continue;
          const b = numProp(c, `bond:${fallen.id}`);
          if (b > bestBond) {
            bestBond = b;
            avenger = c;
          }
        }
        if (avenger) {
          avenger.props["avenge"] = fallen.name;
          avenger.narrativeStress = Math.min(1, avenger.narrativeStress + 0.2);
          avenger.traits["initiative"] = (avenger.traits["initiative"] ?? 0) + 1;
        }
      }
    }
    evs.push({ kind: "StoryEventTriggered", eventId: story.id, name: story.name, summary: story.summary });
  }

  // director 相位: 计划已于 tick 起算好(focus 轮转); 此处仅 emit + 状态已在 nextDirector
  evs.push({ kind: "DirectorPlanned", tickIndex: tick, arcPhase: plan.arcPhase, tension: plan.tension, focus: plan.focus, compose: plan.compose });

  // compose 相位(director 触发): 章节是模拟副产品。素材 = 近期心象(DB)+ 本 tick 心象。
  let composed: ComposedChapter | null = null;
  if (plan.compose) {
    const stageSums = store.readRecentStageSummaries(db, worldId, 8); // 实际发生的事(互动/突破)
    const dbRecent = store.readRecentReflections(db, worldId, 4);
    const thisTick = evs
      .filter((e): e is Extract<DomainEvent, { kind: "MemoryRecorded" }> => e.kind === "MemoryRecorded")
      .map((e) => e.body);
    composed = await composeChapter(snapshot, [...stageSums, ...dbRecent, ...thisTick], pack, llm, tick);
    evs.push({ kind: "ChapterDrafted", chapterId: composed.chapterId, goal: composed.goal });
    evs.push({ kind: "ChapterInscribed", chapterId: composed.chapterId, sceneIds: composed.sceneIds });
  }

  evs.push({ kind: "RunCompleted", runId, tick });

  // 物化成 WorldEventRecord(展示文案走 pack.eventVocab)
  const ts = Date.now();
  const records: WorldEventRecord[] = evs.map((ev, i) => {
    const meta = EVENT_SUBSYSTEM[ev.kind];
    const verb = pack.eventVocab.verbs[ev.kind];
    const subject = evSubject(ev);
    return {
      id: eventId(meta.subsystem, runId, ev.kind, i),
      worldId,
      lineId: snapshot.lineId,
      tick,
      kind: ev.kind,
      subsystem: meta.subsystem,
      severity: meta.severity,
      verb,
      subject,
      summary: subject ? `${verb ?? ev.kind}·${subject}` : verb ?? ev.kind,
      payload: ev,
      ts,
    };
  });

  // saveStep: 单事务(单写者) → 无半提交。注意: LLM 调用已在上方 await 完, 事务内全同步。
  store.transaction(db, () => {
    store.startRun(db, runId, worldId, tick, ts);
    for (const r of records) store.appendEvent(db, r);
    if (composed) {
      store.saveChapter(db, { id: composed.chapterId, worldId, lineId: snapshot.lineId, goal: composed.goal, text: composed.text, status: "inscribed", sceneIds: composed.sceneIds, createdAt: ts });
    }
    const seq = store.maxSeq(db, worldId);
    store.saveSnapshot(db, worldId, snapshot, seq, ts);
    store.writeCheckpoint(db, worldId, tick, "tick-end", gen, { director: nextDirector }, ts);
    store.setSchedulerState(db, worldId, { gen: gen + 1, nextTick: tick + 1, status: "running" }, ts);
    store.finishRun(db, runId, "completed", ts);
  });

  return { ran: true, tick, eventCount: records.length, chosenId: chosen ? chosen.candidate.id : null };
}
