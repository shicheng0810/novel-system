import {
  ChapterInputView,
  CharacterStateView,
  FactionStateView,
  ForeshadowView,
  LocationStateView,
  NarrativeLens,
  RelationshipStateView,
  TimelineLine,
} from "./domain";

function selectEvents(line: TimelineLine, stageRange: string[]) {
  return line.events.filter((event) => stageRange.length === 0 || stageRange.includes(event.stageId));
}

function referenceStageId(line: TimelineLine, stageRange: string[]): string | undefined {
  const stage = [...line.stages].reverse().find((candidate) => stageRange.length === 0 || stageRange.includes(candidate.id));
  return stage?.id ?? line.stages.at(-1)?.id ?? "initial";
}

function buildFactionViews(characters: CharacterStateView[]): FactionStateView[] {
  const grouped = new Map<string, string[]>();
  for (const character of characters) {
    grouped.set(character.faction, [...(grouped.get(character.faction) ?? []), character.id]);
  }
  return [...grouped.entries()].map(([name, memberIds]) => ({
    name,
    memberIds,
    pressureTags: memberIds.length > 1 ? ["多人同场"] : ["单点承压"],
  }));
}

function buildLocationViews(line: TimelineLine, stageIds: string[]): LocationStateView[] {
  return stageIds.map((stageId) => {
    const stage = line.stages.find((candidate) => candidate.id === stageId);
    return {
      name: stage?.qimenContext.locationFocus ?? stage?.stageLabel ?? stageId,
      stageIds: [stageId],
      pressureSummary: stage?.metaphysicsExplanation.summary ?? "该阶段继续推进。",
    };
  });
}

function buildForeshadowViews(line: TimelineLine, stageIds: string[]): ForeshadowView[] {
  return selectEvents(line, stageIds)
    .filter((event) => event.summary.includes("下一章") || event.tags.includes("branch"))
    .map((event) => ({
      id: `${line.lineId}-${event.id}-foreshadow`,
      lineId: line.lineId,
      stageId: event.stageId,
      summary: event.summary,
      relatedCharacterIds: event.participants,
      relatedEventIds: [event.id],
    }));
}

export function buildChapterInputView(input: {
  line: TimelineLine;
  stageRange: string[];
  focusCharacterIds: string[];
}): ChapterInputView {
  const events = selectEvents(input.line, input.stageRange);
  const stageIds = input.stageRange.length > 0 ? input.stageRange : [...new Set(events.map((event) => event.stageId))];
  const snapshot = input.line.snapshots[referenceStageId(input.line, stageIds) ?? "initial"] ?? input.line.snapshots.initial;
  const characterViews: CharacterStateView[] = Object.entries(snapshot?.characters ?? {}).map(([id, state]) => ({
    id,
    name: state.name,
    faction: state.faction,
    role: state.role,
    stance: state.stance,
    lastAction: state.lastAction,
    pressure: state.pressure,
    progress: state.progress,
    currentFortune: state.currentFortune,
  }));
  const relationshipViews: RelationshipStateView[] = Object.values(snapshot?.relationships ?? {}).map((state) => ({
    key: state.key,
    left: state.left,
    right: state.right,
    status: state.status,
    trust: state.trust,
    hostility: state.hostility,
  }));

  return {
    lineId: input.line.lineId,
    stageIds,
    eventIds: events.map((event) => event.id),
    characterViews,
    relationshipViews,
    factionViews: buildFactionViews(characterViews),
    locationViews: buildLocationViews(input.line, stageIds),
    foreshadowViews: buildForeshadowViews(input.line, stageIds),
    hardFacts: events.map((event) => `${event.title}：${event.summary}`),
    worldPressureSummary: events.at(-1)?.summary ?? "暂无阶段事件。",
  };
}

export function buildChapterInputFromLens(input: { line: TimelineLine; lens: NarrativeLens }): ChapterInputView {
  return buildChapterInputView({
    line: input.line,
    stageRange: input.lens.stageRange,
    focusCharacterIds: input.lens.focusCharacterIds,
  });
}

