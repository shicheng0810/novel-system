// 症⑤拼接病 5 检测器原型 · 零 LLM 确定性。用法: npx tsx /tmp/lint5.ts verbose <files...> | corpus <dirs...>
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const CJK = /[一-龥]/;
type Para = { t: string; n: string; off: number }; // t=原文 n=去对白叙述
function getParas(body: string): Para[] {
  const out: Para[] = []; let cur = 0;
  for (const raw of body.split(/\n\n+/)) {
    const t = raw.trim(); if (!t) { cur += raw.length + 2; continue; }
    const i = body.indexOf(raw, cur); out.push({ t, n: t.replace(/“[^”]*”?/g, ""), off: i }); cur = i + raw.length;
  }
  return out;
}
const sentencesOf = (s: string) => s.split(/(?<=[。！？；\n])/).filter(Boolean);

// ── D1a 时序倒流(同日时辰只进不退; 倒退=场景重开) ──
const SLOTS: Array<[RegExp, number, string]> = [
  [/天将明|将明未明|天蒙蒙亮|蒙蒙亮|拂晓|破晓|晨雾|清晨|大清早|五更|鸡叫|鸡鸣|天才亮|天刚亮/, 0, "拂晓"],
  [/雾散(?!不)|日光照|第一线日光|天光大亮|早饭|辰时|日头初升|朝阳|一大早/, 1, "上午"],
  [/晌午|正午|日头当顶|午时|午饭|晌饭/, 2, "正午"],
  [/日头偏西|日头西斜|过午|未时|申时|下晌/, 3, "午后"],
  [/黄昏|傍晚|日落|暮色|擦黑|天色暗|夕阳|落日/, 4, "黄昏"],
  [/入夜|夜里|天黑|月上|深夜|半夜|夜路|掌灯|夜深|更深|下半夜/, 5, "夜"],
];
const DAYADV = /次日|翌日|第二天|第二日|转天|隔日|过了[一两三几]?[日天]|又一日|一觉|睡下|睡去|歇下|当夜|一宿|隔天/;
const MEMORY = /想起|记得|那天|那日|那夜|当年|小时候|从前|昔日|梦|平日|往常|每[日天逢]|惯常|昨|前夜|比[^。，]{0,4}(夜|晨|晌|暮|白天)|的时候|时分/;
function d1aClock(paras: Para[], len: number) {
  const evs: { slot: number; off: number; estab: boolean; snip: string }[] = []; const hits: string[] = [];
  let advAt: number[] = [];
  for (const p of paras) {
    let so = 0;
    for (const sent of sentencesOf(p.n)) {
      if (DAYADV.test(sent)) advAt.push(p.off + so);
      if (!MEMORY.test(sent)) {
        let best: { slot: number; off: number; estab: boolean; snip: string } | null = null;
        for (const [re, slot] of SLOTS) {
          const m = sent.match(re);
          if (m) {
            const inSentOff = sent.indexOf(m[0]);
            if (sent[inSentOff + m[0].length] === "的") continue; // 「夜里的潮气/清晨的味道」=定语指涉非当下时刻
            if (!best || slot > best.slot) best = { slot, off: p.off + so + inSentOff, estab: so + inSentOff <= 25, snip: sent.trim().slice(0, 30) };
          }
        }
        if (best) evs.push(best); // 一句只取最高时辰(「晨雾散得差不多」=已散为准, 非拂晓重立)
      }
      so += sent.length;
    }
  }
  let maxSlot = -1, maxSnip = "", maxOff = 0;
  for (const e of evs) {
    if (advAt.some((a) => a > maxOff && a < e.off)) { maxSlot = -1; } // 跨日重置
    if (maxSlot >= 4 && e.slot < maxSlot) { maxSlot = -1; } // 黄昏/夜→任何更早时辰 = 过夜省略(中文叙事常无「次日」标记), 合法回绕
    if (e.slot === 0 && maxSlot >= 1 && e.estab && e.off - maxOff > 60) hits.push(`时序倒流: [${maxSnip}](@${(maxOff / len * 100) | 0}%) 之后又回到 [${e.snip}](@${(e.off / len * 100) | 0}%)`);
    if (e.slot >= maxSlot) { maxSlot = e.slot; maxSnip = e.snip; maxOff = e.off; }
  }
  return { hits, evs: evs.map((e) => `${e.slot}@${(e.off / len * 100) | 0}%${e.estab ? "*" : ""}:${e.snip.slice(0, 12)}`) };
}

