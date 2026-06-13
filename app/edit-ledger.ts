// app/edit-ledger.ts — 章级修订 pass 的支撑层: per-world 黑名单账本(程序维护·resume 安全) + 机检(零 LLM 定位违规) + 减法重写 prompt + 三道确定性闸。
// 仅 GENTLE(温润)世界用。依据 .audit/20260608-master-benchmark/synthesis.md: 引擎已"形似汪曾祺", 差距集中在三个"过"(②比喻过密/③情绪过释=絮/④象征过劳/⑥点破尾巴)+一个匀速(⑤)。
// 分工: 本模块只"定位 + 约束 + 守门"; 真正改写交 LLM(longrun.reviseChapter 调用)。机检不必完美——只需标出可疑处让 LLM 做减法; 三道闸防改过头(纯增益层, 越界即弃用修订保原稿)。
// 与进化层 critique 的 overused/fixes 彻底隔离(品类污染防护): 本 pass 不读那边, 只用自家机检 + 本账本。
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";

export interface EditLedger {
  usedImages: Array<{ img: string; ch: number }>; // 近若干章用过的静物意象(滚动窗口, 跨章去重)
  signatureDetails: string[];                       // 标志性信物细节(系结法/碗豁口…), 全书去重用(预留)
  lints: Array<{ ch: number; similePerK: number; microPerK: number; settleRatio: number; pauseBeats: number; flagged: boolean; smilePerK?: number; givePerK?: number }>; // [Q5·协同审计] lint(draft·修订前)滚16章落盘: 进化可读的"制造量"账(W_clean 观察版数据源); smilePerK/givePerK=[修5·gentle-stakes]观察(旧账JSON向后兼容·cleanSignal只读自家四维不受影响)
  revisedDelta?: Array<{ ch: number; beforeLen: number; afterLen: number; dims: string[] }>; // [P0-1·干预四账③·蓝图 .audit/20260610-evolution-overhaul §3.1] reviseChapter 成功采纳修订时记: 修订前后净字数+触发的 lint 维名(滚64·按 ch 键确定性·遥测零行为)。预注册退休条款: 2卷无消费者即停写(蓝图P0-1)。
}

const FILE = "edit-ledger.json";
const IMG_WINDOW = 5; // 静物意象滚动窗口章数

export function loadEditLedger(dir: string): EditLedger {
  try {
    const d = JSON.parse(readFileSync(join(dir, FILE), "utf8")) as Partial<EditLedger>;
    return { usedImages: Array.isArray(d.usedImages) ? d.usedImages : [], signatureDetails: Array.isArray(d.signatureDetails) ? d.signatureDetails : [], lints: Array.isArray(d.lints) ? d.lints : [], revisedDelta: Array.isArray(d.revisedDelta) ? d.revisedDelta : [] }; // revisedDelta 显式带过(否则 load→save 回写会丢账)
  } catch { return { usedImages: [], signatureDetails: [], lints: [], revisedDelta: [] }; }
}
const atomicWrite = (file: string, data: string): void => { const tmp = file + ".tmp." + process.pid; writeFileSync(tmp, data, "utf8"); renameSync(tmp, file); }; // [档C②·原子写] 同目录 tmp+rename 防 torn-write→load 静默回空(蓝图 .audit/20260610-evolution-overhaul §3.2)
export function saveEditLedger(dir: string, l: EditLedger): void {
  try { atomicWrite(join(dir, FILE), JSON.stringify(l)); } catch { /* 非关键, 失败不阻断写章 */ }
}

