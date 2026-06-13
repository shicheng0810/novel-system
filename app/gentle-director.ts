// app/gentle-director.ts — 温情变化驱动器(T2): 场景与世界生态主动轮换 + 温情坍塌检测。
// drama.ts 温情对位: 纯符号无 LLM, 每章一次, 读落盘近章标题/正文 → 2-gram 名词指纹测坍塌 → 单维递进派场景。
// 只在 GENTLE; 绝不写 factionShifts/负valence/Fell/crisis/tuning, 结构上不引冲突。core/packs 不涉。
// 选择全基于 ctrl.turn(禁 Math.random/Date.now) → resume 完全复现。
import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { jaccard } from "./sim-fitness"; // 复用现成 Jaccard(但指纹自带 2-gram, 不用盲眼 4-gram novelty)

export interface SceneShift { forCh: number; domain: string; timeShift: string; avoidClass: string; ambience: string }
export interface GDCtrl { sameStreak: number; lastMotifs: string[]; lastDomain: string; turn: number; defyStreak: number; motifHist?: string[][]; lastDomainAt?: number; dispatchLog?: Array<{ ch: number; domain: string; escalation: string }> } // lastDomainAt=[Q3·协同审计] 上次真派域的章号(域记忆加章龄·>3章视空, 防陈年lastDomain永久排挤候选+假抗命); dispatchLog=[P0-1·干预四账②·蓝图 .audit/20260610-evolution-overhaul §3.1] 每次派景记 {ch,domain,escalation}(滚64·按 forCh 键确定性·遥测零行为, NOVEL_GD=0 时照记)。预注册退休条款: 2卷无消费者即停写(蓝图P0-1)。

const S_TRIGGER = 4;                       // [C7] 提到4, 容温情合理停留
const SEASONS = ["立春乍暖·清晨", "谷雨润物·向午", "小满麦黄·晌午", "夏至蝉长·薄暮", "白露凉起·清晨", "秋分桂香·向晚", "霜降叶染·黄昏", "小雪初寒·入夜", "冬至围炉·夜深", "雨水冰解·拂晓"];
const DOMAINS = ["出门赶集", "访友叙旧", "上山访庵", "下山归途", "渡口候船", "田间水边", "市集庙会", "别人家中", "归乡省亲", "远行途中"];
const NEWFACE = ["一个行脚僧叩门借宿", "一位求医人寻上门", "邻家孩童跑来玩耍", "一位归乡的旧邻路过", "一个远来的货郎歇脚"];
// [C6] 风物——只描世态流动, 无"带来见闻/捎书将至"类外部意图体
const AMBIENCE = ["街市比平日热闹三分，人语喧阗", "谷场上农事正忙，新谷香气漫过田垄", "社树下乡邻分胙饮酒、孩童绕场", "渡口泊了远来的船，卸货声到黄昏"];
// [C5] motif → 场景"类"(非字面词), 用于 avoidClass
const CLASS_RULES: Array<[RegExp, string]> = [
  [/碗|姜汤|粥|药|茶|铜钱|瓷|陶|炉|炭|灶|裂纹|旧物|灯/, "室内灶房·同一旧物特写"],
  [/院|门|窗|墙|檐/, "宅院内同一处"],
];
export function classifyMotif(motifs: string[]): string {
  for (const [re, name] of CLASS_RULES) if (motifs.some((m) => re.test(m))) return name;
  return "近章反复的同一处场景";
}

const F = (d: string): string => join(d, "gentle-director.json");
export function loadGD(d: string): GDCtrl {
  try { return existsSync(F(d)) ? { sameStreak: 0, lastMotifs: [], lastDomain: "", turn: 0, defyStreak: 0, ...JSON.parse(readFileSync(F(d), "utf8")) } : { sameStreak: 0, lastMotifs: [], lastDomain: "", turn: 0, defyStreak: 0 }; }
  catch { return { sameStreak: 0, lastMotifs: [], lastDomain: "", turn: 0, defyStreak: 0 }; }
}
const atomicWrite = (file: string, data: string): void => { const tmp = file + ".tmp." + process.pid; writeFileSync(tmp, data, "utf8"); renameSync(tmp, file); }; // [档C②·原子写] 同目录 tmp+rename 防 torn-write→load 静默回空(蓝图 .audit/20260610-evolution-overhaul §3.2)
export function saveGD(d: string, c: GDCtrl): void { try { atomicWrite(F(d), JSON.stringify(c)); } catch { /* 非关键 */ } }

