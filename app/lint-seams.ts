// app/lint-seams.ts — 症⑤多段拼接病检测器(零 LLM·确定性·仅 GENTLE edit-pass 路径调用)。
// 依据 .audit/20260609-stitching/synthesis.md: writeChapter 无状态分段流水线致段间互盲(两次离驿/三次初遇/地理折返/标题幻想/单物 12 触)。
// 治本在生成端(跨段已写账·已落地); 本模块只兜底探测+趋势度量。**分流纪律(修法5裁决)**:
//   - issues(进 revise directives·表层可修·三道闸兼容): D3 单物过劳 / D6 指令式市井堆 / D1c≥8 套语对(top3 拆套语)
//   - flags(只记日志·结构病 revise 救不了——重复块占全章 19-30% 与 0.85 长度地板互斥): D1a 时序倒流 / D2 重复相遇 / D4 地理矛盾 / D5 数量词冲突 / D1c≥12 重灾
// 阈值按 257 章语料校准(corpus-scan.txt): ch-0123 五症全命中 / ch-0104 双维干净全静默 / 硬 flag 语料误杀=0。无随机无时钟, resume 安全。
const CJK = /[一-龥]/;
type Para = { t: string; n: string; off: number }; // t=原文 n=去对白叙述

export interface SeamResult {
  issues: string[]; // 进 revise directives(含显式删除授权)
  flags: string[];  // 只记日志(结构病·治本=生成端跨段已写账)
  metrics: { d1cPairs: number; d2Meets: number; d3Props: string[]; tradeKinds: number; tradeReps: number; d13Dups?: number };
}

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
const SLOTS: Array<[RegExp, number]> = [
  [/天将明|将明未明|天蒙蒙亮|蒙蒙亮|拂晓|破晓|晨雾|清晨|大清早|五更|鸡叫|鸡鸣|天才亮|天刚亮/, 0],
  [/雾散(?!不)|日光照|第一线日光|天光大亮|早饭|辰时|日头初升|朝阳|一大早/, 1],
  [/晌午|正午|日头当顶|午时|午饭|晌饭/, 2],
  [/日头偏西|日头西斜|过午|未时|申时|下晌/, 3],
  [/黄昏|傍晚|日落|暮色|擦黑|天色暗|夕阳|落日/, 4],
  [/入夜|夜里|天黑|月上|深夜|半夜|夜路|掌灯|夜深|更深|下半夜/, 5],
];
const DAYADV = /次日|翌日|第二天|第二日|转天|隔日|过了[一两三几]?[日天]|又一日|一觉|睡下|睡去|歇下|当夜|一宿|隔天/;
const MEMORY = /想起|记得|那天|那日|那夜|当年|小时候|从前|昔日|梦|平日|往常|每[日天逢]|惯常|昨|前夜|比[^。，]{0,4}(夜|晨|晌|暮|白天)|的时候|时分/;
function d1aClock(paras: Para[], len: number): string[] {
  const evs: { slot: number; off: number; estab: boolean; snip: string }[] = []; const hits: string[] = [];
  const advAt: number[] = [];
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
            if (sent[inSentOff + m[0].length] === "的") continue; // 「夜里的潮气」=定语非当下时刻
            if (!best || slot > best.slot) best = { slot, off: p.off + so + inSentOff, estab: so + inSentOff <= 25, snip: sent.trim().slice(0, 30) };
          }
        }
        if (best) evs.push(best); // 一句只取最高时辰
      }
      so += sent.length;
    }
  }
  let maxSlot = -1, maxSnip = "", maxOff = 0;
  for (const e of evs) {
    if (advAt.some((a) => a > maxOff && a < e.off)) maxSlot = -1; // 跨日重置
    if (maxSlot >= 4 && e.slot < maxSlot) maxSlot = -1; // 黄昏/夜后回绕=过夜省略, 合法
    if (e.slot === 0 && maxSlot >= 1 && e.estab && e.off - maxOff > 60) hits.push(`时序倒流: [${maxSnip}](@${(maxOff / len * 100) | 0}%) 之后又回到 [${e.snip}](@${(e.off / len * 100) | 0}%)`);
    if (e.slot >= maxSlot) { maxSlot = e.slot; maxSnip = e.snip; maxOff = e.off; }
  }
  return hits;
}

// ── D1c 远距叙述段共享稀有三元组(场景复写/套语对·兼任修法1疗效趋势指标) ──
function d1cRareTri(paras: Para[], len: number, minShared = 3, gate = 0.28): string[] {
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
    if (shared.length >= minShared) hits.push(`段@${(paras[i].off / len * 100) | 0}%「${paras[i].t.slice(0, 18)}…」与段@${(paras[j].off / len * 100) | 0}%「${paras[j].t.slice(0, 18)}…」共享稀有词 ${shared.slice(0, 5).join("/")}`);
  }
  return hits;
}

// ── D2 重复相遇(同一人多次"初遇式"登场而其间无离场) ──
const DEPART = /(走远|渐渐远|越走越远|远去|不见了|告辞|道别|各自|分头|先走了|送[他她]?出|往[^。，]{1,5}拐|拐过[^。]{0,10}不见|转身往[^。]{1,8}[去走]|看[他她]走远|脚步声[^。]{0,12}远|背影[^。]{0,10}(远|淡|没))/;
function d2Meet(paras: Para[], names: string[], len: number): { hits: string[]; meets: number } {
  const hits: string[] = []; let meets = 0;
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
    const merged = beats.filter((b, k) => k === 0 || b.idx - beats[k - 1].idx > 1); // 合并相邻(≤1段)重叠命中
    for (let k = 1; k < merged.length; k++) {
      const between = paras.slice(merged[k - 1].idx + 2, merged[k].idx).map((p) => p.n).join("\n");
      if (!DEPART.test(between)) { meets++; hits.push(`重复相遇: ${name} 在@${(merged[k - 1].off / len * 100) | 0}%(${merged[k - 1].why})已登场, 其间无离场, @${(merged[k].off / len * 100) | 0}%又一次${merged[k].why}`); }
    }
  }
  return { hits, meets };
}