// ── D1c 远距叙述段共享稀有三元组(场景复写) ──
function d1cRareTri(paras: Para[], len: number, minShared = 3, gate = 0.28) {
  const freq = new Map<string, number>();
  const tris = paras.map((p) => {
    const cs = [...p.n].filter((c) => CJK.test(c)).join(""); const s = new Set<string>();
    for (let i = 0; i + 3 <= cs.length; i++) s.add(cs.slice(i, i + 3));
    s.forEach((t) => freq.set(t, (freq.get(t) ?? 0) + 1)); return s;
  });
  const hits: string[] = [];
  for (let i = 0; i < paras.length; i++) for (let j = i + 1; j < paras.length; j++) {
    if (paras[j].off - paras[i].off < gate * len) continue;
    const shared = [...tris[i]].filter((t) => tris[j].has(t) && (freq.get(t) ?? 9) <= 3);
    if (shared.length >= minShared) hits.push(`场景复写: 段@${(paras[i].off / len * 100) | 0}%「${paras[i].t.slice(0, 18)}…」与段@${(paras[j].off / len * 100) | 0}%「${paras[j].t.slice(0, 18)}…」共享稀有词 ${shared.slice(0, 5).join("/")}`);
  }
  return hits;
}

// ── D2 重复相遇(同一人多次"初遇式"登场而其间无离场) ──
const DEPART = /(走远|渐渐远|越走越远|远去|不见了|告辞|道别|各自|分头|先走了|送[他她]?出|往[^。，]{1,5}拐|拐过[^。]{0,10}不见|转身往[^。]{1,8}[去走]|看[他她]走远|脚步声[^。]{0,12}远|背影[^。]{0,10}(远|淡|没))/;
function d2Meet(paras: Para[], names: string[], len: number) {
  const hits: string[] = []; const detail: string[] = [];
  for (const name of names) {
    const beats: { idx: number; off: number; why: string }[] = [];
    for (let i = 0; i < paras.length; i++) {
      const win = paras[i].n + (paras[i + 1]?.n ? "\n" + paras[i + 1].n : "") + (paras[i + 2]?.n ? "\n" + paras[i + 2].n : "");
      if (!win.includes(name)) continue;
      let why = "";
      if (new RegExp(`(有人|来人|那人|一个人|人影|身影|背影)[^]{0,90}?(是${name}(?=[。，！？”\\s])|${name}的声音|看身形)`).test(win)) why = "现身揭示";
      else if (new RegExp(`(有人|来人|那人|人影|身影|背影)[^]{0,90}?\\n${name}[。，]`).test(win)) why = "独段揭示";
      else if (new RegExp(`${name}[^。！？]{0,22}(跟出来|转出来|追上来|迎上来)`).test(win)) why = "现身动词";
      else if (new RegExp(`(门外|外头|门口)站着${name}`).test(win)) why = "门外站着";
      if (why) beats.push({ idx: i, off: paras[i].off, why });
    }
    // 合并相邻(≤1段)重叠命中
    const merged = beats.filter((b, k) => k === 0 || b.idx - beats[k - 1].idx > 1);
    if (merged.length >= 2) detail.push(`${name}:登场拍×${merged.length}@[${merged.map((b) => ((b.off / len * 100) | 0) + "%" + b.why).join(",")}]`);
    for (let k = 1; k < merged.length; k++) {
      const between = paras.slice(merged[k - 1].idx + 2, merged[k].idx).map((p) => p.n).join("\n");
      if (!DEPART.test(between)) hits.push(`重复相遇: ${name} 在@${(merged[k - 1].off / len * 100) | 0}%(${merged[k - 1].why})已登场, 其间无离场, @${(merged[k].off / len * 100) | 0}%又一次${merged[k].why}`);
    }
  }
  return { hits, detail };
}

