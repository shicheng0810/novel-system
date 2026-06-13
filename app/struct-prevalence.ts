// app/struct-prevalence.ts — P0 确定性类结构 bug 发率基线(.audit/20260612-consistency-research §Phase0)。
//   离线穷扫 gen1/gen2/gen3 + killed 好章基准,给每类 D1-D20 检测器一个逐章发率。免 LLM、确定性、只读。
//   用途: "先量发率再投资" 的依据表——容器漂移 0.3% 就是这么量出来"不值得建账本"的,这里覆盖全确定性类。
//   LLM-only 类(物件归属/状态复述/伏笔不收)由 consistency-judge(Opus subagent)另测,合并进同一张表。
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { lintSeams, auditContainerDrift } from "./lint-seams";

const OUT = join(process.cwd(), ".novel-output");
// 扫描目标: [数据目录, 标签]。gen3=活, gen1/gen2=归档, renjian-killed=钦点好章基准(误杀对照)。
function targets(): Array<[string, string]> {
  const t: Array<[string, string]> = [];
  const g1 = readdirSync(OUT).find((d) => d.startsWith("dukou-gen1-archived"));
  const g2 = readdirSync(OUT).find((d) => d.startsWith("dukou-gen2-archived"));
  const kl = readdirSync(OUT).find((d) => d.includes("renjian-killed"));
  if (g1) t.push([join(OUT, g1, "chapters"), "gen1"]);
  if (g2) t.push([join(OUT, g2, "chapters"), "gen2"]);
  t.push([join(OUT, "dukou", "chapters"), "gen3"]);
  if (kl) t.push([join(OUT, kl, "chapters"), "好章基准"]);
  return t.filter(([d]) => existsSync(d));
}

// 每类结构 bug → 一个判定函数(从 lintSeams 结果/auditContainerDrift 派生 0/1 命中)。
const CLASSES: Array<[string, (r: ReturnType<typeof lintSeams>, text: string) => boolean]> = [
  ["D1a时序倒流", (r) => r.flags.some((f) => f.startsWith("时序倒流"))],
  ["D1c套语对≥12", (r) => r.metrics.d1cPairs >= 12],
  ["D2/D8重复相遇", (r) => r.flags.some((f) => f.startsWith("重复相遇") || f.includes("重引") || f.includes("重新登场"))],
  ["D4/D9地理矛盾", (r) => r.flags.some((f) => f.startsWith("地理") || f.startsWith("地点重访") || f.includes("折返"))],
  ["D5量词冲突", (r) => r.flags.some((f) => f.includes("数量") || f.startsWith("量词"))],
  ["D7同物二卖", (r) => r.flags.some((f) => f.startsWith("同物二卖") || f.includes("二次成交"))],
  ["D11找零算术", (r) => r.flags.some((f) => f.includes("算术") || f.includes("找零") || f.includes("账目"))],
  ["D12事件签名", (r) => r.flags.some((f) => f.includes("事件") && f.includes("重复"))],
  ["D13整句复写(any·telemetry)", (r) => (r.metrics.d13Dups ?? 0) >= 1],
  ["D13整句复写(≥16·真bug层)", (r) => r.issues.some((f) => f.startsWith("整句原样复写"))],
  ["D17那X无先行", (r) => r.flags.some((f) => f.includes("无先行"))],
  ["D18名字漂移", (r) => r.issues.some((f) => f.includes("疑为") && f.includes("之误"))],
  ["D19同台词复写", (r) => r.issues.some((f) => f.startsWith("同台词"))],
  ["D20容器材质漂移", (_r, text) => auditContainerDrift(text).length > 0],
];

function scan(): void {
  const tg = targets();
  const labels = tg.map(([, l]) => l);
  const counts: Record<string, Record<string, number>> = {}; // class → label → hits
  const totals: Record<string, number> = {};
  for (const [, l] of tg) totals[l] = 0;
  for (const [cls] of CLASSES) { counts[cls] = {}; for (const [, l] of tg) counts[cls]![l] = 0; }

  for (const [dir, label] of tg) {
    const files = readdirSync(dir).filter((f) => /^ch-\d+\.md$/.test(f));
    totals[label] = files.length;
    for (const f of files) {
      const text = readFileSync(join(dir, f), "utf8");
      const title = (text.match(/^#\s*(.+)$/m)?.[1] ?? "").trim();
      const r = lintSeams(text, [], title); // names=[] : 发率基线不依赖花名册(D2/D18 会少报·标注于表注)
      for (const [cls, hit] of CLASSES) if (hit(r, text)) counts[cls]![label]!++;
    }
  }

  // 输出 markdown 表
  const pct = (n: number, d: number): string => (d ? ((100 * n) / d).toFixed(1) + "%" : "—");
  const head = ["结构类", ...labels.map((l) => `${l}(${totals[l]}章)`)].join(" | ");
  console.log("| " + head + " |");
  console.log("|" + "---|".repeat(labels.length + 1));
  for (const [cls] of CLASSES) {
    const row = [cls, ...labels.map((l) => `${counts[cls]![l]} (${pct(counts[cls]![l]!, totals[l]!)})`)];
    console.log("| " + row.join(" | ") + " |");
  }
  // 聚合发率(gen3 现役为准·决定投资档)
  console.log("\n聚合(gen3 现役):");
  for (const [cls] of CLASSES) {
    const g3 = counts[cls]!["gen3"] ?? 0; const t3 = totals["gen3"] ?? 1;
    const rate = (100 * g3) / t3;
    const tier = rate >= 3 ? "→P1候选(≥3%)" : rate >= 1 ? "→观察(1-3%)" : "→CLI分诊/免(<1%)";
    console.log(`  ${cls}: ${rate.toFixed(1)}% ${tier}`);
  }
  console.log("\n注: names=[] 扫描·D2/D18 依赖花名册的部分会少报(保守); 好章基准列=误杀对照(应全低); LLM-only类[物件归属/状态复述/伏笔不收]由 consistency-judge 另测合并。");
}

scan();