// ── D3 单物过劳(开放词表: 高频名词+触碰动词+冗余复查率·不依赖 STATIC_IMG) ──
const TOUCH = /按|摸|碰|提了|提着|拽|压|搁|揣|捏|攥|握|拈|抚|托|扣上|系|拍|掂|捡|挎|挪|擦|敲|叩/;
const RECHECK = /又|再|还是?|第[二三四五]次|这次|没松|还松|不松|没紧|照旧|依旧|仍/;
function d3Prop(body: string, names: string[], title: string): { hits: string[]; props: string[] } {
  const cs = [...body].filter((c) => CJK.test(c)).join("");
  const freq = new Map<string, number>();
  for (let i = 0; i + 2 <= cs.length; i++) { const g = cs.slice(i, i + 2); freq.set(g, (freq.get(g) ?? 0) + 1); }
  const out: { tok: string; freq: number; touch: number; recheck: number }[] = [];
  for (const [g, f] of freq) {
    if (f < 6) continue;
    if (names.some((n) => n.includes(g) || g.includes(n))) continue;
    if (/[了的是着他她在不没一这那把都又]/.test(g)) continue; // 功能字噪声
    if (/^(怀里|手里|身上|肩上|脚边|桌上|台上|地上|篓里|箱里|起来|出来|过来|下来|上来)$/.test(g)) continue; // 方位/趋向词非道具
    let touch = 0, recheck = 0;
    let idx = -1;
    while ((idx = body.indexOf(g, idx + 1)) >= 0) {
      const win = body.slice(Math.max(0, idx - 12), idx + g.length + 12);
      if (TOUCH.test(win)) touch++;
      if (RECHECK.test(win)) recheck++;
    }
    if (touch >= 4) out.push({ tok: g, freq: f, touch, recheck });
  }
  out.sort((a, b) => b.recheck - a.recheck);
  const hits = out.filter((o) => o.freq >= 8 && o.touch >= 6 && o.recheck >= 5 && o.recheck / o.freq >= 0.55 && !title.includes(o.tok))
    .map((o) => `单物过劳(「${o.tok}」全章被摸/按/把玩 ${o.touch} 次、其中 ${o.recheck} 次是"又/再/还"式冗余复查拍——同一件物反复确认是拼接病余痕): 全章只保留两三处最有分量的触碰, 其余删去(授权删除围绕「${o.tok}」的冗余动作句, 不动对白与情节)。`);
  return { hits, props: out.slice(0, 4).map((o) => `${o.tok}:${o.freq}/${o.touch}/${o.recheck}`) };
}

