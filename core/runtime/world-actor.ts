// core/runtime/world-actor.ts — 单写者 WorldActor。一个 step(异步, 因含 LLM)= 一轮:
//   plan(focus) → drainInputs → frame → agents(reflect+plan via LLM) → branches → gate → commit → director → saveStep(单事务)
// 铁律: 只有这里写 world 表; events + 快照 + checkpoint + scheduler 全在 saveStep 同一事务 → 无半提交。
import type { DB } from "../services/db";
import type { ContentPack, ScoredCandidate, StoryEvent } from "../domain/pack";
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

// 通用数值旋钮读取(genre 中立: 引擎只从 props.tuning.* 读 number, 不解释语义; 由 app 层进化/控制器写入)
function tnum(tune: unknown, key: string, def: number): number {
  if (tune && typeof tune === "object") { const v = (tune as Record<string, unknown>)[key]; if (typeof v === "number" && Number.isFinite(v)) return v; }
  return def;
}
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const numOf = (c: CharacterState, k: string): number => (typeof c.props[k] === "number" ? (c.props[k] as number) : 0);
const facOf = (c: CharacterState): string => (typeof c.props["faction"] === "string" ? (c.props["faction"] as string) : "");

// ── M1 符号心跳: 持续 drive 账本(零 LLM, 全员每 tick)。core 中立: drive 是通用标量, 渲染成"执/渴/怨..."由 pack/app 做。
const driveOf = (c: CharacterState, k: string): number => {
  const d = c.props["drives"];
  return d && typeof d === "object" && typeof (d as Record<string, unknown>)[k] === "number" ? ((d as Record<string, number>)[k] ?? 0) : 0;
};
const setDrive = (c: CharacterState, k: string, v: number): void => {
  const d = (c.props["drives"] && typeof c.props["drives"] === "object" ? c.props["drives"] : {}) as Record<string, number>;
  d[k] = +Math.max(0, Math.min(1, v)).toFixed(3);
  c.props["drives"] = d;
};
// 通用内态键(generic; pack/app 映射到 flavored 词): ambition 执 / want 渴 / grudge 怨 / attachment 慕 / vengeance 仇 / distress 焚 / calm 静
function dominantDrive(c: CharacterState): string {
  const cands: Array<[string, number]> = [["ambition", driveOf(c, "ambition")], ["want", driveOf(c, "want")]];
  let topBond = 0;
  for (const [k, v] of Object.entries(c.props)) if (k.startsWith("bond:") && typeof v === "number" && Math.abs(v) > Math.abs(topBond)) topBond = v;
  if (topBond !== 0) cands.push([topBond < 0 ? "grudge" : "attachment", Math.min(1, Math.abs(topBond) / 4)]);
  if (typeof c.props["avenge"] === "string") cands.push(["vengeance", 0.9]);
  if (c.narrativeStress > 0.7) cands.push(["distress", c.narrativeStress]);
  cands.sort((a, b) => b[1] - a[1]);
  return cands[0] && cands[0][1] > 0.3 ? cands[0][0] : "calm";
}
// appraisal(OCC/GAMYGDALA + 矮人要塞 divider): 事件→情绪增量, 经 caution(持重)钝化, EMA 写回 narrativeStress(同一事件不同命格→不同强度)
function appraise(c: CharacterState, delta: number): void {
  const caut = c.traits["caution"] ?? 0;
  const divider = 1 + caut * 0.8; // 持重越高越钝感
  const eff = delta / divider;
  c.narrativeStress = +Math.max(0, Math.min(1, c.narrativeStress + eff)).toFixed(3);
}