// —— 词库(均来自对标研究实读引擎正文标出的病灶) ——
const SIMILE = /像|好像|仿佛|宛如|犹如|恰如|如同|似的|一般(?=[，。、；])/g; // 明喻标记(避开"如果/例如/一般人"等噪声)
const CLICHE = ["碎银", "一串丝线", "旧铜钱", "翻书页", "潮了的书", "化不开", "落在肩头", "一地碎"]; // 熟套喻黑名单(范文标配, 点名查杀)
const BODY_SIGNAL = ["胸口", "鼻子一酸", "鼻子酸", "心里痒", "手一顿", "手停", "心头一", "喉头", "眼眶"]; // 情绪身体信号(同一情绪只许落一次)
const STATIC_IMG = ["冰棱", "竹屑", "松针", "铜铃", "井绳", "腌萝卜", "灯骨", "竹牌", "炊烟", "落叶", "银杏", "水痕", "豁口", "草药", "药囊"]; // 静物意象(跨章去重 + 象征过劳候选)
const NO_RESP = /没(说话|抬头|接话|回头|应声|出声|言语|搭腔)/g; // "没X"留白族(全章 ≤2)
// —— AI 味专项词库(.audit/20260608-ai-tells·世界无关·阈值按好章校准·勿污染 STATIC_IMG) ——
const LQ = "“"; // 左引号: 区分纯叙述段与含对白段(实测各世界正文均用全角直引号)
const MICRO_ACT = /(拨了拨|捻了捻?|颠了颠?|磕了磕?|揩了揩?|虚拢|拢了拢?|理进|挪了半?寸|拽了拽|搁回|往.{0,2}推了推|推了推|叩了叩?|顿了顿|抹了一?把|甩了甩|舀了|拈起|垫着|往上托|绕了[两三]圈|打个?活?结|系回|揣进|续了些?|揭.{0,2}盖|摩挲)/g; // 症④过细工序动作(病例≈6.0/千字 vs 好章≤1.7)
const SETTLE_END = /(暗了|又暗|垂.{0,2}回去|停住|稳稳.{0,2}停|不动了?|没.{0,2}动|远了|散了|落下来?|洇开|淌下去|水渍|发白|碎光|聚拢|往里鼓|一响|响了一下|簌簌|渐.{0,3}息|尾音|霜)/; // 症①段尾环境缓冲收束
const PAUSE_BEAT = /(手|火光|水声|声音?|脚步|碗|汤|目光|火|帘子?|指节|喉结|嘴角)[^。，！？“”]{0,7}(停|顿|缩|远了又?近?|不动|没动)/g; // 症②停顿拍(主语+凝滞动词)
const PAUSE_END = /(停|顿|缩了|远了|不动|没动|静|沉默|一响|渐.{0,3}息)[。！？”…\s]*$/; // 症②段尾凝滞收束(容尾随标点, 否则"。"挡住 $)
const RESTRAINT = /(没急着|不急着|没多问|没问别的|没再问|没接话|没应声|没搭话|像是没听见|没掏出来|没吭声|没作声)/g; // 克制式叙述模板·纯否定族(盲测评测点名"没急着/没多问/没掏出来"高频=AI润色感; "只是X笑/点头"是温润正常笔法不收·shanju好章8次实证会误杀)
// —— gentle-stakes 观察信号(.audit/20260609-gentle-stakes·修5·全部 metrics-only 不设闸不入 fitness) ——
const GESTURE_TPL = /(笑了一下|笑了笑|笑了一声|微微一笑|嘴角[一-龥]{0,3}[弯扯翘]|看了[一两]眼|点了?点头|摇了?摇头|应了一声|嗯了一声)/g; // 微表情族(全族认证好章1.7/k vs 病例2.6/k分不开, 不设闸)
const SMILE_TPL = /(笑了一下|笑了笑|笑了一声|微微一笑|嘴角[一-龥]{0,3}[弯扯翘])/g; // 笑亚族(病例1.47/k vs 全语料≤0.52·n=1先观察; 转正条件: ≥3高AI味样本仍分得开才升directive, 永不入warm total)
const GIVE_TPL = /(塞给|塞进|塞过来|递过去|递给|分给|送[给了]|往外送|不收钱|不要钱|白给|帮[一-龥]{0,2}[忙着]|给[他她你您它])/g; // 给予密度(病例3.7/k=兄弟章2-4倍·测频率非代价·『给[他]』噪声大, 不设闸)

