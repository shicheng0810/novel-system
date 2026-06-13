// app/registry-lint.ts — P0-9 registry 自 lint + P1-7 残留件(声明对照)。零 LLM·零随机·只读源码与 registry, 绝不写任何文件。
// 蓝图 .audit/20260610-evolution-overhaul/synthesis.md §3.1 P0-9 / §3.2 P1-7(砍后残留件: 不搬权重读取路径, 只做声明对照报警)。
// CLI: npx tsx app/registry-lint.ts
//   ① schema 校验: signals 每行字段合法(name/reads/measures/consumers/pollution/fv) + 机械一致性(reads=revised⇒pollution=high; reads=draft⇒pollution=low)
//   ② 双计检测: 同 reads+semantic 标签出现于多行 = 同一语义被多 consumer 重复计分 → 【列报告·不动代码】(已知案 C11: 爽文 simFit.novelty × objFit.repetition·授权批)
//   ③ 声明对照: 从源码正则提取权重常数(warm-fitness total / sim-fitness total / evolve fitnessOf / objectiveScore / evolveOnce 三路 blend), 与 registry 声明 weight/_composites 比对 → 不一致 exit 1
// 退出码: schema 错或权重不一致 → 1; 否则 0(双计/三禁已知违例只列报告不阻断——蓝图已立案 P1-4/P0-6/§4.6)。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const APP = dirname(fileURLToPath(import.meta.url));

interface Row { name: string; reads: string; measures: string; consumers: string[]; pollution: string; fv: number; weight?: number; composite?: string; semantic?: string; note?: string }
interface Registry { fv: number; signals: Row[]; _composites?: { fitnessBlends?: Record<string, Record<string, number>>; warmTotalVariants?: Record<string, Record<string, number>> } & Record<string, unknown> }

const READS = new Set(["draft", "revised", "events", "snapshot", "file"]);
const MEASURES = new Set(["genome", "intervention", "mixed", "pipeline"]);
const POLLUTION = new Set(["high", "mid", "low"]);
const COMPOSITES = new Set(["warm.total", "sim.total", "fitnessOf", "objectiveScore"]);

const srcOf = (f: string): string => readFileSync(join(APP, f), "utf8");
const approx = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

// ── 提取器: signal name → 源码权重(在指定 composite 表达式里) ──
// warm.total 的源码变量名映射(weight=0 行断言【缺席】于 total 表达式)
const WARM_VARS: Record<string, string> = {
  "warm.var": "wVar", "warm.bond": "wBond", "warm.social": "wSocial", "warm.arc": "wArc",
  "warm.progress": "wProg", "warm.treadmill": "wTread", "warm.emerge": "wEmerge", "warm.breath": "wBreath", "warm.clean": "wClean",
};
const RUBRIC_VARS: Record<string, string> = {
  "critique.freshness": "freshness", "critique.pacing": "pacing", "critique.dialogue": "dialogue",
  "critique.hook": "hook", "critique.coherence": "coherence", "critique.character": "character",
};

