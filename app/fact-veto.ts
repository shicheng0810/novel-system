// app/fact-veto.ts — 段间微事实矛盾·确定性检测(Phase 1a·.audit/20260613-stitching-factveto/spec.md v2)
//   治本: writeChapter 四段盲写各编一版(船资5↔3文·师太静檀↔静安·林思齐他↔她)。本文件=纯函数检测端(零LLM·零随机)·先离线证精度(护栏d)·过门才接重生执法(Phase 1b)。
//   命门=高精度宁漏勿误(误检→无谓重生改坏好文·比漏检毒)。验收门: judge判干净的章 0 误检。
//   分级(spec v2-§A): 性别他↔她(确定性可替换·闭集) + 称谓名漂移(就近同位高置信·共字才判同实体) 先建; 数值(护栏a最难·排可消耗/时辰/跨交易)后续; 地点不进(护栏b·归transitionGap)。
//   检测尽量复用 lint-seams(评审§4·防两套真相)·本文件只做断言抽取+矛盾路由。
import { readFileSync } from "node:fs";

const SENT_SPLIT = /[。！？\n；]/;

// 常见姓氏锚: 人名须以此起头(滤掉"雨沫子"这类物象 3 字串·精度命门)。
const SURNAMES = "柳陆苏沈林谢唐宋方顾陈李王张刘赵周吴郑孙马朱胡郭何高罗梁韩冯董萧程曹袁邓许傅曾彭吕卢蒋蔡贾丁魏薛叶阎余潘杜戴夏钟汪田姜范石姚谭廖邹熊金郝孔白崔康毛邱秦史侯邵孟龙段雷钱汤尹黎常武乔贺赖龚温裴";
// 已知名: 优先用传入花名册(longrun 有 sim 名单); 缺省自抽"姓氏起头+高频"2-3 字 CJK 串。
export function autoNames(text: string): string[] {
  const freq = new Map<string, number>();
  for (const m of text.matchAll(/[一-鿿]{2,3}/g)) {
    const s = m[0];
    if (!SURNAMES.includes(s[0] ?? "")) continue; // 姓氏锚: 非常见姓起头一律跳(滤物象)
    if (/[的了是在不没这那一二三四五六七八九十两半个多少又也都还把被和与之其所以及很太更最]/.test(s)) continue;
    freq.set(s, (freq.get(s) ?? 0) + 1);
  }
  // 去子串: 林思 ⊂ 林思齐 → 只留长的
  const all = [...freq.entries()].filter(([, n]) => n >= 2).map(([s]) => s);
  return all.filter((s) => !all.some((o) => o !== s && o.includes(s)));
}

export interface VetoHit { kind: "gender" | "nameDrift" | "number"; entity: string; v1: string; v2: string; ev1: string; ev2: string; why: string }