export interface LintResult {
  flagged: boolean;
  directives: string; // 给 LLM 的逐条问题清单
  dims: string[]; // [P0-1·四账③] 触发的 lint 维稳定名(与 issues 一一同序), 供 revisedDelta 记账(纯附加·不进 prompt)
  metrics: { similePerK: number; cliches: string[]; bodyRepeats: string[]; crossImgs: string[]; noResp: number; workingObj: string[]; explainTail: boolean; microPerK: number; settleRatio: number; pauseBeats: number; pauseEndRatio: number; restraint: number; gestureTpl: number; smilePerK: number; givePerK: number };
}

// 机检: 零 LLM, 正则/计数定位"用力过猛"。返回问题清单(喂 LLM)+ 量化指标(供日志/验证)。
export function lintChapter(text: string, ledger: EditLedger, n: number): LintResult {
  const body = text.replace(/^#.*$/m, "").trim();
  const chars = body.replace(/\s/g, "").length || 1;
  const paras = body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

  const similePerK = +(((body.match(SIMILE) || []).length) / chars * 1000).toFixed(1);
  const cliches = CLICHE.filter((c) => body.includes(c));
  const bodyRepeats = BODY_SIGNAL.filter((w) => (body.split(w).length - 1) >= 2);
  const recentImgs = new Set(ledger.usedImages.filter((u) => u.ch >= n - IMG_WINDOW && u.ch < n).map((u) => u.img));
  const crossImgs = STATIC_IMG.filter((g) => body.includes(g) && recentImgs.has(g));
  const noResp = (body.match(NO_RESP) || []).length;
  const workingObj = STATIC_IMG.filter((g) => (body.split(g).length - 1) >= 4);
  // AI 味三症机检(.audit/20260608-ai-tells): 症④过细动作 / 症①段尾器物缓冲 / 症②停顿拍节律(声口同腔=非聚合可判, 治本交 persona voiceCard 不在 lint 兜底)
  const microActs = (body.match(MICRO_ACT) || []).length;
  const microPerK = +(microActs / chars * 1000).toFixed(1);
  const narrParas = paras.filter((p) => !p.includes(LQ)); // 纯叙述段(无对白), 段尾缓冲/停顿只在叙述段量
  const settle = narrParas.filter((p) => SETTLE_END.test(p.slice(-Math.max(12, p.length / 3 | 0)))).length;
  const settleRatio = +(settle / (narrParas.length || 1)).toFixed(2);
  const pauseBeats = (body.match(PAUSE_BEAT) || []).length;
  const pauseEnd = narrParas.filter((p) => PAUSE_END.test(p.slice(-8))).length;
  const pauseEndRatio = +(pauseEnd / (narrParas.length || 1)).toFixed(2);
  const restraint = (body.match(RESTRAINT) || []).length; // 克制式模板计数
  const gestureTpl = (body.match(GESTURE_TPL) || []).length; // 修5: 微表情族(观察)
  const smilePerK = +(((body.match(SMILE_TPL) || []).length) / chars * 1000).toFixed(2); // 修5: 笑亚族/k(观察·修4触发指标)
  const givePerK = +(((body.match(GIVE_TPL) || []).length) / chars * 1000).toFixed(2); // 修5: 给予密度/k(观察·评测④代理)
  const lastPara = paras[paras.length - 1] ?? "";
  const explainTail = /(像|似的|仿佛|宛如|犹如|如同)[^。！？\n]{0,20}(意|情|愁|思|念|寂寞|孤|痛|苦|甜|暖意|空落|沉默|眼睛|要说)/.test(lastPara)
    || /(这东西|这名声|这世道|人生|谁不是|不就是|原来都是|到底是)[^。\n]{0,26}[。…？]?\s*$/.test(lastPara);

  const issues: string[] = [];
  const dims: string[] = []; // [P0-1·四账③] 与 issues 同步收集的维名(稳定标识, 供 revisedDelta)
  const flag = (dim: string, msg: string): void => { dims.push(dim); issues.push(msg); };
  if (similePerK > 4) flag("simile",`比喻过密(本章明喻≈${similePerK}/千字, 目标≤4): 删"为美而美"与"像…接一句情绪解说"的复合句; 连续两个物象不要都带比喻; 但"为看清事物"的精确比喻要保留。`);
  if (cliches.length) flag("cliche", `熟套喻(范文标配·一出现就隔一层, 必删或换新喻体): ${cliches.join("、")}。`);
  if (bodyRepeats.length) flag("bodyRepeat", `情绪反复翻译(同一身体信号在本章重复出现): ${bodyRepeats.join("、")}——每个情绪只保留第一次的身体信号, 删掉后文反复回到同一处("胸口那个地方…")的心理回环句。`);
  if (crossImgs.length) flag("crossImg", `跨章意象复读(近${IMG_WINDOW}章已反复用过): ${crossImgs.join("、")}——本章换一个载体, 别再写同一件静物。`);
  if (noResp > 2) flag("noResp", `留白动作滥用("没说话/没抬头/没回头"族出现 ${noResp} 次, 全章应 ≤2): 删到 ≤2 处, 其余改为具体动作或直接略去。`);
  if (workingObj.length) flag("workingObj", `象征过劳(一件物被反复回指扛主题): ${workingObj.join("、")}——拆掉部分回指、让它退回普通物件; 并保留至少一处不承担任何象征的纯闲笔。`);
  // —— AI 味三症(.audit/20260608-ai-tells·阈值按好章实测校准防误杀: 病例命中 vs renjian/shanju 好章静默) ——
  if (microPerK >= 3.0 && microActs >= 10) flag("micro", `过细小动作堆叠(全章"拨火/搁回/推了推/顿了顿/揣进/磕碗"类零碎手部活≈${microActs}处, 每千字${microPerK}, 好章≤1.7——把过场和铺垫写得过细、张力被稀释): 【这是本章首要问题·优先处理】过场要快, 把递物/收物/拨火这类铺垫动作压短或略去, 删掉至少三分之一的这类工序小动作; 笔墨集中到核心事件(重逢、交换药材、旧恩点破)上, 不把一个小动作分解成"伸手—碰—停—搁", 也不要细描某人"搁东西/收物的习惯"。本章问题多删不过来时, 宁可少删比喻、也要把工序小动作删够——只削比喻不削微动等于没治本。`);
  if (settleRatio >= 0.12) flag("settle", `器物缓冲成例(${(settleRatio * 100 | 0)}% 叙述段都以"环境白描+一个微动(暗了/远了/垂回去/一响)"收尾, 把情绪缓冲掉——成机械套路): 删掉至少一半这类段末缓冲, 让部分段直接收在人物动作或话里; 器物全章克制反复回扣一两件(那只碗、那截甘草), 不必每段端出新物。`);
  if (pauseBeats >= 6) flag("pause", `停顿拍反复(全章"X停了/顿了/缩了/远了"类凝滞收束≈${pauseBeats}次, 有气氛但重复后机械): 保留最有分量的两三处, 其余删或改为继续动作; 让节奏不规整、容得下突兀的短句、不收在停顿上的段; 不必每个情绪都用"手停/火光缩/声远了"镇一下。`);
  if (pauseEndRatio >= 0.06) flag("pauseEnd", `段落节律太规整(段段近乎"动作→环境→对话→一个停顿"同一模板): 打破规整——有的段用一句短促的话收, 有的段一笔带过不停顿, 让长短句错落、有人写长篇的不规则瑕疵感。`);
  // restraint(克制式模板)只记 metrics 不进 directives: 实测纯否定族在认证好章 shanju/ch3 也 8 次=温润 house style, 章级阈值分不开好坏(huolang ch1=9 vs 好章8, n=1 校准=过拟合)→ 删改交不得, 治理走生成端 PENMANSHIP 软引导 + 此处观察趋势。

  return { flagged: issues.length > 0, directives: issues.map((s, i) => `${i + 1}. ${s}`).join("\n"), dims, metrics: { similePerK, cliches, bodyRepeats, crossImgs, noResp, workingObj, explainTail, microPerK, settleRatio, pauseBeats, pauseEndRatio, restraint, gestureTpl, smilePerK, givePerK } };
}

// 减法重写 prompt: 只删不增, 死守"该保住"4 条(防把好比喻/好白描误删)。
export function buildRevisePrompt(sys: string, text: string, lint: LintResult): string {
  return `${sys}
【任务·章后精修(只做减法)】下面是一章温润向小说正文。它整体是合格的、有疏淡味的, 但有几处"用力过猛"需要修剪。按下面【问题清单】逐条修订。

修订铁律:
— 只删不增: 不得新增任何比喻、情绪解说、点题句; 修订后总字数只减不增。
— 不动情节、对白内容、人物、时间地点与既定事实, 只精修语言表层的"过"。
— 必须保住这四样(它们是本文的优点, 误删即判失败): ①物理细节的"准"(触觉/听觉/温湿度的精确白描, 例如"像握一条鱼的脊背"这类"为看清事物"的好比喻, 留); ②以动作代抒情(不靠心理独白), 但动作贵精不贵多、工序性小动作(递物/收物/拨火/整理)可删; ③以物代情(器物承载关系, 如把草药放在井沿不递); ④留白式收尾(悬而不落、不点题)。
— 拿不准就少删: 宁可留, 不可把疏淡改成干瘪。

【问题清单】
${lint.directives}

【待修订正文】
${text}

只输出修订后的完整正文, 不要加任何说明、不要加章节标题。`;
}

// 四道确定性闸: 改过头 → 弃用修订、回退原稿(纯增益层可丢弃)。mustKeep=[Q7·协同审计] 本章 sim 大事主语(陨落/飞升/灭派/了仇), 修订不得删没=正史保真。
export function passesGuards(draft: string, revised: string, canonHard: string, mustKeep: string[] = []): { ok: boolean; reason: string } {
  const dn = draft.replace(/\s/g, "").length, rn = revised.replace(/\s/g, "").length;
  if (rn < 200) return { ok: false, reason: "修订过短(疑似 LLM 抽风回退占位)" };
  if (rn < dn * 0.85) return { ok: false, reason: `长度地板: 删过头(${rn}/${dn}=${(rn / dn).toFixed(2)}<0.85)` };
  const dlgD = dialoguePerK(draft), dlgR = dialoguePerK(revised);
  if (Math.abs(dlgR - dlgD) > 2.5) return { ok: false, reason: `留白地板: 对话密度漂移过大(${dlgD}→${dlgR}), 疑似改写动了结构` };
  // 一致性地板: 本章用到的 canonHard 硬词(人名/境界/恩怨)不得在修订里整体消失
  const hardTerms = new Set((canonHard.match(/[一-龥]{2,4}/g) || []).filter((t) => draft.includes(t)));
  if (hardTerms.size >= 3) {
    let dropped = 0; hardTerms.forEach((t) => { if (!revised.includes(t)) dropped++; });
    if (dropped > hardTerms.size * 0.25) return { ok: false, reason: `一致性地板: 修订丢了硬事实词 ${dropped}/${hardTerms.size}(>25%)` };
  }
  for (const k of mustKeep) if (k && draft.includes(k) && !revised.includes(k)) return { ok: false, reason: `正史闸: 修订丢了本章大事主语「${k}」` }; // [Q7] 第四闸: 防减法把陨落/飞升/灭派当冗余删掉(sim 正史保真)
  return { ok: true, reason: "" };
}
function dialoguePerK(text: string): number {
  const chars = text.replace(/\s/g, "").length || 1;
  const dlg = (text.match(/[“"][^”"]*?[”"]|[「『][^」』]*?[」』]/g) || []).length;
  return +(dlg / chars * 1000).toFixed(1);
}

// 章落定后更新账本: 记录本章实际用到的静物意象(供后续跨章去重)。滚动窗口、按 ch 号(不用时间戳)→ resume 安全。
export function updateEditLedger(ledger: EditLedger, text: string, n: number): EditLedger {
  const body = text.replace(/\s/g, "");
  const fresh = STATIC_IMG.filter((g) => body.includes(g)).map((img) => ({ img, ch: n }));
  const usedImages = [...ledger.usedImages.filter((u) => u.ch > n - IMG_WINDOW - 1 && u.ch !== n), ...fresh];
  return { ...ledger, usedImages };
}