// ── D4 地理矛盾(开篇离开X·后文又往X且无回返词) ──
function d4Geo(body: string, len: number): string[] {
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

// ── D5 数量词换算冲突(同段同名词 双/对 vs 只 数目不合)+标题具象名词缺位(只记 info) ──
const NUM: Record<string, number> = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
function d5Title(title: string, paras: Para[]): string[] {
  const hits: string[] = [];
  for (const p of paras) {
    const found = new Map<string, Set<string>>();
    for (const m of p.t.matchAll(/([一两二三四五六七八九十])(双|对|只)([一-龥])/g)) {
      if (/[手脚眼耳腿臂膀]/.test(m[3])) continue; // 身体部位计数天然多变
      const n = NUM[m[1]] * (m[2] === "只" ? 1 : 2);
      if (!found.has(m[3])) found.set(m[3], new Set());
      found.get(m[3])!.add(`${n}:${m[2]}:${m[0]}`);
    }
    for (const [noun, set] of found) {
      const arr = [...set].map((s) => s.split(":"));
      const pairCls = arr.filter((a) => /[双对]/.test(a[1])), unitCls = arr.filter((a) => a[1] === "只");
      if (pairCls.length && unitCls.length && pairCls.some((a) => unitCls.every((b) => a[0] !== b[0])))
        hits.push(`数量词冲突: 同段「${noun}」前后不合: ${arr.map((a) => a[2]).join(" vs ")}`);
    }
  }
  const tnouns = [...title.matchAll(/[一-龥]/g)].map((m) => m[0]);
  const body = paras.map((p) => p.t).join("");
  const missing = [...new Set(tnouns)].filter((c) => /[鞋灯碗粥茶饼伞篓箱鱼糖叶花雾雪雨桥船碑祠]/.test(c) && !body.includes(c));
  if (missing.length) hits.push(`标题名词缺位: 标题含「${missing.join("、")}」正文未出现`);
  return hits;
}

// ── D6 指令式市井堆(行当名词种类数·单次掠过比) ──
const TRADES = /货郎|铁匠|篾匠|木匠|石匠|皮匠|鞋匠|染坊|布庄|当铺|盐铺|粥铺|药铺|酱菜铺|咸菜铺|酒肆|茶肆|肉铺|鱼贩|菜贩|小贩|挑夫|脚夫|船家|艄公|轿夫|更夫|屠户|卖炭|卖糖|卖菇|卖鱼|卖菜|卖花|炸油糕|糖人|施粥|跑堂|掌柜|店家|伙计|学徒|鱼摊|绸缎庄/g;
function d6Trades(body: string): { hits: string[]; kinds: number } {
  const cnt = new Map<string, number>();
  for (const m of body.matchAll(TRADES)) cnt.set(m[0], (cnt.get(m[0]) ?? 0) + 1);
  const single = [...cnt.entries()].filter(([, c]) => c === 1).map(([t]) => t);
  const hits = cnt.size >= 10 && single.length >= 6
    ? [`指令式市井堆(行当/摊贩 ${cnt.size} 种、其中 ${single.length} 种只掠过一镜——像在执行"写出市井气息"指令): 砍掉一半只出现一次的背景摊贩, 留两三个摊位写深写活(授权删除整句的背景摊贩罗列描写)。`]
    : [];
  return { hits, kinds: cnt.size };
}

// ── D7 同类交易重复(评测症③: 顶针交易短篇幅出现两次——AI抓住「货郎卖顶针」元素又写一遍·.audit/20260609-gentle-stakes) ──
// 校准: 879章扫描命中1=唯一真阳性(huolang-v2 ch1 顶针×2)·假阳性0; v1ch3两次递药(递进无求购锚)/v1ch1桂花转赠链/renjian104单次赠物均静默。
// 结构病(revise只删不增救不了同物二卖·与0.85长度地板互斥)→ flags-only; 治本=生成端跨段已写账(tradeAskedItems)。
const T_FUNC = /[你我他她它您谁这那是的了么吗呢不没有可到些什何甚多少上回去来过就也都又被把和与在个两要带还问说想能买起搁]/;
const T_STOP = new Set(["东西", "动静", "声音", "声响", "响动", "影子", "人影", "一下", "工夫", "时辰", "法子", "消息", "缘故", "动作"]);
const T_ASK = /(可有|可曾有|有没有|有(?![什甚])[一-龥]{1,4}[么吗](?=[。？！”…\s]|$)|上回[^。！？\n]{0,3}[说托][^。！？\n]{0,4}的?|托[你我][^。！？\n]{0,2}[带捎问]|能配的|想买|要买|给我[来带]|缺(?![什甚])[一-龥]{1,4}[么吗](?=[。？！”…\s]|$))/g;
const T_CORROB = /(递|搁|拣|摸出|翻出|掏出|拿出|接过|塞|收了|收进|铜板|铜钱|[一二两三四五六七八九十]文|多少钱|价钱)/;
function tradeGrams(s: string, names: string[]): Set<string> {
  const out = new Set<string>();
  for (const r of s.match(/[一-龥]+/g) ?? []) for (const L of [2, 3]) for (let i = 0; i + L <= r.length; i++) {
    const g = r.slice(i, i + L);
    if (T_FUNC.test(g) || T_STOP.has(g) || names.some((n) => n.includes(g) || g.includes(n))) continue;
    out.add(g);
  }
  return out;
}
function d7TradeRepeat(body: string, names: string[], len: number): { hits: string[]; clusters: number } {
  type TW = { at: number; items: Set<string>; snip: string };
  const raw: TW[] = [];
  for (const m of body.matchAll(T_ASK)) {
    const at = m.index ?? 0;
    const rest = body.slice(at, at + 42);
    const e = rest.search(/[。！？\n]/);
    const win = e < 0 ? rest : rest.slice(0, e + 1);
    if (!T_CORROB.test(body.slice(Math.max(0, at - 220), at + 260))) continue;
    raw.push({ at, items: tradeGrams(win, names), snip: win.replace(/\s/g, "").slice(0, 16) });
  }
  raw.sort((a, b) => a.at - b.at);
  const cl: TW[] = [];
  for (const w of raw) { const last = cl[cl.length - 1]; if (last && w.at - last.at <= 300) { w.items.forEach((g) => last.items.add(g)); continue; } cl.push(w); }
  const hits: string[] = []; const seen = new Set<string>();
  for (let i = 0; i < cl.length; i++) for (let j = i + 1; j < cl.length; j++) {
    if (cl[j]!.at - cl[i]!.at < 500) continue;
    for (const g of cl[i]!.items) if (cl[j]!.items.has(g)) {
      if ([...seen].some((s) => s.includes(g) || g.includes(s))) continue;
      seen.add(g);
      hits.push(`同物二卖: 「${g}」@${(cl[i]!.at / len * 100) | 0}%(${cl[i]!.snip}…)已被点名求购/成交, @${(cl[j]!.at / len * 100) | 0}%(${cl[j]!.snip}…)又一次求购/配卖`);
    }
  }
  return { hits, clusters: cl.length };
}
// 生成端已写账助手(longrun 段循环注入 covered): 只取求购句±220字语境出现≥2次的"真被经手"物品, 每段至多3件防prompt膨胀。
// 实测: v2ch1段1→[顶针]·段4→[顶针](段4 prompt 带"已售过顶针"禁令=直接掐死本病例); v1ch1/shanju3→[]零噪声。
export function tradeAskedItems(text: string, names: string[] = []): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(T_ASK)) {
    const at = m.index ?? 0;
    const rest = text.slice(at, at + 42);
    const e = rest.search(/[。！？\n]/);
    const win = e < 0 ? rest : rest.slice(0, e + 1);
    const ctx = text.slice(Math.max(0, at - 220), at + 260);
    if (!T_CORROB.test(ctx)) continue;
    for (const r of win.match(/[一-龥]+/g) ?? []) for (const L of [3, 2]) for (let i = 0; i + L <= r.length; i++) {
      const g = r.slice(i, i + L);
      if (T_FUNC.test(g) || T_STOP.has(g) || names.some((n) => n.includes(g) || g.includes(n))) continue;
      if ((ctx.split(g).length - 1) >= 2 && !out.some((c) => c.includes(g) || g.includes(c))) out.push(g);
    }
  }
  return out.slice(0, 3);
}