// ── D3 单物过劳(开放词表: 高频名词+触碰动词+冗余复查率) ──
const TOUCH = /按|摸|碰|提了|提着|拽|压|搁|揣|捏|攥|握|拈|抚|托|扣上|系|拍|掂|捡|挎|挪|擦|敲|叩/;
const RECHECK = /又|再|还是?|第[二三四五]次|这次|没松|还松|不松|没紧|照旧|依旧|仍/;
function d3Prop(body: string, names: string[], title: string) {
  const cs = [...body].filter((c) => CJK.test(c)).join("");
  const freq = new Map<string, number>();
  for (let i = 0; i + 2 <= cs.length; i++) { const g = cs.slice(i, i + 2); freq.set(g, (freq.get(g) ?? 0) + 1); }
  const out: { tok: string; freq: number; touch: number; recheck: number; verbs: string[] }[] = [];
  for (const [g, f] of freq) {
    if (f < 6) continue;
    if (names.some((n) => n.includes(g) || g.includes(n))) continue;
    if (/[了的是着他她在不没一这那把都又]/.test(g)) continue; // 功能字噪声
    if (/^(怀里|手里|身上|肩上|脚边|桌上|台上|地上|篓里|箱里|起来|出来|过来|下来|上来)$/.test(g)) continue; // 方位/趋向词非道具
    let touch = 0, recheck = 0; const verbs = new Set<string>();
    let idx = -1;
    while ((idx = body.indexOf(g, idx + 1)) >= 0) {
      const win = body.slice(Math.max(0, idx - 12), idx + g.length + 12);
      const tv = win.match(new RegExp(TOUCH.source, "g"));
      if (tv) { touch++; tv.forEach((v) => verbs.add(v)); }
      if (RECHECK.test(win)) recheck++;
    }
    if (touch >= 4) out.push({ tok: g, freq: f, touch, recheck, verbs: [...verbs] });
  }
  out.sort((a, b) => b.recheck - a.recheck);
  const hits = out.filter((o) => o.freq >= 8 && o.touch >= 6 && o.recheck >= 5 && o.recheck / o.freq >= 0.55 && !title.includes(o.tok)).map((o) => `单物过劳: 「${o.tok}」×${o.freq}, 伴触碰${o.touch}次(动词:${o.verbs.join("")}), 冗余复查拍${o.recheck}次(复查率${(o.recheck / o.freq).toFixed(2)})`);
  return { hits, table: out.slice(0, 6).map((o) => `${o.tok}:freq${o.freq}/touch${o.touch}/recheck${o.recheck}/率${(o.recheck / o.freq).toFixed(2)}`) };
}

// ── D4 地理矛盾(开篇离开X·后文又往X且无回返词) ──
function d4Geo(body: string, len: number) {
  const hits: string[] = [];
  const places = new Set<string>();
  for (const m of body.matchAll(/[一-龥]{1,3}(?:驿|镇|城|村|寺|观|渡|庄|堂|府|谷|崖)/g)) places.add(m[0]);
  for (const pl of places) {
    const dep = body.match(new RegExp(`(出了${pl}|离了${pl}|${pl}外|回头望[^。]{0,14}${pl}|${pl}[^。]{0,16}渐渐[淡远])`));
    if (!dep || dep.index === undefined || dep.index > len * 0.4) continue;
    for (const go of body.matchAll(new RegExp(`(?:[去往奔])[^。，]{0,2}${pl}|往哪[儿里]?去[^]{0,30}?${pl}`, "g"))) {
      if (go.index === undefined || go.index - dep.index < 0.25 * len) continue;
      const ctx = body.slice(Math.max(0, go.index - 10), go.index + go[0].length + 10);
      if (!/[回返折]/.test(ctx)) hits.push(`地理矛盾: @${(dep.index / len * 100) | 0}%已离开「${pl}」(${dep[0].slice(0, 14)}), @${(go.index / len * 100) | 0}%却「${ctx.replace(/\s/g, "").slice(0, 20)}」且无回返词`);
    }
  }
  return hits;
}

// ── D5 数量词冲突(同段同名词 双/对 vs 只 数目不合) + 标题具象名词缺位 ──
const NUM: Record<string, number> = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
function d5Title(title: string, paras: Para[]) {
  const hits: string[] = [];
  for (const p of paras) {
    const found = new Map<string, Set<string>>(); // noun -> set of "等效只数"
    for (const m of p.t.matchAll(/([一两二三四五六七八九十])(双|对|只)([一-龥])/g)) {
      if (/[手脚眼耳腿臂膀]/.test(m[3])) continue; // 身体部位计数天然多变, 不比
      const n = NUM[m[1]] * (m[2] === "只" ? 1 : 2);
      if (!found.has(m[3])) found.set(m[3], new Set());
      found.get(m[3])!.add(`${n}:${m[2]}:${m[0]}`);
    }
    for (const [noun, set] of found) {
      const arr = [...set].map((s) => s.split(":"));
      const pairCls = arr.filter((a) => /[双对]/.test(a[1])), unitCls = arr.filter((a) => a[1] === "只");
      // 仅跨量词(双/对 vs 只)换算冲突才报; 同量词不同数=点数不同物, 合法
      if (pairCls.length && unitCls.length && pairCls.some((a) => unitCls.every((b) => a[0] !== b[0])))
        hits.push(`数量词冲突: 同段「${noun}」前后不合: ${arr.map((a) => a[2]).join(" vs ")}`);
    }
  }
  // 标题具象名词在正文缺位
  const tnouns = [...title.matchAll(/[一-龥]/g)].map((m) => m[0]);
  const body = paras.map((p) => p.t).join("");
  const missing = [...new Set(tnouns)].filter((c) => /[鞋灯碗粥茶饼伞篓箱鱼糖叶花雾雪雨桥船碑祠]/.test(c) && !body.includes(c));
  if (missing.length) hits.push(`标题名词缺位: 标题含「${missing.join("、")}」正文未出现`);
  return hits;
}