// ── T5: app 层进化出的「模拟机制」(经影子模拟闸准入)以通用数据形式挂在 props.simRules; 引擎只按通用 metric/effect 解释, 零 genre 语义。
function simRuleMetric(metric: string, snapshot: WorldSnapshot): number {
  const present = Object.values(snapshot.characters).filter((c) => c.present);
  switch (metric) {
    case "avgStress": return present.length ? present.reduce((a, c) => a + c.narrativeStress, 0) / present.length : 0;
    case "presentCount": return present.length;
    case "factionCount": return new Set(present.map(facOf).filter(Boolean)).size;
    case "avengerCount": return present.filter((c) => typeof c.props["avenge"] === "string").length;
    case "maxHostility": {
      const fr = (snapshot.props["factionRelations"] as Record<string, Record<string, number>> | undefined) ?? {};
      const live = new Set(present.map(facOf).filter(Boolean));
      let m = 0; for (const a of Object.keys(fr)) for (const b of Object.keys(fr[a] ?? {})) if (live.has(a) && live.has(b)) m = Math.max(m, -(fr[a]?.[b] ?? 0));
      return m;
    }
    default: return 0;
  }
}
function simRuleStoryEvent(snapshot: WorldSnapshot, tick: number): StoryEvent | null {
  const rules = Array.isArray(snapshot.props["simRules"]) ? (snapshot.props["simRules"] as Array<Record<string, unknown>>) : [];
  for (const r of rules) {
    const trig = r["trigger"] as { metric?: string; op?: string; value?: number } | undefined;
    const ev = r["event"] as Record<string, unknown> | undefined;
    if (!trig || !ev || typeof trig.metric !== "string") continue;
    const cooldown = typeof r["cooldown"] === "number" ? (r["cooldown"] as number) : 30;
    const lastFired = typeof r["lastFired"] === "number" ? (r["lastFired"] as number) : -99999;
    if (tick - lastFired < cooldown) continue;
    const mv = simRuleMetric(trig.metric, snapshot);
    if (!(trig.op === "<" ? mv < (trig.value ?? 0) : mv > (trig.value ?? 0))) continue;
    r["lastFired"] = tick; // 标记(snapshot 落盘持久)
    const shifts = Array.isArray(ev["factionShifts"]) ? (ev["factionShifts"] as Array<{ a: string; b: string; delta: number }>).filter((s) => s && typeof s.a === "string" && typeof s.b === "string" && typeof s.delta === "number").map((s) => ({ a: s.a, b: s.b, delta: Math.max(-3, Math.min(3, s.delta)) })) : undefined;
    return {
      id: `simrule-${String(r["id"] ?? "x")}-t${tick}`,
      name: typeof ev["name"] === "string" ? (ev["name"] as string) : String(r["name"] ?? "异变"),
      summary: typeof ev["summary"] === "string" ? (ev["summary"] as string) : "",
      involve: "all",
      gatherAt: typeof ev["gatherAt"] === "string" ? (ev["gatherAt"] as string) : undefined,
      stressDelta: typeof ev["stressDelta"] === "number" ? Math.max(-0.4, Math.min(0.4, ev["stressDelta"] as number)) : undefined,
      crisis: typeof ev["crisis"] === "string" ? (ev["crisis"] as string) : undefined,
      factionShifts: shifts,
      omen: ev["omen"] === "吉" || ev["omen"] === "凶" ? (ev["omen"] as "吉" | "凶") : "平",
    };
  }
  return null;
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
    case "FactionSplit":
      return `${ev.leader}自${ev.faction}裂土自立${ev.into}`;
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
  const processedInputIds: string[] = []; // 标记延后到 saveStep 同事务 → 真原子(防 pkill -9 在 drain 后/save 前: 输入被标 processed 但快照效果未落盘 = 永久丢裁决/spawn/反思)
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
    } else if (inp.type === "mind-update") {
      // M3: 批量反思的产出(app 层异步算好), 在此单事务里写入角色内心 → 单写者铁律不破。通用: 只写 mind 字符串 + 心境微调。
      const updates = Array.isArray(inp.payload["updates"]) ? (inp.payload["updates"] as Array<{ id?: string; mind?: string; stress?: number }>) : [];
      for (const u of updates) {
        const ch = u.id ? snapshot.characters[u.id] : undefined;
        if (ch && ch.present && typeof u.mind === "string" && u.mind) { // 校验仍在场: 滞后落地时角色已陨落则丢弃(不给退场者写心声/心境)
          ch.props["mind"] = u.mind;
          if (typeof u.stress === "number") ch.narrativeStress = Math.max(0, Math.min(1, ch.narrativeStress + u.stress));
        }
      }
    }
    processedInputIds.push(inp.id); // 不在此处提交; 留到 saveStep 同事务标记
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

  // 模拟旋钮(genre 中立通用数值; 默认=现状行为, app 层进化/控制器写入 props.tuning)
  const tune = snapshot.props["tuning"];
  const pw = tnum(tune, "priorWeight", 1);
  const scarcity = clamp01(tnum(tune, "scarcity", 0));
  const conflictRate = tnum(tune, "conflictRate", 1);
  const turnoverRate = tnum(tune, "turnoverRate", 1);
  const nicheWeight = clamp01(tnum(tune, "nicheWeight", 0));
  const structureGrowth = clamp01(tnum(tune, "structureGrowth", 0));
  // branches: 打分 → argmax(确定性, id 平手)。priorWeight 放大/抑制先验引导; nicheWeight 奖励"填补本派系空白生态位"(职能分工涌现, 借 Project Sid)。
  const scored: ScoredCandidate[] = candidates.map((c) => {
    const s = frame && pack.priorSystem ? pack.priorSystem.scoreCandidate(c, frame) : uniformScore(c);
    let w = pw === 1 ? s.weight : Math.max(0, Math.min(1, s.weight + (pw - 1) * s.breakdown.influence));
    if (nicheWeight > 0) {
      const actor = snapshot.characters[c.characterId];
      const fac = actor ? facOf(actor) : "";
      if (fac) {
        const mates = Object.values(snapshot.characters).filter((m) => m.present && facOf(m) === fac);
        if (mates.length >= 2) {
          const sameRole = mates.filter((m) => m.props["roleKind"] === c.kind).length;
          const bonus = nicheWeight * 0.3 * (1 - sameRole / mates.length); // 本派系里该职能(动作类型)越少见 → 越该补位
          w = Math.max(0, Math.min(1, w + bonus));
          return { ...s, weight: w, breakdown: { ...s.breakdown, niche: +bonus.toFixed(3) } };
        }
      }
    }
    return w === s.weight ? s : { ...s, weight: w };
  });
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
    const cActor = snapshot.characters[committed.candidate.characterId];
    if (cActor) cActor.props["roleKind"] = committed.candidate.kind; // 生态位: 记录角色当前职能(动作类型) → 供 nicheWeight 分工打分
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

  // 经济: scarcity=0 → 各按地块 yield 自由积累(现状); scarcity→1 → 同地块为「固定且次线性的资源池」零和竞争(质量守恒, 强者多得、拥挤减产) → 竞争/生态位/寄生自发涌现(借 Tierra/Avida/Flow-Lenia)。
  const locKeys = Object.keys(snapshot.locations);
  const presentAll = Object.values(snapshot.characters).filter((c) => c.present);
  const powerOf = (c: CharacterState): number => 1 + numOf(c, "历练") * 0.3 + (c.progressionTier ? 0.5 : 0);
  const byLoc = new Map<string, CharacterState[]>();
  for (const c of presentAll) { const k = c.locationId ?? ""; const arr = byLoc.get(k); if (arr) arr.push(c); else byLoc.set(k, [c]); }
  for (const [locId, occ] of byLoc) {
    const loc = snapshot.locations[locId];
    const y = loc && typeof loc.props["yield"] === "number" ? (loc.props["yield"] as number) : 0.3;
    if (scarcity <= 0 || occ.length < 2) { for (const c of occ) c.props["resource"] = numOf(c, "resource") + y; continue; }
    const pool = y * Math.sqrt(occ.length); // 次线性池: 人越多人均越少(拥挤)→ 稀缺
    const totP = occ.reduce((a, c) => a + powerOf(c), 0) || 1;
    const top = [...occ].sort((a, b) => powerOf(b) - powerOf(a))[0]!;
    for (const c of occ) {
      const gain = (1 - scarcity) * y + scarcity * (pool * (powerOf(c) / totP));
      c.props["resource"] = numOf(c, "resource") + gain;
      // 同地块同派系竞争: 吃亏者对头号得利者生嫌隙 → 派系内裂痕积累(喂 structureGrowth 分裂)
      if (gain < y * 0.85 && c.id !== top.id && facOf(c) && facOf(c) === facOf(top)) c.props[`bond:${top.id}`] = numOf(c, `bond:${top.id}`) - scarcity * conflictRate * 0.4 * (1 - nicheWeight); // niche 协作缓冲 scarcity 内斗: 二者共享派系内聚力轴, 此消彼长而非各写各的
    }
  }
  // M1 符号心跳: 全员每 tick 更新持续 drive(零 LLM); 非焦点心境改为受未满足 drive 牵引的 EMA → 不再"冻结"(根治个体内心短板)
  for (const c of presentAll) {
    const init = c.traits["initiative"] ?? 0, caut = c.traits["caution"] ?? 0;
    const vol = Math.max(0.3, 1 - caut * 0.4); // 持重(caution)→ 波动收敛、情绪更稳
    const res = numOf(c, "resource"), actCount = numOf(c, "actCount");
    setDrive(c, "want", driveOf(c, "want") + (res < 4 ? 0.05 : -0.04) * vol); // 穷则渴↑、富则降
    setDrive(c, "ambition", driveOf(c, "ambition") + (0.02 * (1 + init) - 0.02 + (actCount >= 4 ? 0.03 : 0)) * vol); // 进取者执念↑、临突破更炽
    c.props["innerDrive"] = dominantDrive(c); // 通用内态键(执/渴/怨... 由 pack/app 渲染)
    if (plan.focus.includes(c.id)) continue; // 焦点者心境由 agent/commit 主理
    const target = Math.min(1, 0.22 + 0.45 * driveOf(c, "want") + 0.33 * driveOf(c, "ambition")); // 心境基线由未满足的 drive 拉高
    c.narrativeStress = +(c.narrativeStress + (target - c.narrativeStress) * 0.15 * vol).toFixed(3); // EMA 朝 target 滑(有惯性/余韵), 替代单调回落=解冻
    const sig = c.id.charCodeAt(c.id.length - 1);
    if ((tick + sig) % 6 === 0 && locKeys.length > 1) {
      const dest = locKeys[(sig + Math.floor(tick / 6)) % locKeys.length]!; // 确定性游走, 错开 → 散布全图
      if (dest !== c.locationId) c.locationId = dest;
    }
  }

  // 系统级剧情事件(势力战争/秘境副本/魔道入侵…): 涉事角色聚集 + 抬张力 + 设世界危机。
  // pack 不起大事时, 回落到 app 层进化出的「模拟机制」(经影子模拟闸准入, props.simRules)——让模拟器自己长出新玩法。
  const mergedThisTick = new Set<string>(); // 本 tick 被吞并(改派)的角色 → 不再参与同 tick 的结构生长分裂(防同一角色"并了又裂"自相矛盾)
  const story = pack.nextStoryEvent?.(snapshot, tick) ?? simRuleStoryEvent(snapshot, tick);
  if (story) {
    const present2 = Object.values(snapshot.characters).filter((c) => c.present);
    const targets =
      !story.involve || story.involve === "all"
        ? present2
        : present2.filter((c) => (story.involve as string[]).includes(c.id) || (story.involve as string[]).includes(String(c.props["faction"] ?? "")));
    for (const c of targets) {
      if (story.gatherAt && snapshot.locations[story.gatherAt]) c.locationId = story.gatherAt;
      if (story.stressDelta) appraise(c, story.stressDelta * conflictRate); // appraisal: 经 caution 钝化 → 同一大事不同命格受触不同
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
        for (const c of membersOf(loser)) { c.props["faction"] = winner; mergedThisTick.add(c.id); } // 残部归并强者(记入本 tick 已吞并集)
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
          appraise(c, 0.6); // 顶满改大正增量(经 caution divider): 不再绝对 =1 抹掉前面 appraise, 命格钝化对所有路径一致生效
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
        appraise(c, -0.25); // 吉事舒缓(同经 appraisal 钝化)
      }
    } else if (story.omen === "凶") {
      for (const c of targets) appraise(c, 0.7); // 凶事重创, 但持重者受触轻(appraisal divider)
      const a = targets[0];
      const b = targets[1];
      if (a && b) {
        a.props[`bond:${b.id}`] = numProp(a, `bond:${b.id}`) - 2;
        b.props[`bond:${a.id}`] = numProp(b, `bond:${a.id}`) - 2;
      }
      if (a) a.props["actCount"] = Math.max(0, numProp(a, "actCount") - 1);
      // 凶事折损: 涉事配角(动态登场者 id 以 s 开头)有一人陨落 — 世界有真生死(主角生死留给作者裁决)。
      // turnoverRate 代谢率累加器: <1 → 隔次才折损(角色更长寿, 防群像坍塌; 已验证旧世界减员快于补员→坍塌到2人); =1 现状; >1 略增。
      const fallen = targets.find((c) => c.id.startsWith("s") && c.present && !pending.some((p) => p.charId === c.id)); // 排除正等作者裁决的角色: 避免突破悬而未决时被凶事写死(裁决落空到已退场角色)
      const fallDebt = fallen ? Math.min(2, tnum(snapshot.props, "fallDebt", 0) + turnoverRate) : 0;
      if (fallen && fallDebt >= 1) {
        snapshot.props["fallDebt"] = fallDebt - 1;
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
      } else if (fallen) {
        snapshot.props["fallDebt"] = fallDebt; // 未到阈值: 攒着, 这桩凶事不折损(turnoverRate<1 的长寿效果)
      }
    }
    evs.push({ kind: "StoryEventTriggered", eventId: story.id, name: story.name, summary: story.summary });
  }

  // 结构生长: 派系分裂/新生(structureGrowth>0 才启)。大派系内部出现「与本派系离心」的小团体(intra bond 转负, 由 scarcity 竞争/凶事积累)→ 叛离自立新派系。
  // 对冲「只合并不新生」的版图单一化, 让社会结构本身随世界生长(借 Static-Sandboxes 协同演化 + 命名游戏临界质量)。core 中立: 派系=prop 字符串, 新派系以叛首为名。
  if (structureGrowth > 0) {
    let splitDebt = tnum(snapshot.props, "splitDebt", 0);
    const facMembers = new Map<string, CharacterState[]>();
    for (const c of presentAll) { const f = facOf(c); if (!f) continue; const a = facMembers.get(f); if (a) a.push(c); else facMembers.set(f, [c]); }
    for (const [fac, mem] of facMembers) {
      if (mem.length < 4) continue;
      const avgIntra = (m: CharacterState): number => { const o = mem.filter((x) => x.id !== m.id); return o.length ? o.reduce((a, x) => a + numOf(m, `bond:${x.id}`), 0) / o.length : 0; };
      const dissidents = mem.filter((m) => avgIntra(m) < -1 && !mergedThisTick.has(m.id)); // 与本派系离心者(临界质量小团体); 排除本 tick 刚被吞并者 → 同一角色一 tick 内只允许一次终态 faction 变更
      if (dissidents.length >= 2 && dissidents.length < mem.length) {
        splitDebt += structureGrowth;
        if (splitDebt >= 1) {
          splitDebt -= 1;
          const leader = [...dissidents].sort((a, b) => avgIntra(a) - avgIntra(b))[0]!;
          const newFac = `${leader.name}部`;
          for (const d of dissidents) d.props["faction"] = newFac;
          const fr2 = (snapshot.props["factionRelations"] as Record<string, Record<string, number>> | undefined) ?? {};
          (fr2[fac] = fr2[fac] ?? {})[newFac] = -4; (fr2[newFac] = fr2[newFac] ?? {})[fac] = -4; // 新旧派系交恶
          snapshot.props["factionRelations"] = fr2;
          evs.push({ kind: "FactionSplit", faction: fac, into: newFac, leader: leader.name });
          break; // 一 tick 至多一裂, 防雪崩
        }
      }
    }
    snapshot.props["splitDebt"] = splitDebt;
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
    for (const id of processedInputIds) store.markInputProcessed(db, id, ts); // 与快照效果同事务提交: 半路被杀则输入仍 pending, 下次重放(裁决经 pending 列表/spawn 经 id 去重/mind 幂等, 重放安全)
    store.finishRun(db, runId, "completed", ts);
  });

  return { ran: true, tick, eventCount: records.length, chosenId: chosen ? chosen.candidate.id : null };
}