// ── D8/D9 未具名角色重引+地点重访(评测·竹光窄处路长65-85%: 老修士×2如初见/何家×2如初到——已写账只记roster名的盲区) ──
const ROLE_NPC = /(老修士|老道士|老道(?![一-龥])|老僧|老和尚|老丈|老汉|老妇|老婆婆|老婆子|老者|婆婆|大嫂|大娘|妇人|少女|小童|孩童|掌柜|伙计|郎中|大夫|樵夫|猎户|渔夫|船家|艄公|行脚僧|道姑|尼姑|赤脚医|游方郎中)/g;
const PLACE_TOK = /[一-龥]{1,3}(?:村|镇|观|寺|庵|峰|渡|庄|祠|集)|(?<![人自大谁别两各东西满全在哪邻])[一-龥]家(?=[院门])/g; // [治理] 收紧X家: 排除 人家/自家/大家/谁家 类非地名噪声(8项里5项噪声=喂错误事实)
// 生成端已写账助手: 抽本段出现的未具名角色词(排除紧贴roster名的称号·如"货郎周拾安"的货郎)与地点词。
export function extractRolesPlaces(text: string, names: string[]): { roles: string[]; places: string[] } {
  const roles = new Set<string>();
  for (const m of text.matchAll(ROLE_NPC)) {
    const r = m[0]; const at = m.index ?? 0;
    const near = text.slice(Math.max(0, at - 6), at + r.length + 6);
    if (names.some((n) => n && near.includes(n))) continue; // 紧贴具名者=称号非独立NPC
    roles.add(r);
  }
  const places = new Set<string>();
  for (const m of text.matchAll(PLACE_TOK)) places.add(m[0]);
  return { roles: [...roles].slice(0, 6), places: [...places].slice(0, 8) };
}
function clusterAts(ats: number[], gap = 600): number[][] {
  const wins: number[][] = [];
  for (const a of ats) { const w = wins[wins.length - 1]; if (w && a - w[w.length - 1]! <= gap) w.push(a); else wins.push([a]); }
  return wins;
}
function d8RoleReintro(body: string, names: string[], len: number): string[] {
  const hits: string[] = [];
  const occ = new Map<string, number[]>();
  for (const m of body.matchAll(ROLE_NPC)) {
    const r = m[0]; const at = m.index ?? 0;
    const near = body.slice(Math.max(0, at - 6), at + r.length + 6);
    if (names.some((n) => n && near.includes(n))) continue;
    if (!occ.has(r)) occ.set(r, []);
    occ.get(r)!.push(at);
  }
  for (const [role, ats] of occ) {
    const wins = clusterAts(ats);
    for (let k = 1; k < wins.length; k++) {
      const start = wins[k]![0]!;
      const wide = body.slice(Math.max(0, start - 260), start).replace(/\s/g, ""); // 强标记宽窗(场景式生人引入常在角色词前一两句)
      const tight = body.slice(Math.max(0, start - 8), start); // 弱标记仅限紧贴("一个老修士")
      const strong = /(迎面[^。！？]{0,16}(下来|走来|来了?|过来)|来了?一?个人|个人影|打了?个照面|拦在[^。！？]{0,8}前|陌生)/.test(wide);
      const weak = /(一个|一位)[^一-龥]{0,2}$/.test(tight);
      if ((strong || weak) && !/(方才|刚才|又是|还是|正是|原来是|那位|先前)/.test(wide)) {
        hits.push(`角色重引如生人: 「${role}」@${(wins[0]![0]! / len * 100) | 0}%已相识, @${(start / len * 100) | 0}%又以生人引入(…${wide.slice(-26)})`);
        break;
      }
    }
  }
  return hits;
}
function d9PlaceRevisit(body: string, len: number): string[] {
  const hits: string[] = [];
  const occ = new Map<string, number[]>();
  for (const m of body.matchAll(PLACE_TOK)) { const p = m[0]; if (!occ.has(p)) occ.set(p, []); occ.get(p)!.push(m.index ?? 0); }
  for (const [pl, ats] of occ) {
    const wins = clusterAts(ats);
    outer: for (let k = 1; k < wins.length; k++) {
      for (const start of wins[k]!) { // 遍历窗内成员找"到达句"(首成员可能只是提及·如"何家住在山脚")
        if (!/(到了|来到|走到|进了)/.test(body.slice(Math.max(0, start - 14), start))) continue;
        if (!/((又|再)[^一-龥]{0,2}(到|来|去|访|进|回|上门|登门)|折回|回到|方才|刚才|二趟|第二[次回趟]|重回|回头再)/.test(body.slice(Math.max(0, start - 80), start + 60))) { // "又/再"须接移动动词(防"再拐两个弯"类无关再字豁免)
          hits.push(`地点重访如初到: 「${pl}」@${(wins[0]![0]! / len * 100) | 0}%已到过, @${(start / len * 100) | 0}%再到却未写『又/再/折回』`);
          break outer;
        }
      }
    }
  }
  return hits;
}