// ── D6(bonus) 指令式市井堆(行当名词种类数·单次掠过比) ──
const TRADES = /货郎|铁匠|篾匠|木匠|石匠|皮匠|鞋匠|染坊|布庄|当铺|盐铺|粥铺|药铺|酱菜铺|咸菜铺|酒肆|茶肆|肉铺|鱼贩|菜贩|小贩|挑夫|脚夫|船家|艄公|轿夫|更夫|屠户|卖炭|卖糖|卖菇|卖鱼|卖菜|卖花|炸油糕|糖人|施粥|跑堂|掌柜|店家|伙计|学徒|鱼摊|绸缎庄/g;
function d6Trades(body: string) {
  const cnt = new Map<string, number>();
  for (const m of body.matchAll(TRADES)) cnt.set(m[0], (cnt.get(m[0]) ?? 0) + 1);
  const single = [...cnt.entries()].filter(([, c]) => c === 1).map(([t]) => t);
  const hits = cnt.size >= 8 && single.length >= 6 ? [`指令式市井堆: 行当/摊贩 ${cnt.size} 种(${[...cnt.keys()].join("、")}), 其中 ${single.length} 种只掠过一次`] : [];
  return { hits, stat: `行当${cnt.size}种/单次${single.length}` };
}

function run(file: string, names: string[], verbose: boolean) {
  const raw = readFileSync(file, "utf8");
  const title = (raw.match(/^#\s*(.+)$/m)?.[1] ?? "").replace(/^第[^章]*章\s*/, "");
  const body = raw.replace(/^#.*$/m, "").trim();
  const len = body.length;
  const paras = getParas(body);
  const a = d1aClock(paras, len), c = d1cRareTri(paras, len), m = d2Meet(paras, names, len), p3 = d3Prop(body, names, title), g = d4Geo(body, len), t5 = d5Title(title, paras), t6 = d6Trades(body);
  const cFlag = c.length >= 6 ? [`套语复写成片: 远距段间逐字套语对 ${c.length} 处(阈值6)`] : [];
  const all = [...a.hits, ...cFlag, ...m.hits, ...p3.hits, ...g, ...t5, ...t6.hits];
  if (verbose) {
    console.log(`\n========== ${file.split("/").slice(-3).join("/")} 《${title}》 ${len}字 ${paras.length}段`);
    console.log(`D1a时序事件: ${a.evs.join(" | ") || "无"}`);
    console.log(`D1c套语对=${c.length}: ${c.map((h) => h.slice(5, 60)).join(" ;; ") || "无"}`);
    console.log(`D2登场拍: ${m.detail.join(" ; ") || "无"}`);
    console.log(`D3道具表: ${p3.table.join(" ; ") || "无"}`);
    console.log(`D6行当: ${t6.stat}`);
    for (const h of all) console.log(`  ⚑ ${h}`);
    if (!all.length) console.log("  (全部静默)");
  } else if (all.length) {
    console.log(`${file.split("/").slice(-3, -2)}/${file.split("/").pop()} 《${title}》`);
    for (const h of all) console.log(`   ⚑ ${h}`);
  }
  d1cCounts.push(c.length);
  return all.length;
}
const d1cCounts: number[] = [];

const namesOf = (chapterFile: string): string[] => {
  const canonPath = join(dirname(dirname(chapterFile)), "canon.json");
  if (!existsSync(canonPath)) return [];
  try { return Object.keys(JSON.parse(readFileSync(canonPath, "utf8")).characters ?? {}); } catch { return []; }
};

const [mode, ...args] = process.argv.slice(2);
if (mode === "verbose") for (const f of args) run(f, namesOf(f), true);
else { // corpus <chapterDirs...>
  let flagged = 0, total = 0;
  for (const dir of args) for (const f of readdirSync(dir).filter((x) => x.endsWith(".md")).sort()) {
    total++; if (run(join(dir, f), namesOf(join(dir, f)), false) > 0) flagged++;
  }
  console.log(`\n== corpus: ${flagged}/${total} 章被任一检测器标记`);
  const s = [...d1cCounts].sort((a, b) => a - b);
  const pct = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  console.log(`== D1c套语对分布: p50=${pct(0.5)} p75=${pct(0.75)} p90=${pct(0.9)} p95=${pct(0.95)} max=${s[s.length - 1]} | ≥6:${s.filter((x) => x >= 6).length} ≥9:${s.filter((x) => x >= 9).length} ≥12:${s.filter((x) => x >= 12).length}`);
}