function main(): void {
  const errs: string[] = [];   // → exit 1
  const infos: string[] = [];  // 双计/三禁 watch → 只报告
  let reg: Registry;
  try { reg = JSON.parse(readFileSync(join(APP, "signal-registry.json"), "utf8")) as Registry; }
  catch (e) { console.error(`registry 读取/解析失败: ${String(e).slice(0, 120)}`); process.exit(1); return; }

  // ── ① schema 校验 ──
  const seen = new Set<string>();
  if (!Array.isArray(reg.signals) || reg.signals.length === 0) errs.push("signals 缺失或为空");
  if (typeof reg.fv !== "number") errs.push("文件级 fv 缺失");
  for (const r of reg.signals ?? []) {
    const id = typeof r.name === "string" && r.name ? r.name : "(无名行)";
    if (id === "(无名行)") { errs.push("存在缺 name 的行"); continue; }
    if (seen.has(id)) errs.push(`${id}: name 重复`);
    seen.add(id);
    if (!READS.has(r.reads)) errs.push(`${id}: reads 非法「${r.reads}」(须 draft|revised|events|snapshot|file)`);
    if (!MEASURES.has(r.measures)) errs.push(`${id}: measures 非法「${r.measures}」(须 genome|intervention|mixed|pipeline)`);
    if (!POLLUTION.has(r.pollution)) errs.push(`${id}: pollution 非法「${r.pollution}」(须 high|mid|low)`);
    if (!Array.isArray(r.consumers) || r.consumers.length === 0 || r.consumers.some((c) => typeof c !== "string" || !c)) errs.push(`${id}: consumers 须为非空字符串数组`);
    if (typeof r.fv !== "number") errs.push(`${id}: fv 缺失或非数`);
    if (r.weight !== undefined && typeof r.weight !== "number") errs.push(`${id}: weight 非数`);
    if (r.weight !== undefined && !r.composite) errs.push(`${id}: 有 weight 必须声明 composite`);
    if (r.composite !== undefined && !COMPOSITES.has(r.composite)) errs.push(`${id}: composite 非法「${r.composite}」`);
    // 机械污染规则(按蓝图判): 读 revised=被干预层污染→必 high; 读 draft(修订前账)→必 low
    if (r.reads === "revised" && r.pollution !== "high") errs.push(`${id}: reads=revised ⇒ pollution 必须 high(实为 ${r.pollution})`);
    if (r.reads === "draft" && r.pollution !== "low") errs.push(`${id}: reads=draft ⇒ pollution 必须 low(实为 ${r.pollution})`);
    if ((r.reads === "events" || r.reads === "snapshot" || r.reads === "file") && r.pollution === "high") errs.push(`${id}: reads=${r.reads} 不应标 high(干预污染主路径是 revised prose)`);
  }
  // 三禁规则声明必须在头(_rules ≥3 条)
  const rules = (reg as unknown as { _rules?: string[] })._rules;
  if (!Array.isArray(rules) || rules.length < 3) errs.push("_rules 三禁规则缺失(须 ≥3 条: bestEngine/铁律停滞判/QD 沉积)");

  // ── ② 双计检测(semantic 分组·列报告不动代码) ──
  const bySem = new Map<string, Row[]>();
  for (const r of reg.signals ?? []) if (r.semantic) { const k = `${r.reads}|${r.semantic}`; (bySem.get(k) ?? bySem.set(k, []).get(k)!).push(r); }
  for (const [k, rows] of bySem) if (rows.length >= 2) {
    infos.push(`双计 [${k}]: ${rows.map((r) => `${r.name}(→${r.consumers[0] ?? ""})`).join(" × ")} —— 同语义在多 consumer 重复计分。蓝图裁决: 列报告·不动代码·进一次性授权批。`);
  }

  // ── 三禁已知违例 watch(信息项·蓝图已立案不阻断) ──
  for (const r of reg.signals ?? []) {
    if (r.pollution === "high" && r.consumers.join(",").match(/bestEngine|停滞|QD|沉积/)) {
      infos.push(`三禁watch: ${r.name}(high) 仍被 ${r.consumers.filter((c) => /bestEngine|停滞|QD|沉积/.test(c)).join("、")} 消费 —— 已立案(P1-4 换源/§4.6 bestEngine 退役/P0-6 EMA), 未修前如实登记。`);
    }
  }

  // ── ③ 声明对照(P1-7 残留件): 源码权重常数 vs registry 声明 ──
  const rowOf = (n: string): Row | undefined => (reg.signals ?? []).find((r) => r.name === n);
  const cmp = (name: string, declared: number | undefined, extracted: number | null, where: string): void => {
    if (extracted === null) { errs.push(`${where}: 源码提取失败(${name})——源码改了形状? 更新 registry-lint 提取器`); return; }
    if (declared === undefined) { errs.push(`${name}: registry 未声明 weight 但源码有 ${extracted}(${where})`); return; }
    if (!approx(Math.abs(declared), Math.abs(extracted))) errs.push(`${name}: 声明 ${declared} ≠ 源码 ${extracted}(${where})`);
  };
  const exprIn = (text: string, re: RegExp, what: string): string | null => {
    const m = text.match(re);
    if (!m || m[1] === undefined) { errs.push(`源码表达式定位失败: ${what}`); return null; }
    return m[1];
  };
  const coef = (expr: string, re: RegExp): number | null => { const m = expr.match(re); return m && m[1] !== undefined ? Number(m[1]) : null; };

  // (a) warm-fitness.ts total —— 现为 NOVEL_WCLEAN gate 双分支(P1-2 已就位默认关): 取 `const total = ...;` 全语句, 摘出全部 +(...).toFixed(2) 分支表达式;
  //     含 wClean 的分支 = wcleanOn 变体(对照 _composites.warmTotalVariants.wcleanOn), 其余 = 默认分支(对照各行 weight·weight=0 行须缺席)。gate 撤除(回单分支)亦兼容。
  const warmStmt = exprIn(srcOf("warm-fitness.ts"), /const total =([\s\S]+?);/, "warm-fitness total 语句");
  if (warmStmt !== null) {
    const branches = [...warmStmt.matchAll(/\+\((.+?)\)\.toFixed\(2\)/g)].map((m) => m[1]!).filter((e) => e !== undefined);
    if (branches.length < 1 || branches.length > 2) errs.push(`warm total 分支数 ${branches.length} 异常(期望 1-2)——源码形状变了? 更新提取器`);
    const defaultExpr = branches.find((e) => !/wClean\b/.test(e)) ?? null;
    const wcleanExpr = branches.find((e) => /wClean\b/.test(e)) ?? null;
    if (defaultExpr === null) errs.push("warm total 默认分支(不含 wClean)缺失");
    else {
      for (const [name, v] of Object.entries(WARM_VARS)) {
        const r = rowOf(name);
        if (!r) { errs.push(`registry 缺行: ${name}`); continue; }
        const present = new RegExp(`\\*\\s*${v}\\b`).test(defaultExpr);
        if ((r.weight ?? 0) === 0) { if (present) errs.push(`${name}: 声明 weight=0(不入默认 total) 但源码默认分支含 ${v}`); }
        else cmp(name, r.weight, coef(defaultExpr, new RegExp(`([\\d.]+)\\s*\\*\\s*${v}\\b`)), "warm.total默认分支");
      }
    }
    const wcDecl = reg._composites?.warmTotalVariants?.["wcleanOn"];
    if (wcleanExpr !== null && !wcDecl) errs.push("源码有 NOVEL_WCLEAN 分支但 registry 未声明 _composites.warmTotalVariants.wcleanOn");
    if (wcleanExpr === null && wcDecl) errs.push("registry 声明了 warmTotalVariants.wcleanOn 但源码无该分支(已撤除? 同步删声明)");
    if (wcleanExpr !== null && wcDecl) {
      const shortToVar: Record<string, string> = { var: "wVar", bond: "wBond", social: "wSocial", arc: "wArc", progress: "wProg", treadmill: "wTread", emerge: "wEmerge", breath: "wBreath", clean: "wClean" };
      for (const [k, dv] of Object.entries(wcDecl)) {
        const v = shortToVar[k];
        if (!v) { errs.push(`warmTotalVariants.wcleanOn.${k}: 未知键`); continue; }
        cmp(`warmTotalVariants.wcleanOn.${k}`, dv, coef(wcleanExpr, new RegExp(`([\\d.]+)\\s*\\*\\s*${v}\\b`)), "warm.total wcleanOn分支");
      }
      for (const [k, v] of Object.entries(shortToVar)) if (!(k in wcDecl) && new RegExp(`\\*\\s*${v}\\b`).test(wcleanExpr)) errs.push(`warm.total wcleanOn 分支含 ${v} 但 warmTotalVariants.wcleanOn 未声明 ${k}`);
    }
  }
  // (b) sim-fitness.ts total
  const simExpr = exprIn(srcOf("sim-fitness.ts"), /let total = \+\((.+?)\)\.toFixed\(2\)/, "sim-fitness total");
  if (simExpr !== null) {
    cmp("simFit.sift", rowOf("simFit.sift")?.weight, coef(simExpr, /([\d.]+)\s*\*\s*siftScore/), "sim.total");
    cmp("simFit.tension", rowOf("simFit.tension")?.weight, coef(simExpr, /([\d.]+)\s*\*\s*tension\.score/), "sim.total");
    cmp("simFit.novelty", rowOf("simFit.novelty")?.weight, coef(simExpr, /([\d.]+)\s*\*\s*\(novelty/), "sim.total");
  }
  // (c) evolve.ts fitnessOf + objectiveScore + 三路 blend
  const evolveSrc = srcOf("evolve.ts");
  const foExpr = exprIn(evolveSrc, /export function fitnessOf[\s\S]{0,300}?return \+\((.+?)\)\.toFixed\(2\)/, "evolve fitnessOf");
  if (foExpr !== null) {
    for (const [name, v] of Object.entries(RUBRIC_VARS)) cmp(name, rowOf(name)?.weight, coef(foExpr, new RegExp(`r\\.${v}\\s*\\*\\s*([\\d.]+)`)), "fitnessOf");
  }
  const objExpr = exprIn(evolveSrc, /return Math\.max\(0, \+\((.+?)\)\.toFixed\(2\)\)/, "evolve objectiveScore");
  if (objExpr !== null) {
    cmp("objFit.repetition", rowOf("objFit.repetition")?.weight, coef(objExpr, /([\d.]+)\s*\*\s*repScore/), "objectiveScore");
    cmp("objFit.ttr", rowOf("objFit.ttr")?.weight, coef(objExpr, /([\d.]+)\s*\*\s*ttrScore/), "objectiveScore");
    cmp("objFit.dialogueRatio", rowOf("objFit.dialogueRatio")?.weight, coef(objExpr, /([\d.]+)\s*\*\s*dlgScore/), "objectiveScore");
    cmp("objFit.avoidHits", rowOf("objFit.avoidHits")?.weight, coef(evolveSrc, /m\.avoidHits\s*\*\s*([\d.]+)/), "objectiveScore惩罚系数");
  }
  // (d) evolveOnce 三路 fitness blend vs _composites.fitnessBlends
  const blends = reg._composites?.fitnessBlends;
  if (!blends) errs.push("_composites.fitnessBlends 缺失(三路 blend 声明)");
  else {
    const lines = evolveSrc.split("\n").filter((l) => /\*\s*llmFit/.test(l));
    if (lines.length !== 3) errs.push(`evolve.ts blend 行数 ${lines.length} ≠ 3(源码形状变了? 更新提取器)`);
    for (const line of lines) {
      const got = {
        llm: coef(line, /([\d.]+)\s*\*\s*llmFit/), obj: coef(line, /([\d.]+)\s*\*\s*objFit/), cons: coef(line, /([\d.]+)\s*\*\s*consFit/),
        sim: coef(line, /([\d.]+)\s*\*\s*simFit/), warm: coef(line, /([\d.]+)\s*\*\s*wf\.total/),
      };
      const key = got.sim !== null ? "shuang_simFit" : got.warm !== null ? "gentle_warmFit" : "fallback_noSim";
      const dec = blends[key];
      if (!dec) { errs.push(`blend ${key}: registry 未声明`); continue; }
      for (const [k, dv] of Object.entries(dec)) {
        const gv = (got as Record<string, number | null>)[k];
        if (gv === null || gv === undefined) errs.push(`blend ${key}.${k}: 声明 ${dv} 但源码该行未提取到`);
        else if (!approx(dv, gv)) errs.push(`blend ${key}.${k}: 声明 ${dv} ≠ 源码 ${gv}`);
      }
    }
  }

  // ── 人读报告 ──
  const n = (reg.signals ?? []).length;
  const cnt = (p: string): number => (reg.signals ?? []).filter((r) => r.pollution === p).length;
  console.log("══ signal-registry lint ══");
  console.log(`登记 ${n} 行 · pollution: high=${cnt("high")} mid=${cnt("mid")} low=${cnt("low")} · fv=${reg.fv}`);
  console.log(`声明对照: warm.total(9路) + sim.total(3路) + fitnessOf(6路) + objectiveScore(4路) + fitnessBlends(3行)`);
  if (infos.length) { console.log(`\n— 报告项(不阻断·${infos.length} 条) —`); for (const i of infos) console.log("  · " + i); }
  if (errs.length) {
    console.log(`\n✗ 报警 ${errs.length} 条(schema/声明不一致 → exit 1):`);
    for (const e of errs) console.log("  ✗ " + e);
    process.exit(1);
  }
  console.log("\n✓ schema 合法 · 声明与源码一致 · 零报警");
}

main();