// ── D10 echo-lint(治理·回声监控): 注入指令措辞的 ≥4 字 CJK n-gram 泄漏进正文/标题 = prompt 回声("话多半句"成标题本可一行拦住) ──
const ECHO_SKIP = new Set(["人来人往", "世态人情", "不必每拍", "人情味", "一来一回"]); // 过泛短语(指令与正常叙述共有·不算回声)
const echoNorm = (s: string): string => s.replace(/[了的地得着]/g, ""); // 形变归一: 指令"话多了半句"→正文/标题"话多半句"(虚词脱落是最常见的回声形变)
function shinglesOf(src: string, L = 4): Set<string> {
  const out = new Set<string>();
  for (const r of echoNorm(src).match(/[一-龥]+/g) ?? []) for (let i = 0; i + L <= r.length; i++) { const g = r.slice(i, i + L); if (!ECHO_SKIP.has(g)) out.add(g); }
  return out;
}
// sources=各注入指令串(调用方传·避免循环依赖)。返回: 标题命中(最该拦)+正文命中 top(≥2次才算·一次可能是巧合)。两侧均做虚词归一后比对。
export function echoLint(body: string, title: string, sources: string[]): { titleHits: string[]; bodyHits: string[] } {
  const sh = new Set<string>();
  for (const s of sources) for (const g of shinglesOf(s)) sh.add(g);
  const nt = echoNorm(title), nb = echoNorm(body);
  const titleHits = [...sh].filter((g) => nt.includes(g));
  const bodyHits = [...sh].filter((g) => (nb.split(g).length - 1) >= 2).slice(0, 5);
  return { titleHits, bodyHits };
}

// ── D11 账目算术一致性(亏三文案: 折120找92→折110找82→"亏三文"·实亏10): 中文数词解析+找零/亏差校验 ──
const CN_D: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function cnNum(s: string): number | null {
  if (/^\d+$/.test(s)) return +s;
  let n = 0, cur = 0, any = false;
  for (const ch of s) {
    if (ch in CN_D) { cur = CN_D[ch]!; any = true; }
    else if (ch === "十") { n += (cur || 1) * 10; cur = 0; any = true; }
    else if (ch === "百") { n += (cur || 1) * 100; cur = 0; any = true; }
    else return null;
  }
  return any ? n + cur : null;
}
function d11Arith(body: string): string[] {
  const hits: string[] = [];
  type Ev = { v: "折" | "找" | "减" | "亏"; n: number; at: number };
  const evs: Ev[] = [];
  for (const m of body.matchAll(/(折|找|减去?|亏了?)\s*([零一二两三四五六七八九十百\d]{1,6})文/g)) {
    const n = cnNum(m[2]!); if (n == null) continue;
    evs.push({ v: m[1]!.startsWith("减") ? "减" : (m[1]!.startsWith("亏") ? "亏" : (m[1] as "折" | "找")), n, at: m.index ?? 0 });
  }
  // 规则1: 折A…减B…找C → A-B≠C 即错
  for (let i = 0; i < evs.length; i++) if (evs[i]!.v === "折") {
    const b = evs.slice(i + 1, i + 4).find((e) => e.v === "减"), c = evs.slice(i + 1, i + 5).find((e) => e.v === "找");
    if (b && c && evs[i]!.n - b.n !== c.n) hits.push(`账目不合: 折${evs[i]!.n}文减${b.n}文应找${evs[i]!.n - b.n}文, 文中找${c.n}文`);
  }
  // 规则2: 先后两个"找A/找B" + "亏K" → |A-B|≠K 即错(92→82 亏的是10不是3)
  const zhao = evs.filter((e) => e.v === "找");
  const kui = evs.find((e) => e.v === "亏");
  if (zhao.length >= 2 && kui) {
    const diff = Math.abs(zhao[0]!.n - zhao[zhao.length - 1]!.n);
    if (diff !== kui.n && diff !== 0) hits.push(`账目不合: 前后找零 ${zhao[0]!.n}文→${zhao[zhao.length - 1]!.n}文 相差${diff}文, 文中称亏${kui.n}文`);
  }
  return hits;
}

// ── D12 具名角色事件签名去重(亏三文案: 阿九买糖人完整成交×2——非初遇/非求购锚/非地点, D2/D7 双盲区) ──
const BUY_V = /(买|全要了|要了|付|银子|碎银|铜钱|铜板)/g;
const D12_STOP = new Set(["担子", "货担", "货箱", "货郎", "扁担", "银子", "铜钱", "铜板", "碎银", "价钱", "村里", "集上", "已经", "杏花", "花村", "袖口", "点点", "里头", "摸出", "里摸", "怀里"]); // 行当环境泛词(主角身边常驻·非交易物·实测FP源; 点点=点点头碎片; 摸出/里摸=动词碎片)
const D12_QUANT = /[一二两三半几枚文钱]/; // 量词/币值字头 gram(「一枚」「三文」)非物品
function d12EventDup(body: string, names: string[], len: number): string[] {
  const hits: string[] = [];
  for (const name of names) {
    const ats: number[] = []; let i = -1;
    while ((i = body.indexOf(name, i + 1)) >= 0) ats.push(i);
    if (ats.length < 2) continue;
    const wins = clusterAts(ats, 400);
    if (wins.length < 2) continue;
    // 各窗的"购物签名" = 仅取【紧贴购买动词±14字】的物品 grams(物品须真在买卖动作里, 非同窗泛词)
    const sigs = wins.map((w) => {
      const s = Math.max(0, w[0]! - 80), e = Math.min(body.length, w[w.length - 1]! + 80);
      const seg = body.slice(s, e);
      const out = new Set<string>();
      for (const m of seg.matchAll(BUY_V)) {
        const near = seg.slice(Math.max(0, (m.index ?? 0) - 14), (m.index ?? 0) + m[0].length + 14);
        for (const g of tradeGrams(near, names)) if (!D12_STOP.has(g) && !D12_QUANT.test(g) && !/[村镇观寺庵峰渡庄祠集候]$/.test(g)) out.add(g); // 排地名后缀切片(杏花村)与时间词(时候)
      }
      return out;
    });
    for (let a = 0; a < wins.length; a++) for (let b = a + 1; b < wins.length; b++) {
      if (wins[b]![0]! - wins[a]![wins[a]!.length - 1]! < 500) continue;
      for (const g of sigs[a]!) if (sigs[b]!.has(g)) {
        hits.push(`事件重复: ${name}×「${g}」的完整成交在@${(wins[a]![0]! / len * 100) | 0}%与@${(wins[b]![0]! / len * 100) | 0}%各写一遍`);
        return hits; // 一章报一条够定位
      }
    }
  }
  return hits;
}

