import {
  CharacterAnchor,
  CharacterProfile,
  ParsedWorldDraft,
  RelationshipAnchor,
  RelationshipProfile,
  WorldSpec,
  createCharacterId,
  normalizeBulletLine,
  pairKey,
} from "./domain";

type SectionName = "世界设定" | "势力" | "地点" | "角色" | "关系" | "单角色锚点" | "关系锚点";

const SECTION_NAMES = new Set<SectionName>(["世界设定", "势力", "地点", "角色", "关系", "单角色锚点", "关系锚点"]);

function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[，,、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAttributes(parts: string[]): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.split("=");
    const key = rawKey?.trim();
    if (!key) {
      continue;
    }
    attributes[key] = rawValue.join("=").trim();
  }
  return attributes;
}

function parseNamedDescription(line: string): { name: string; description: string } | undefined {
  const content = normalizeBulletLine(line);
  const separator = content.includes("：") ? "：" : ":";
  const index = content.indexOf(separator);
  if (index === -1) {
    return undefined;
  }
  const name = content.slice(0, index).trim();
  if (!name) {
    return undefined;
  }
  return {
    name,
    description: content.slice(index + 1).trim(),
  };
}

function parseCharacter(line: string): CharacterProfile | undefined {
  const content = normalizeBulletLine(line);
  const [rawName, ...rawAttributes] = content.split("|").map((part) => part.trim());
  if (!rawName) {
    return undefined;
  }
  const attributes = parseAttributes(rawAttributes);
  const name = rawName.trim();
  return {
    id: createCharacterId(name),
    name,
    description: attributes.description,
    baziRaw: attributes.baziRaw,
    archetypeDraft: attributes.archetypeDraft,
    faction: attributes.faction ?? "未定势力",
    role: attributes.role ?? "未定身份",
    traits: splitList(attributes.traits),
    goal: attributes.goal ?? "目标未定",
    stance: attributes.stance ?? "未定立场",
    resource: attributes.resource ?? "资源未定",
  };
}

function parseRelationship(line: string): RelationshipProfile | undefined {
  const content = normalizeBulletLine(line);
  const [rawPair, ...rawAttributes] = content.split("|").map((part) => part.trim());
  const [left, right] = rawPair.split("<->").map((part) => part.trim());
  if (!left || !right) {
    return undefined;
  }
  const attributes = parseAttributes(rawAttributes);
  return {
    id: pairKey(left, right),
    left,
    right,
    status: attributes.status ?? "未定关系",
    history: attributes.history ?? "暂无共同历史",
    tension: attributes.tension ?? "张力未定",
  };
}

function parseCharacterAnchor(line: string): CharacterAnchor | undefined {
  const content = normalizeBulletLine(line);
  const [characterId, ...rawAttributes] = content.split("|").map((part) => part.trim());
  if (!characterId) {
    return undefined;
  }
  const attributes = parseAttributes(rawAttributes);
  return {
    characterId,
    cannot: attributes.cannot ?? "",
    mustTrend: attributes.must_trend ?? attributes.mustTrend ?? "",
    stageGoal: attributes.stage_goal ?? attributes.stageGoal ?? "",
  };
}

function parseRelationshipAnchor(line: string): RelationshipAnchor | undefined {
  const content = normalizeBulletLine(line);
  const [rawPair, ...rawAttributes] = content.split("|").map((part) => part.trim());
  const [left, right] = rawPair.split("<->").map((part) => part.trim());
  if (!left || !right) {
    return undefined;
  }
  const attributes = parseAttributes(rawAttributes);
  return {
    relationshipId: pairKey(left, right),
    left,
    right,
    boundary: attributes.boundary ?? "",
    trend: attributes.trend ?? "",
  };
}

function sectionize(draft: string): Map<SectionName, string[]> {
  const sections = new Map<SectionName, string[]>();
  let current: SectionName | undefined;
  for (const rawLine of draft.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (line.startsWith("#")) {
      const title = line.replace(/^#+\s*/, "").trim() as SectionName;
      current = SECTION_NAMES.has(title) ? title : undefined;
      if (current && !sections.has(current)) {
        sections.set(current, []);
      }
      continue;
    }
    if (current) {
      sections.get(current)!.push(line);
    }
  }
  return sections;
}

export function parseWorldDraft(draft: string): ParsedWorldDraft {
  const sections = sectionize(draft);
  const worldLines = sections.get("世界设定") ?? [];
  const worldSpec: WorldSpec = {
    genre: "",
    timeScale: "",
    cultivationSystem: "",
    worldRules: [],
    factions: [],
    locations: [],
  };

  for (const line of worldLines) {
    if (line.startsWith("题材")) {
      worldSpec.genre = line.split(/[：:]/).slice(1).join(":").trim();
    } else if (line.startsWith("时间尺度")) {
      worldSpec.timeScale = line.split(/[：:]/).slice(1).join(":").trim();
    } else if (line.startsWith("修炼体系")) {
      worldSpec.cultivationSystem = line.split(/[：:]/).slice(1).join(":").trim();
    } else if (line.startsWith("-")) {
      worldSpec.worldRules.push(normalizeBulletLine(line));
    }
  }

  worldSpec.factions = (sections.get("势力") ?? []).map(parseNamedDescription).filter(Boolean) as WorldSpec["factions"];
  worldSpec.locations = (sections.get("地点") ?? []).map(parseNamedDescription).filter(Boolean) as WorldSpec["locations"];

  const characters = (sections.get("角色") ?? []).map(parseCharacter).filter(Boolean) as CharacterProfile[];
  const relationships = (sections.get("关系") ?? []).map(parseRelationship).filter(Boolean) as RelationshipProfile[];
  const characterAnchors = (sections.get("单角色锚点") ?? []).map(parseCharacterAnchor).filter(Boolean) as CharacterAnchor[];
  const relationshipAnchors = (sections.get("关系锚点") ?? []).map(parseRelationshipAnchor).filter(Boolean) as RelationshipAnchor[];

  if (characters.length === 0) {
    throw new Error("World draft must define at least one character.");
  }

  return {
    worldSpec: {
      ...worldSpec,
      genre: worldSpec.genre || "未定题材",
      timeScale: worldSpec.timeScale || "阶段",
      cultivationSystem: worldSpec.cultivationSystem || "未定体系",
    },
    characters,
    relationships,
    characterAnchors,
    relationshipAnchors,
  };
}