// ── 性别断言: 名→代词(就近紧邻绑定·宁漏勿误) ──
// 高精度: 代词向前看 ≤12 字, 该窗内须恰有一个已知名(无第二名)才绑; 同名两性别=flag。
export function extractGender(text: string, names: string[]): Map<string, Array<{ g: string; ev: string }>> {
  const bind = new Map<string, Array<{ g: string; ev: string }>>();
  const nameRe = names.length ? new RegExp(names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g") : null;
  if (!nameRe) return bind;
  for (const pm of text.matchAll(/[他她]/g)) {
    const at = pm.index ?? 0;
    const g = pm[0];
    const win = text.slice(Math.max(0, at - 12), at); // 代词前 12 字窗
    const found = [...win.matchAll(nameRe)].map((m) => m[0]);
    if (found.length !== 1) continue; // 窗内须恰一个名(无歧义)才绑
    const nm = found[found.length - 1]!;
    // 名与代词之间: 同句(无句界)·或仅 ≤2 标点("是林思齐。她"同位跨句·高置信)才绑; 有实词跨句不绑(防代词指别人)。
    const between = win.slice(win.lastIndexOf(nm) + nm.length);
    if (between && !/^[。！？，、""'']{1,2}$/.test(between)) continue;
    const ev = text.slice(Math.max(0, at - 12), Math.min(text.length, at + 2)).replace(/\n/g, "");
    const arr = bind.get(nm) ?? [];
    if (!arr.some((x) => x.g === g)) arr.push({ g, ev });
    bind.set(nm, arr);
  }
  return bind;
}

// ── 称谓→法名 漂移(仅宗教称谓·法名似真才绑·宁漏勿误) ──
// 只限宗教称谓: 世俗称谓(老板娘/姑娘/先生/大夫)几乎不带名·`[CJK]{2,3}称谓`只会抓到动词短语=噪声灾难(评审+离线扫实证)。法名(静檀/静安)前置才是干净高置信。
const TITLES = ["师太", "师父", "师傅", "道长", "方丈", "住持", "法师", "禅师", "上人", "真人"];
// 法名似真: 2 字·两字皆不在动词/功能/方位停字表(滤"说着""娘正""后静观"的前导字)。
const NAME_STOP = /[的了是在不没这那又也都把被和与之其所以及很太更最说要着转端洗正笑骂搁靠点闻见从择回压蹲来过往走抬偏低时才讲身手娘光喊唤给向朝看做拿坐站行知问想能买卖起好还便就只将该当头脸色映幕里方身道]/;
// 共字判同实体: 两名共 ≥1 字(静檀/静安共"静")=漂移强信号; 全异=多半两人·不判。
function shareChar(a: string, b: string): boolean { for (const c of a) if (b.includes(c)) return true; return false; }
export function extractTitleName(text: string): Map<string, Array<{ name: string; ev: string }>> {
  const bind = new Map<string, Array<{ name: string; ev: string }>>();
  for (const t of TITLES) {
    const re = new RegExp(`([\\u4e00-\\u9fff]{2})${t}`, "g"); // 仅法名前置(2 字)·宗教称谓
    for (const m of text.matchAll(re)) {
      const name = (m[1] ?? "").trim();
      if (name.length !== 2 || NAME_STOP.test(name)) continue; // 法名似真过滤(含动词/功能字=噪声·跳)
      const at = m.index ?? 0;
      const ev = text.slice(Math.max(0, at - 4), Math.min(text.length, at + name.length + t.length + 4)).replace(/\n/g, "");
      const arr = bind.get(t) ?? [];
      if (!arr.some((x) => x.name === name)) arr.push({ name, ev });
      bind.set(t, arr);
    }
  }
  return bind;
}

// ── 数值断言(护栏a最难·须排可消耗/时辰/跨交易) ──
// 只抽「名词键+中文数+稳定量词」(无名词键不绑); 矛盾=同名同量词不同数·≤150字内·中间无消耗/交易/变化触发(否则是合法变化)。量词排时辰(不含时/刻/更)。
const QTY = "文尺寸丈里斤条枚片块碗壶盏盆筐担升斗匹卷扇";
const NUM_EXCL = /[付给收找补添加省剩花用赏扣抵欠卖买涨落退凑只还又再多少又]|剩下|还有|只剩|用了|花了|添了|又.了|多了|少了/; // 两次之间出现=合法变化·排除
export function extractNumbers(text: string): Array<{ key: string; num: string; at: number; ev: string }> {
  const out: Array<{ key: string; num: string; at: number; ev: string }> = [];
  const re = new RegExp(`([\\u4e00-\\u9fff]{2,3})([零一二三四五六七八九十百千两]{1,4})([${QTY}])`, "g");
  for (const m of text.matchAll(re)) {
    let noun = (m[1] ?? "").replace(/^[那这又也是了的和与给向朝把被又再多少正还便就只将该当从往回身后前]/, "");
    if (noun.length < 2 || /[那这是了的把被和与又也都说要着]/.test(noun)) continue; // 名词键须似真
    const at = m.index ?? 0;
    out.push({ key: `${noun}|${m[3]}`, num: m[2] ?? "", at, ev: text.slice(Math.max(0, at - 2), Math.min(text.length, at + 8)).replace(/\n/g, "") });
  }
  return out;
}

// ── 主检测: 抽断言 + 路由矛盾(高精度) ──
export function detectContradiction(text: string, names?: string[]): VetoHit[] {
  const nm = names && names.length ? names : autoNames(text);
  const hits: VetoHit[] = [];
  // 性别: 同名两性别
  for (const [name, gs] of extractGender(text, nm)) {
    if (gs.length >= 2) hits.push({ kind: "gender", entity: name, v1: gs[0]!.g, v2: gs[1]!.g, ev1: gs[0]!.ev, ev2: gs[1]!.ev, why: `${name} 同章先${gs[0]!.g}后${gs[1]!.g}` });
  }
  // 称谓名漂移: 同称谓两共字名
  for (const [t, ns] of extractTitleName(text)) {
    if (ns.length >= 2) {
      // 只判共字对(同实体漂移)·全异跳(多半两人)·子串对跳(静观⊂后静观=同名非漂移)
      for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
        const a = ns[i]!.name, b = ns[j]!.name;
        if (a !== b && shareChar(a, b) && !a.includes(b) && !b.includes(a))
          hits.push({ kind: "nameDrift", entity: t, v1: a, v2: b, ev1: ns[i]!.ev, ev2: ns[j]!.ev, why: `${t}的名前${a}后${b}(共字=同人漂移)` });
      }
    }
  }
  // 数值: 同名同量词不同数·≤150字·中间无消耗/交易/变化触发(护栏a)
  const nums = extractNumbers(text);
  const byKey = new Map<string, typeof nums>();
  for (const x of nums) { const a = byKey.get(x.key) ?? []; a.push(x); byKey.set(x.key, a); }
  for (const [key, xs] of byKey) {
    for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) {
      const A = xs[i]!, B = xs[j]!;
      if (A.num === B.num) continue;
      if (Math.abs(A.at - B.at) > 150) continue; // 须同场景近距(几句内)
      const between = text.slice(Math.min(A.at, B.at), Math.max(A.at, B.at));
      if (NUM_EXCL.test(between)) continue; // 中间有消耗/交易/变化=合法·排除
      hits.push({ kind: "number", entity: key.split("|")[0]!, v1: A.num, v2: B.num, ev1: A.ev, ev2: B.ev, why: `${key.split("|")[0]} 同场景 ${A.num}${key.split("|")[1]}↔${B.num}${key.split("|")[1]}` });
    }
  }
  return hits;
}

// CLI: npx tsx app/fact-veto.ts <章.md> [名1,名2,...]  → 打印检出 JSON(离线精度验证用)
if (process.argv[1]?.endsWith("fact-veto.ts")) {
  const file = process.argv[2];
  if (!file) { console.log("用法: npx tsx app/fact-veto.ts <章.md> [名1,名2,...]"); process.exit(0); }
  const text = readFileSync(file, "utf8");
  const names = process.argv[3] ? process.argv[3].split(",") : undefined;
  console.log(JSON.stringify({ file: file.split("/").slice(-2).join("/"), hits: detectContradiction(text, names) }, null, 2));
}