// [C4] 2-gram 中文「场景/静物」指纹(对 motif 坍塌敏感; 不用盲眼 4-gram)。warm-fitness.ts 复用之。
// 滤掉虚词/语法碎片(了一/那只/的话)与传入的人名 → 指纹聚焦真场景名词, 不被高频功能字与主角名挤占 top-k(否则坍塌检测被噪声稀释)。
const FUNC_CHARS = "的了着过吗呢吧啊呀么哦嗯之其所为以于而且但却则因如此些个种样一半两三他她它你我们谁每各这那是不也都还又把被将与和跟同向往从来去到在有没要会能可得地很就只便已再让把对把";
const isContentGram = (g: string): boolean => !FUNC_CHARS.includes(g[0]!) && !FUNC_CHARS.includes(g[1]!);
export function nameGrams(names: string[]): Set<string> { // 在场人名拆 2-gram(柳如烟→柳如/如烟) 作停用集; 名字每章必现、非「场景单一」之源, 排除之
  const s = new Set<string>();
  for (const nm of names) { const c = (nm ?? "").replace(/\s+/g, ""); for (let i = 0; i + 2 <= c.length; i++) { const g = c.slice(i, i + 2); if (/^[一-龥]{2}$/.test(g)) s.add(g); } }
  return s;
}
export function motifSig(titles: string[], bodies: string[], k = 8, stop?: Set<string>): string[] {
  // 窗口 450(原240): 让「整场在某地但开篇头240字没点名该地」的章也被指纹捕获(实测 ch122 全文灶9次却只在前240字1次→漏, persist差一章没到线)。
  const text = (titles.join("　") + "　" + bodies.map((b) => b.slice(0, 450)).join("　")).replace(/\s+/g, "");
  const freq: Record<string, number> = {};
  for (let i = 0; i + 2 <= text.length; i++) { const g = text.slice(i, i + 2); if (/^[一-龥]{2}$/.test(g) && isContentGram(g) && !(stop && stop.has(g))) freq[g] = (freq[g] ?? 0) + 1; }
  return Object.entries(freq).filter(([, v]) => v >= 2).sort((a, b) => b[1] - a[1]).slice(0, k).map(([g]) => g);
}