// ── D13 整句复写(米糕水痕案·2026-06-11): 同章内 ≥12字 连续文本在相距 >600 字的两处逐字重复(「眼仁是深褐色的，干净，像雨后山溪里泡着的石头」×2)。
//    分段互盲把同一描写原样写进两段——d1c 只数稀有词组对(阈12)·D10 只盯标题; 整句精确匹配太脆(插入语「她说」断句/「她」前缀差一字即漏)→改连续 12-gram 命中后贪婪延伸。
//    归一: 去引号与空白(标点保留=更强证据); 距离 >600 避开邻段自然回指(d1a/d1c 辖区)。
function d13SentenceDup(body: string): string[] {
  const norm = body.replace(/[\s「」“”『』]/g, "");
  const G = 12;
  if (norm.length < G * 2) return [];
  const first = new Map<string, number>();
  const hits: string[] = [];
  const reported = new Set<string>();
  let i = 0;
  while (i + G <= norm.length && hits.length < 5) {
    const g = norm.slice(i, i + G);
    const j = first.get(g);
    if (j === undefined) { first.set(g, i); i++; continue; }
    if (i - j <= 300) { i++; continue; } // [空青芝麻案2026-06-12] 闸600→300: 短章(~1900字)开头重写落在600内被放过(炊烟22字×2距444)
    let L = G; // 贪婪延伸匹配段
    while (j + L < i && i + L < norm.length && norm[j + L] === norm[i + L] && L < 60) L++;
    if (L < 16 && i - j <= 600) { i += L; continue; } // 12-15字短段在300-600近程不算(节奏段豁免·原600语义保留)
    const run = norm.slice(i, i + L);
    if (!reported.has(run)) { reported.add(run); hits.push(run); } // 存全段(分层用·展示侧再截)
    i += L; // 跳过整段防重报
  }
  return hits;
}
// ── D14 重逢重演(米糕水痕案): 同一对称呼短语(「陆施主」/「林师父」类)在相距 >600 字的两簇里各完整出现一轮 = 同章把"初见寒暄"演了两遍。
//    单独的二次招呼是自然的——所以 D14 只在 (称呼对×2簇) 且 (本章另有 D13 整句复写≥1) 时记 flag(场景双版本的复合签名, 防误伤真重逢)。
const ADDR_HONOR = /(施主|师父|道友|姑娘|公子|掌柜|师兄|师姐|前辈|大哥|大嫂|老丈)/;
function d14ReMeet(body: string, d13n: number): string[] {
  if (d13n < 1) return [];
  const addrs: Array<{ key: string; at: number }> = [];
  const re = /[「“]([^「」“”]{2,8})[。！？]?[」”]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const inner = (m[1] ?? "").trim();
    if (ADDR_HONOR.test(inner)) addrs.push({ key: inner.replace(/[。！？\s]/g, ""), at: m.index });
  }
  const byKey = new Map<string, number[]>();
  for (const a of addrs) { const l = byKey.get(a.key) ?? []; l.push(a.at); byKey.set(a.key, l); }
  const dup = [...byKey.entries()].filter(([, ats]) => ats.length >= 2 && Math.max(...ats) - Math.min(...ats) > 600).map(([k]) => k);
  return dup.length >= 2 ? [`重逢重演: 称呼对「${dup.slice(0, 2).join("」「")}」相隔两簇各演一轮且本章有整句复写——疑似同一相见写了两个版本`] : [];
}

