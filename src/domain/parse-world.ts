// Layer 1 · Markdown world parser.
// Pure function. Takes the structured `# 世界设定 / # 角色 / …` Markdown
// format documented in USAGE.md and returns a ParsedWorldDraft ready to feed
// WorldStore.applyDraft(). Tolerant: missing sections produce empty arrays;
// `must_trend` and `mustTrend` style keys both work.

import type {
  CharacterAnchor,
  CharacterProfile,
  ParsedWorldDraft,
  RelationshipAnchor,
  RelationshipProfile,
  WorldSpec,
} from "./world";

type Section = { heading: string; lines: string[] };

const HEADING_RE = /^#\s+(.+?)\s*$/;
const KV_DELIM_RE = /\s*\|\s*/;
const COLON_RE = /[:：]/;

export function parseWorldMarkdown(md: string): ParsedWorldDraft {
  const sections = splitSections(md);

  const worldSpec = parseWorldSpec(findSection(sections, "世界设定"));
  worldSpec.factions = parseNameDesc(findSection(sections, "势力"));
  worldSpec.locations = parseNameDesc(findSection(sections, "地点"));

  const characters = parseCharacters(findSection(sections, "角色"));
  const relationships = parseRelationships(findSection(sections, "关系"));
  const characterAnchors = parseCharacterAnchors(findSection(sections, "单角色锚点"));
  const relationshipAnchors = parseRelationshipAnchors(findSection(sections, "关系锚点"));

  return {
    worldSpec,
    characters,
    relationships,
    characterAnchors,
    relationshipAnchors,
  };
}

// =============================================================================
// section split
// =============================================================================
function splitSections(md: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const raw of md.split(/\r?\n/)) {
    const line = raw;
    const m = HEADING_RE.exec(line);
    if (m) {
      if (current) sections.push(current);
      current = { heading: m[1], lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

function findSection(sections: Section[], heading: string): string[] {
  return sections.find((s) => s.heading === heading)?.lines ?? [];
}

// =============================================================================
// world spec
// =============================================================================
function parseWorldSpec(lines: string[]): WorldSpec {
  const spec: WorldSpec = {
    genre: "",
    timeScale: "",
    cultivationSystem: "",
    worldRules: [],
    factions: [],
    locations: [],
  };
  let inRules = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("世界规则")) {
      inRules = true;
      continue;
    }
    if (trimmed.startsWith("- ") && inRules) {
      spec.worldRules.push(trimmed.slice(2).trim());
      continue;
    }
    inRules = false;
    const m = trimmed.match(/^([^：:]+)[：:]\s*(.+)$/);
    if (!m) continue;
    const [, key, value] = m;
    switch (key.trim()) {
      case "题材":
        spec.genre = value.trim();
        break;
      case "时间尺度":
        spec.timeScale = value.trim();
        break;
      case "修炼体系":
        spec.cultivationSystem = value.trim();
        break;
    }
  }
  return spec;
}

function parseNameDesc(lines: string[]): Array<{ name: string; description: string }> {
  const out: Array<{ name: string; description: string }> = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("- ")) continue;
    const body = trimmed.slice(2).trim();
    const colonIdx = indexOfFirstColon(body);
    if (colonIdx < 0) {
      out.push({ name: body, description: "" });
      continue;
    }
    out.push({
      name: body.slice(0, colonIdx).trim(),
      description: body.slice(colonIdx + 1).trim(),
    });
  }
  return out;
}

function indexOfFirstColon(s: string): number {
  const colon = s.indexOf(":");
  const fullwidth = s.indexOf("：");
  if (colon < 0) return fullwidth;
  if (fullwidth < 0) return colon;
  return Math.min(colon, fullwidth);
}

// =============================================================================
// characters / relationships / anchors
// =============================================================================
function parseCharacters(lines: string[]): CharacterProfile[] {
  const out: CharacterProfile[] = [];
  for (const line of lines) {
    const parts = splitPipeLine(line);
    if (!parts) continue;
    const [id, kv] = parts;
    out.push({
      id,
      name: kv.name ? kv.name : id,
      description: kv.description,
      baziRaw: kv.baziRaw,
      archetypeDraft: kv.archetypeDraft,
      faction: kv.faction ?? "",
      role: kv.role ?? "",
      traits: kv.traits ? kv.traits.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : [],
      goal: kv.goal ?? "",
      stance: kv.stance ?? "",
      resource: kv.resource ?? "",
    });
  }
  return out;
}

function parseRelationships(lines: string[]): RelationshipProfile[] {
  const out: RelationshipProfile[] = [];
  for (const line of lines) {
    const parsed = splitRelationshipPipeLine(line);
    if (!parsed) continue;
    const { left, right, kv } = parsed;
    out.push({
      id: `${left}-${right}`,
      left,
      right,
      status: kv.status ?? "",
      history: kv.history ?? "",
      tension: kv.tension ?? "",
    });
  }
  return out;
}

function parseCharacterAnchors(lines: string[]): CharacterAnchor[] {
  const out: CharacterAnchor[] = [];
  for (const line of lines) {
    const parts = splitPipeLine(line);
    if (!parts) continue;
    const [id, kv] = parts;
    out.push({
      characterId: id,
      cannot: kv.cannot ?? "",
      mustTrend: kv.mustTrend ?? kv.must_trend ?? "",
      stageGoal: kv.stageGoal ?? kv.stage_goal ?? "",
    });
  }
  return out;
}

function parseRelationshipAnchors(lines: string[]): RelationshipAnchor[] {
  const out: RelationshipAnchor[] = [];
  for (const line of lines) {
    const parsed = splitRelationshipPipeLine(line);
    if (!parsed) continue;
    const { left, right, kv } = parsed;
    out.push({
      relationshipId: `${left}-${right}`,
      left,
      right,
      boundary: kv.boundary ?? "",
      trend: kv.trend ?? "",
    });
  }
  return out;
}

// =============================================================================
// pipe-delimited "- {id} | k=v | k=v" parser
// =============================================================================
function splitPipeLine(line: string): [string, Record<string, string>] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("- ")) return null;
  const body = trimmed.slice(2).trim();
  if (!body) return null;
  const segments = body.split(KV_DELIM_RE);
  const id = segments.shift()!.trim();
  const kv: Record<string, string> = {};
  for (const seg of segments) {
    const eqIdx = seg.indexOf("=");
    if (eqIdx < 0) continue;
    const key = seg.slice(0, eqIdx).trim();
    const value = seg.slice(eqIdx + 1).trim();
    if (key) kv[key] = value;
  }
  return [id, kv];
}

function splitRelationshipPipeLine(line: string):
  | { left: string; right: string; kv: Record<string, string> }
  | null {
  const parsed = splitPipeLine(line);
  if (!parsed) return null;
  const [id, kv] = parsed;
  const m = id.split(/\s*<->\s*/);
  if (m.length !== 2) return null;
  return { left: m[0].trim(), right: m[1].trim(), kv };
}