export function gentleDirect(
  forCh: number, titles: string[], bodies: string[], ctrl: GDCtrl,
  occupied: boolean,   // [C11] 本章被大纲/伏笔占用 → 让位
  location: string,    // [C7] 当前在场 location, 用于候选可达性过滤
  names: string[] = [], // 在场人名 → 指纹排除(名字非「场景单一」之源, 否则主角名每章必现拉高 jaccard 误判黏住)
): { sceneShift: SceneShift | null; ctrl: GDCtrl; motifs: string[]; log: string } {
  const motifs = motifSig(titles, bodies, 8, nameGrams(names));
  const hist = [...(ctrl.motifHist ?? []), motifs].slice(-4); // 近4章指纹滚动窗
  // [修正·听雨楼坍塌盲区] 场景锚持久检测: 某 motif 在近4章里≥3章复现 = 地点/场景锁住(表层词在变但镜头没动)。
  //   补 pairwise jaccard 测不到的「地点持久但 vocab 微变」——验证实测守候戏 ch50-54 锁「听雨楼」5章, 每章 jaccard<0.5 漏报, 持久检测可逮。
  const persist = motifs.filter((m) => hist.filter((s) => s.includes(m)).length >= 3);
  const stuck = jaccard(new Set(motifs), new Set(ctrl.lastMotifs)) >= 0.5 || persist.length >= 2; // 内容坍塌 或 场景锚持久 → 黏住
  const sameStreak = stuck ? ctrl.sameStreak + 1 : 0;
  // [C5/4.4] 事后闭环: 上章派了场景却仍黏住 = prose 抗命。[Q3] 只计真抗命: 派发须是近2章内的事(陈年lastDomain不算·防假抗命直跳顶格干预)
  const recentDispatch = ctrl.lastDomainAt != null && forCh - ctrl.lastDomainAt <= 2;
  const defyStreak = (recentDispatch && ctrl.lastDomain && stuck) ? ctrl.defyStreak + 1 : 0;
  let next: GDCtrl = { ...ctrl, sameStreak, lastMotifs: motifs, motifHist: hist, defyStreak };

  if (occupied || sameStreak < S_TRIGGER) {
    return { sceneShift: null, ctrl: next, motifs, log: `温情观望(streak${sameStreak}${occupied ? "·让位大纲" : ""})` };
  }
  const avoidClass = classifyMotif(motifs);
  // [C7] 单维递进 + 软着陆: 按 streak 决定动几个维度
  const timeShift = SEASONS[next.turn % SEASONS.length]!;
  let domain = ""; let ambience = "";
  if (sameStreak >= 5) { // 加新面孔
    ambience = NEWFACE[next.turn % NEWFACE.length]!;
  }
  if (sameStreak >= 6 || defyStreak >= 1) { // 换场景域(候选按 location 可达过滤——示意: 简化为跳过上次域)
    let di = next.turn % DOMAINS.length;
    const freshLast = ctrl.lastDomainAt != null && forCh - ctrl.lastDomainAt <= 3 ? ctrl.lastDomain : ""; // [Q3] 域记忆章龄: >3章前派的域不再排挤
    if (DOMAINS[di] === freshLast) di = (di + 1) % DOMAINS.length;
    domain = DOMAINS[di]!;
  }
  if (sameStreak >= 7) { // 概率挂风物(确定性: 用 turn 低位, resume 复现)
    const p = Math.min(0.6, (sameStreak - 7 + 1) * 0.25);
    if (((next.turn * 7 + sameStreak) % 100) / 100 < p) ambience = AMBIENCE[next.turn % AMBIENCE.length]!;
  }
  // [4.4] prose 抗命升级: 强制物理离开当前 location
  if (defyStreak >= 2 && location) ambience = `本章开篇须离开${location}(出门/启程)，把人事挪到别处。` + ambience;

  // [修正] 只在【真换场景域】后归零 streak(给新舞台喘息); 软调(仅时令/新面孔)时保持 streak 继续爬 → 下章升级到换景, 否则永远卡在4只发时令、escalation 阶梯失效。
  next = { ...next, lastDomain: domain || ctrl.lastDomain, lastDomainAt: domain ? forCh : ctrl.lastDomainAt, turn: next.turn + 1, sameStreak: domain ? 0 : next.sameStreak, defyStreak: domain ? 0 : defyStreak };
  const shift: SceneShift = { forCh, domain: domain || "(原处·仅推时令/添新面孔)", timeShift, avoidClass, ambience };
  // [P0-1·干预四账②] 派景记账(同章重派=弃章重试→按 ch 键覆盖, 确定性)。预注册退休条款: 2卷无消费者即停写(蓝图P0-1)。
  next = { ...next, dispatchLog: [...(next.dispatchLog ?? []).filter((x) => x.ch !== forCh), { ch: forCh, domain: shift.domain, escalation: `s${sameStreak}d${defyStreak}` }].slice(-64) };
  return {
    sceneShift: shift, ctrl: next, motifs,
    log: `🍃${domain ? `换景→【${domain}】` : "软调"}·${timeShift}${ambience ? "·" + ambience.slice(0, 8) + "…" : ""}(避:${avoidClass})`,
  };
}