// ── D13 确定性去重(2026-06-11·registry#23预注册退路): xiqiao 30章验证 directive 失聪(any23%/dir10%≈基线·ch11/20修订采纳但复写幸存·ch5被长度地板拒)→零LLM外科删除。
//    在【原文】上直接检测 ≥16字 连续重复段(>600字距·贪婪延伸·不归一=只打真正原样段), 把第二处扩到所在句(。！？边界), 句子被复写段占比 ≥0.55 才删(防删掉混有新内容的长句); 每章至多删2处。
//    第一处永远保留=信物回扣/mustKeep 不受影响; 删除量≈30-60字/处·远高于0.85长度地板安全线。gate=NOVEL_DEDUP(默认开·=0关)。
export function d13DedupSecond(raw: string): { text: string; removed: string[] } {
  const G = 16;
  const removed: string[] = [];
  let text = raw;
  const attempted = new Set<string>(); // 守卫拒过的run文本·不复试(gen2 ch3案: 旧版守卫失败break整轮·L=60怪物段轮不到)
  for (let pass = 0; pass < 4 && removed.length < 2; pass++) {
    const norm: string[] = []; const map: number[] = [];
    for (let k = 0; k < text.length; k++) { const c = text[k]!; if (/[\s「」“”『』]/.test(c)) continue; norm.push(c); map.push(k); }
    const ns = norm.join("");
    const first = new Map<string, number>();
    const cands: Array<{ i: number; j: number; L: number }> = [];
    for (let i = 0; i + G <= ns.length; i++) {
      const g = ns.slice(i, i + G);
      const j = first.get(g);
      if (j === undefined) { first.set(g, i); continue; }
      if (i - j <= 300) continue;
      let L = G;
      while (j + L < i && i + L < ns.length && ns[j + L] === ns[i + L] && L < 80) L++;
      cands.push({ i, j, L });
      i += L - 1; // 跳过本段
    }
    cands.sort((a, b) => b.L - a.L); // 大段优先
    let acted = false;
    for (const c of cands) {
      let { i, j, L } = c;
      while (L > 8 && /[。！？，、；：]/.test(ns[i]!)) { i++; j++; L--; } // 剥头句界
      const runKey = ns.slice(i, i + L);
      if (attempted.has(runKey)) continue;
      // 链式合并(中途标点形变切段)
      let iEnd = i + L; let jEnd = j + L; let matched = L;
      for (let link = 0; link < 3; link++) {
        let hooked = false;
        outer: for (let gi = 0; gi <= 4; gi++) for (let gj = 0; gj <= 4; gj++) {
          if (iEnd + gi + 8 <= ns.length && jEnd + gj + 8 <= i && ns.slice(iEnd + gi, iEnd + gi + 8) === ns.slice(jEnd + gj, jEnd + gj + 8)) {
            let L2 = 8;
            while (jEnd + gj + L2 < i && iEnd + gi + L2 < ns.length && ns[jEnd + gj + L2] === ns[iEnd + gi + L2] && L2 < 80) L2++;
            iEnd += gi + L2; jEnd += gj + L2; matched += L2; hooked = true; break outer;
          }
        }
        if (!hooked) break;
      }
      const rawStart = map[i]!; const rawEnd = map[iEnd - 1]! + 1;
      let st = rawStart; while (st > 0 && !/[。！？\n]/.test(text[st - 1]!)) st--;
      let e = rawEnd; while (e < text.length && !/[。！？\n]/.test(text[e]!)) e++;
      if (e < text.length && /[。！？]/.test(text[e]!)) e++;
      while (e < text.length && /[」”』]/.test(text[e]!)) e++;
      const sent = text.slice(st, e);
      attempted.add(runKey);
      if (matched / Math.max(1, sent.replace(/[\s「」“”『』]/g, "").length) < 0.55) continue; // 占比闸不过→试下一个候选(旧版在此break=全轮报废)
      if ((sent.match(/「/g)?.length ?? 0) !== (sent.match(/」/g)?.length ?? 0)) continue; // 引号不配对→下一个
      text = text.slice(0, st) + text.slice(e);
      removed.push(sent.replace(/\s/g, "").slice(0, 28));
      acted = true;
      break; // 删一处后文本已变·重扫
    }
    if (!acted) break;
  }
  return { text, removed };
}

// ── D17 那X无先行(空青芝麻案2026-06-12·B类复现10章/好章0误伤): 「那脚步声」类指代词+声音名词的章内首现无先行句——分段互盲把前段铺垫句丢了。flags-only。
const D17_NOUNS = ["脚步声", "敲门声", "说话声", "哭声", "笑声", "琴声", "铃声", "桨声"];
function d17Anaphora(body: string): string[] {
  const hits: string[] = [];
  for (const n of D17_NOUNS) {
    const first = body.indexOf(n);
    if (first > 0 && body[first - 1] === "那") hits.push(`那${n}无先行(首现即指代·前文缺一句铺垫如「楼下传来${n}」)`);
  }
  return hits;
}

// ── D18 名字漂移(雾江余债案2026-06-12·gen2四章真漂: 苏思齐≈柳思齐×2/谢子衿≈何子衿/顾小棠≈苏小棠·好章0误伤): 文本中3字人名与册内名后两字相同而姓异且不在册=极可能写漂。
//    称谓停用表防FP(X老三/X管事=头衔非名)。issues通道(单token换字=最易遵从的directive类)+flags telemetry。
const D18_SUR = "赵钱孙李周吴郑王冯陈蒋沈韩杨朱秦许何吕施张孔曹严华金魏陶姜戚谢邹苏潘范彭鲁韦马方俞任袁柳唐罗薛雷贺倪汤滕殷毕郝邬安常乐于时傅卞齐康伍余元卜顾孟平黄和穆萧尹姚邵湛汪祁毛禹狄米贝明臧计成戴宋庞熊纪舒屈项祝董梁杜阮蓝闵席季";
const D18_APPELL = new Set(["老三", "老四", "管事", "掌柜", "婶子", "师太", "夫人", "公子", "大娘", "大爷", "把头", "师傅", "郎中", "大夫", "先生", "姑娘"]);
function d18NameDrift(body: string, names: string[]): string[] {
  const giv = new Map<string, string>();
  for (const n of names) if (n.length === 3 && !D18_APPELL.has(n.slice(1))) giv.set(n.slice(1), n);
  const hits = new Set<string>();
  for (const m of body.matchAll(/[一-龥]{3}/g)) {
    const w = m[0];
    if (names.includes(w)) continue;
    const g = w.slice(1);
    const twin = giv.get(g);
    if (twin && D18_SUR.includes(w[0]!) && w[0] !== twin[0]) hits.add(`「${w}」疑为「${twin}」之误(后两字同·${w}不在名册): 若非本章新立角色, 全章统一写作「${twin}」`);
  }
  return [...hits];
}

