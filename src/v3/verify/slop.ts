// Layer 4 · slop detector. Pure function over chapter prose.
// Catches the common AI-prose tells: simile-overuse, generic conjunctions,
// over-melodrama, repeated 4-character idioms, trailing 翻涌.

export type SlopIssue = {
  category: SlopCategory;
  message: string;
  severity: "info" | "warning";
};

export type SlopCategory =
  | "simile-overuse"
  | "generic-conjunction"
  | "stock-imagery"
  | "filler-adverb"
  | "repeated-idiom"
  | "exclamation-overuse";

export type SlopReport = {
  issues: SlopIssue[];
  slopScore: number;          // 0..10 (higher = worse)
  density: Record<SlopCategory, number>;
};

const SIMILE_PATTERNS = [/如同/g, /宛如/g, /仿佛/g, /好似/g, /犹如/g];
const GENERIC_CONJUNCTIONS = [/与此同时/g, /然而然/g, /不仅如此/g, /换言之/g, /在此之前/g];
const STOCK_IMAGERY = [/血色残阳/g, /眼神深邃/g, /嘴角勾起一丝弧度/g, /翻涌的杀意/g, /冷冽的气息/g];
const FILLER_ADVERBS = [/缓缓地/g, /淡淡地/g, /微微地/g, /慢慢地/g, /轻轻地/g];
const EXCLAMATION = /[！]/g;

function densityPerThousand(text: string, count: number): number {
  if (text.length === 0) return 0;
  return (count / text.length) * 1000;
}

function countMatches(text: string, patterns: RegExp[]): number {
  let total = 0;
  for (const re of patterns) {
    const matches = text.match(re);
    if (matches) total += matches.length;
  }
  return total;
}

function findRepeatedIdioms(text: string): string[] {
  const counts = new Map<string, number>();
  for (let i = 0; i < text.length - 3; i += 1) {
    const idiom = text.slice(i, i + 4);
    if (/^[一-鿿]{4}$/.test(idiom)) {
      counts.set(idiom, (counts.get(idiom) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 4)
    .map(([idiom]) => idiom);
}

export function sanitizeProse(text: string): SlopReport {
  const issues: SlopIssue[] = [];

  const simileCount = countMatches(text, SIMILE_PATTERNS);
  const simileDensity = densityPerThousand(text, simileCount);
  if (simileDensity >= 4) {
    issues.push({
      category: "simile-overuse",
      message: `比喻词使用过密：${simileCount} 处（每千字 ${simileDensity.toFixed(1)}）`,
      severity: simileDensity >= 6 ? "warning" : "info",
    });
  }

  const conjCount = countMatches(text, GENERIC_CONJUNCTIONS);
  const conjDensity = densityPerThousand(text, conjCount);
  if (conjDensity >= 3) {
    issues.push({
      category: "generic-conjunction",
      message: `通用连接词偏多：${conjCount} 处（每千字 ${conjDensity.toFixed(1)}）`,
      severity: "info",
    });
  }

  const stockCount = countMatches(text, STOCK_IMAGERY);
  const stockDensity = densityPerThousand(text, stockCount);
  if (stockCount > 0) {
    issues.push({
      category: "stock-imagery",
      message: `套话意象出现 ${stockCount} 次`,
      severity: stockCount >= 3 ? "warning" : "info",
    });
  }

  const fillerCount = countMatches(text, FILLER_ADVERBS);
  const fillerDensity = densityPerThousand(text, fillerCount);
  if (fillerDensity >= 4) {
    issues.push({
      category: "filler-adverb",
      message: `缓字副词偏多：${fillerCount} 处（每千字 ${fillerDensity.toFixed(1)}）`,
      severity: "info",
    });
  }

  const repeated = findRepeatedIdioms(text);
  if (repeated.length > 0) {
    issues.push({
      category: "repeated-idiom",
      message: `4 字短语重复出现：${repeated.slice(0, 5).join("、")}`,
      severity: "warning",
    });
  }

  const exclamCount = (text.match(EXCLAMATION)?.length ?? 0);
  const exclamDensity = densityPerThousand(text, exclamCount);
  if (exclamDensity >= 4) {
    issues.push({
      category: "exclamation-overuse",
      message: `感叹号偏多：${exclamCount} 处（每千字 ${exclamDensity.toFixed(1)}）`,
      severity: "info",
    });
  }

  const density: Record<SlopCategory, number> = {
    "simile-overuse": simileDensity,
    "generic-conjunction": conjDensity,
    "stock-imagery": stockDensity,
    "filler-adverb": fillerDensity,
    "repeated-idiom": repeated.length,
    "exclamation-overuse": exclamDensity,
  };

  const slopScore = Math.min(
    10,
    issues.reduce((acc, issue) => acc + (issue.severity === "warning" ? 2 : 1), 0),
  );

  return { issues, slopScore, density };
}
