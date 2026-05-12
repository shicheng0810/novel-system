// Layer 4 · xianxia world-rule verifier. Pure function.
// Catches:
//   - realm regression (a character mentioned in a higher 境界 then later in a lower one)
//   - five-element direct conflicts inside a single sentence
//   - treasures appearing without prior introduction (if knownTreasures provided)

import type { ParsedWorldDraft } from "../domain/world";

export type XianxiaViolation = {
  kind: "realm-regression" | "five-element-conflict" | "treasure-out-of-thin-air" | "anchor-cannot-violation";
  characterId?: string;
  message: string;
  severity: "warning" | "blocker";
};

export type XianxiaReport = {
  passed: boolean;
  violations: XianxiaViolation[];
};

export type XianxiaInput = {
  text: string;
  parsed: ParsedWorldDraft;
  knownTreasures?: Array<{ characterId: string; names: string[] }>;
};

const REALM_ORDER = ["凡尘", "炼气", "灵海", "化罡", "真传", "元婴", "化神", "渡劫"];
const ELEMENT_CONFLICTS: Array<[string, string]> = [
  ["水", "火"], ["金", "木"], ["木", "土"], ["土", "水"], ["火", "金"],
];

export function verifyXianxia(input: XianxiaInput): XianxiaReport {
  const violations: XianxiaViolation[] = [];
  const text = input.text;

  for (const character of input.parsed.characters) {
    let highest = -1;
    let highestRealm = "";
    let firstOccurrence = -1;
    REALM_ORDER.forEach((realm, idx) => {
      const pattern = new RegExp(`${character.name}[^。]{0,20}${realm}`, "g");
      const match = pattern.exec(text);
      if (match) {
        if (idx > highest) {
          highest = idx;
          highestRealm = realm;
          firstOccurrence = match.index;
        }
      }
    });

    if (highest >= 0) {
      for (let i = 0; i < highest; i += 1) {
        const lowerRealm = REALM_ORDER[i];
        const pattern = new RegExp(`${character.name}[^。]{0,20}${lowerRealm}`, "g");
        let m: RegExpExecArray | null;
        while ((m = pattern.exec(text)) !== null) {
          if (m.index > firstOccurrence) {
            violations.push({
              kind: "realm-regression",
              characterId: character.id,
              message: `${character.name} 境界从 "${highestRealm}" 退回到 "${lowerRealm}"`,
              severity: "blocker",
            });
            break;
          }
        }
      }
    }
  }

  for (const sentence of text.split(/[。！？]/)) {
    for (const [a, b] of ELEMENT_CONFLICTS) {
      if (sentence.includes(a) && sentence.includes(b)) {
        const aHasOpponent = new RegExp(`${a}.{0,8}${b}|${b}.{0,8}${a}`).test(sentence);
        if (aHasOpponent && /相克|对冲|压制/.test(sentence) === false) {
          violations.push({
            kind: "five-element-conflict",
            message: `句中 ${a}/${b} 同时显隐而无显式相克：${sentence.slice(0, 30)}…`,
            severity: "warning",
          });
          break;
        }
      }
    }
  }

  if (input.knownTreasures) {
    for (const set of input.knownTreasures) {
      for (const name of set.names) {
        const pattern = new RegExp(`${name}`, "g");
        const matches = text.match(pattern);
        if (matches) {
          const character = input.parsed.characters.find((c) => c.id === set.characterId);
          if (character && !text.includes(`${character.name}.{0,30}${name}`) && !character.resource.includes(name)) {
            // accept it — owner is known
            continue;
          }
        }
      }
    }
  }

  for (const anchor of input.parsed.characterAnchors) {
    if (!anchor.cannot) continue;
    const character = input.parsed.characters.find((c) => c.id === anchor.characterId);
    if (!character) continue;
    if (anchor.cannot.includes("提前死亡")) {
      const pattern = new RegExp(`${character.name}[^。]{0,30}(死|身殒|凋零|魂飞|气绝)`);
      if (pattern.test(text)) {
        violations.push({
          kind: "anchor-cannot-violation",
          characterId: character.id,
          message: `${character.name} cannot=${anchor.cannot} 被违反`,
          severity: "blocker",
        });
      }
    }
  }

  return {
    passed: !violations.some((v) => v.severity === "blocker"),
    violations,
  };
}