// ── D19 同台词复写(三道印案2026-06-12·gen3 ch17「连本带息你不该算一算」11字×2逃过D13的16字directive层): 引号内整句台词 ≥8字 verbatim×2(距>300)——台词逐字重说杀伤力远超叙述复写·低阈专层。
function d19DialogueDup(body: string): Array<{ q: string; first: number; second: number }> {
  // 先收所有引号片段, 再把被「她说」类插入语切开的相邻片段归并成一句(间隙≤8字·三道印案: 「那年冬日欠的，」她说，「连本带息你不该算一算？」)
  const frags: Array<{ t: string; at: number; end: number }> = [];
  const re = /[「“]([^「」“”]{2,60})[」”]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) frags.push({ t: m[1] ?? "", at: m.index, end: m.index + m[0].length });
  const units: Array<{ t: string; at: number }> = [];
  for (let i = 0; i < frags.length; i++) {
    let t = frags[i]!.t; const at = frags[i]!.at; let end = frags[i]!.end;
    while (i + 1 < frags.length && frags[i + 1]!.at - end <= 8) { t += frags[i + 1]!.t; end = frags[i + 1]!.end; i++; }
    units.push({ t, at });
  }
  const seen = new Map<string, number>();
  const out: Array<{ q: string; first: number; second: number }> = [];
  for (const u of units) {
    const inner = u.t.replace(/[\s，、]/g, "");
    if (inner.length < 8) continue;
    const j = seen.get(inner);
    if (j === undefined) { seen.set(inner, u.at); continue; }
    if (u.at - j > 300 && !out.some((o) => o.q === inner)) out.push({ q: inner, first: j, second: u.at });
  }
  return out;
}

// 主入口: text=章正文(无标题行), names=canon 人名(写章时在手), title=本章标题(goal)。
export function lintSeams(text: string, names: string[], title: string): SeamResult {
  const body = text.trim();
  const len = body.length || 1;
  const paras = getParas(body);
  const d1a = d1aClock(paras, len);
  const d1c = d1cRareTri(paras, len);
  const d2 = d2Meet(paras, names, len);
  const d3 = d3Prop(body, names, title);
  const d4 = d4Geo(body, len);
  const d5 = d5Title(title, paras);
  const d6 = d6Trades(body);
  const d7 = d7TradeRepeat(body, names, len); // [修3a·gentle-stakes] 同物二卖
  const d8 = d8RoleReintro(body, names, len); // 未具名角色重引如生人(竹光窄处·老修士×2)
  const d9 = d9PlaceRevisit(body, len); // 地点重访如初到(何家×2)
  const d11 = d11Arith(body); // 账目算术(亏三文案)
  const d12 = d12EventDup(body, names, len); // 具名角色事件签名去重(糖人案)
  const d13 = d13SentenceDup(body); // 整句复写(米糕水痕案·2026-06-11)
  const d17 = d17Anaphora(body); // 那X无先行(空青芝麻案)
  const d18 = d18NameDrift(body, names); // 名字漂移(雾江余债案)
  const d19 = d19DialogueDup(body); // 同台词复写(三道印案)
  const d14 = d14ReMeet(body, d13.length); // 重逢重演(复合签名·依赖D13)

  const issues: string[] = [...d3.hits, ...d6.hits, ...d18]; // 表层可修 → revise directives(D18单token换字=最易遵从)
  if (d19.length) issues.push(`同台词复写×${d19.length}: 「${d19.map((x) => x.q.slice(0, 16)).join("」「")}」——同一句话被原样说了两遍(相隔甚远): 保留语境更要紧的一处, 另一处删去或换说法; 若是有意重提, 须让说话人自知重复(如「我再说一遍」)`);
  if (d1c.length >= 8) issues.push(`远距套语成片(相隔甚远的叙述段共享同样的稀有词组 ${d1c.length} 对——分段各写各的、复用了同一套语): 把下列最重的几对拆开, 各保留一处、另一处换说法或删句: ${d1c.slice(0, 3).join("；")}`);
  const d13Long = d13.filter((x) => x.length >= 16); // [校准2026-06-11] directive只打长段(意象从句级·好章基准的12-13字短节奏段不动); 短段进flags telemetry
  if (d13Long.length >= 1) issues.push(`整句原样复写×${d13Long.length}(同一段描写在本章原样出现了两遍·分段互盲所致): 「${d13Long.slice(0, 2).map((x) => x.slice(0, 24)).join("」「")}」——保留语境更顺的一处, 另一处换个说法或删去; 若是有意回环, 须在第二处前补一句衔接(人物位置/动作的过渡), 不得原句照搬`);

  const flags: string[] = [...d1a, ...d2.hits, ...d4, ...d5, ...d7.hits, ...d8, ...d9, ...d11, ...d12, ...d14, ...d17]; // 结构病 → 只记日志(治本=生成端跨段已写账; D7二次成交≈全章11%与0.85地板互斥, 入issues只会造无效精修循环)
  if (d1c.length >= 12) flags.push(`套语复写重灾: 远距套语对 ${d1c.length} 处(语料 p95=12)`);
  if (d13.length >= 1) flags.push(`整句复写×${d13.length}(长段≥16字×${d13Long.length}): 「${d13.slice(0, 2).map((x) => x.slice(0, 24)).join("」「")}」——同章把同一段原样写了两遍(分段互盲签名)`);

  return { issues, flags, metrics: { d1cPairs: d1c.length, d2Meets: d2.meets, d3Props: d3.props, tradeKinds: d6.kinds, tradeReps: d7.hits.length, d13Dups: d13.length } };
}
