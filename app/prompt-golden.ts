// app/prompt-golden.ts — [档C①·模板可测化·蓝图 .audit/20260610-evolution-overhaul §3.2] golden 逐字节回归
// 跑法: npx tsx app/prompt-golden.ts (全过输出 GOLDEN ALL PASS; 任一失配打印首个差异字节并退出非零)
// 断言什么: app/longrun.ts 抽出的纯函数 buildOutlinePrompt/buildSecPrompt 与【重构前原内联模板表达式】
//   (下方 legacyOutlinePrompt/legacySecPrompt 的模板字面量 = 2026-06-10 重构当时从备份 /tmp/longrun-before-a5.ts
//    逐字节抠出并机器核验过的拷贝; 解构只是把同名变量带回词法作用域, 求值语义与原 writeChapter 内联处一致)
//   在同一 ctx 下求值, 产物逐字节(Buffer)相同。模板文本是治理冻结资产: 今后任何人改 longrun 里的模板, 本测试即红。
// 纪律: fixture 全固定字面量·零 Math.random/Date.now; NOVEL_PROMPT_GOLDEN=1 令 longrun 导入时跳过主循环;
//   NOVEL_SAGA_DIR=prompt-golden-scratch 把 longrun 模块级文件副作用(锁/db/目录)隔离进临时世界目录, 跑完即删。
import { rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import type { OutlinePromptCtx, SecPromptCtx } from "./longrun";

process.env["NOVEL_PROMPT_GOLDEN"] = "1"; // longrun 末尾守卫: 导入不起写者主循环
process.env["NOVEL_SAGA_DIR"] = "prompt-golden-scratch"; // 模块级副作用(锁/db/chapters 目录)全进临时世界目录
const scratch = join(dirname(fileURLToPath(import.meta.url)), "..", ".novel-output", "prompt-golden-scratch");
rmSync(scratch, { recursive: true, force: true }); // 净跑: 防上回残留锁文件让 longrun 误判已有写者而 exit(0) 假绿

const { buildOutlinePrompt, buildSecPrompt } = await import("./longrun");

// ── legacy: 重构前两段模板的逐字节拷贝(禁改; 与 buildXxx 的唯一差别=变量经解构而非 ctx. 前缀) ──
function legacyOutlinePrompt(ctx: OutlinePromptCtx): string {
  const { sys, n, vol, scene, situAnchor, crisis, bible, ros, prevHook, forbid, gdDomain, sceneAvoid, weave, outlineBeat, obedience, arcHint, GENTLE, SECTIONS } = ctx;
  const beatSpec = GENTLE
    ? `列出本章 ${SECTIONS} 个叙事节拍(每个≤20字)：首拍由上章余韵自然承接；节拍可是一次相遇或对话的展开、一段心境或回忆的流转、一程行脚或一桩寻常事的经过、一桩小为难或一个要付一点小代价的选择，前后气脉相承、连贯不跳，不必每拍生新冲突；但每拍过后须留下一样带得走的东西（一句应承、一份欠情、一桩新知道的事、一个没说出口的念头），后拍须用到前拍留下的东西——节拍打乱重排便不成立，才算连贯；${SECTIONS} 拍中至少一拍须有一点不顺：一样想要而未全得的东西、一次小失手、一回不对等的人情推让、一笔叫人心疼的小账——温情的张力来自人心微澜与人情推拉，不来自打斗危机，其余拍照旧温润；同类小事（同一货品的买卖、同样的赠收）一章至多一回，若再现，第二回必须出岔子或变了意思，不得原样重演；但全章不可困守一处一物——须有人事、场景或时令的自然流动（一次出门、一个来客、一段路、一场天时之变都好），少让主角独对同一件旧物反复出神；多写人来人往与世态人情、人物自己的小算盘与取舍，而非只作旁观；${outlineBeat ? "本阶段内主角处境宜较阶段开端有所挪移(多识一人、多走一程、道行或心境长进一分、近一桩牵念)、顺这条人生主线缓缓向前；不必每章都动、容得下纯质感的呼吸章；这一步绝不靠任何冲突/争斗/危机/失去来体现、" : ""}末拍以一个安静的画面或一点余味收束、不必留硬悬念，但容得下一桩未尽之事、一位将至之客、一句没说完的话作余韵的软钩。全章须有一处稍密或稍疾的段落(一段世俗白描信息密些、或一句短促的话、一桩骤来的小事)与通篇舒缓相对位、勿全程一个速度。只列 ${SECTIONS} 行节拍。`
    : `列出本章 ${SECTIONS} 个情节节拍(每个≤20字)：首拍由上章钩子直接引发；每拍须是前一拍的直接后果(因果相承"因→果→再生变"，不得并列罗列)；${outlineBeat ? "在推进上述大纲主线的前提下" : `在"当前情境"内`}生新事件/冲突/转折；末拍留引向下章的悬念。只列 ${SECTIONS} 行节拍。`;
  return `${sys}\n【连载第${n}章·第${vol}卷】\n【当前情境】${scene}${GENTLE && situAnchor ? `\n【当前处境·机读锚(以此为准勿漂移)】${situAnchor}` : ""}\n【当前世界大事】${crisis || "暂无"}\n【前情纲要】${bible}\n【在场(含亲疏)】${ros}\n【上章末钩子】${prevHook || "（开篇）"}\n【最近章节标题——严禁雷同、严禁重演开篇灵根试炼】${forbid}${GENTLE ? (gdDomain ? `\n【本章场景·须切换·要紧】本章主场景须离开【${sceneAvoid}】(同一处室内/同一旧物特写)，转到【${gdDomain}】：把镜头挪到那里的人事往来与世态人情。节拍仍温润连贯、章末留余味，只换舞台不跳冲突。` : `\n【温情·场景须流动·要紧】温情绝不等于停滞。审视上面近几章标题：若总绕在同一处（如灶房、院中、同一只碗/灶火/旧物旁），本章必须把镜头挪开——换一处地点（出门赶集、访友、上山下山、渡口、田间水边、别人家、远行途中、市集庙会），或推进季候天时（晴雨更替、节气流转、晨昏交接），或让一个新面孔自然进入（行脚僧、求医人、孩童、归乡客、远来故人）。宁可写人来人往、世态流动，也不要让主角又一次独对同一件旧物出神。`) : ""}${weave ? `\n【本章叙事任务·须落实】${weave}` : ""}${outlineBeat ? (obedience === "balanced" ? `\n【本章大纲主线·建议方向】${outlineBeat} —— 优先顺势推进这条主线；但世界若自发涌现变数/冲突，可顺其自然地偏离，不必硬贴。` : `\n【本章须遵循的大纲主线·最要紧】${outlineBeat} —— 你列的 ${SECTIONS} 个节拍必须服务于推进这条主线、顺着它走，不可跑偏到别处情节。`) : ""}${n === 1 && arcHint ? "\n【开篇·in-medias-res·要紧】" + arcHint : ""}\n${beatSpec}`;
}
function legacySecPrompt(ctx: SecPromptCtx, i: number, last: boolean): string {
  const { sys, n, goal, vol, scene, ambience, crisis, ros, text, prev, beats, covered, metNames, metRoles, seenPlaces, weave, sceneAvoid, recentImgs, loreBlock, canonHard, canonInject, conBlock, evoGuidance, voiceCard, secBudget, wrote, perSec, GENTLE, FULLCTX, SECTIONS, MINLEN, PENMANSHIP } = ctx;
  return `${sys}\n【第${n}章${goal ? `《${goal}》` : ""}·第${vol}卷·情境：${scene}】${GENTLE && ambience ? `\n【本章风物背景】${ambience}` : ""}\n【当前世界大事】${crisis || "暂无"}\n【在场角色及修为】${ros}\n【${FULLCTX ? "本章已写正文·从头至此（它是事实依据：接续其情节人物时序，但勿照抄其句子、比喻与措辞——同样的意思换说法）" : "上文结尾"}】${(FULLCTX ? text.slice(-6000) : prev.slice(GENTLE ? -480 : -280)) || "（本章开篇，承接上一章）"}${GENTLE ? `\n【本章节拍全景】${beats.map((b, k) => `${k + 1}.${b}${k < i ? "(已写)" : k === i ? "(本段)" : "(留待后段勿提前)"}`).join(" ")}` : ""}${GENTLE && covered.length ? `\n【本章已写之事·最要紧·绝不重写】${covered.join("；")}；已出场：${[...metNames].join("、") || "—"}${metRoles.size ? `；已遇(未具名)：${[...metRoles].join("、")}` : ""}${seenPlaces.size ? `；已到过：${[...seenPlaces].join("、")}` : ""}。以上均已发生：本段只能向前续写，不得另起一个版本重写开头或离开/动身的场景，已出场者——包括上列未具名者——不得再次以生人引入或重问来历身份，再相逢须接续前话；已到过之处同章再去须交代缘由、不作初到写法；同一日时序只进不退，不得章中途另起一日重述昨日之约；所在地须顺上文连续、不得无故折返起点。` : ""}\n续写本章第${i + 1}/${SECTIONS}段，对应情节：「${beats[i]}」。${weave && i === Math.min(1, SECTIONS - 1) ? `本段须自然落实：${weave}。` : ""}须由上段结果直接引发、承接因果，各角色言行暗合其命格性情。${GENTLE && sceneAvoid ? `\n本段须把镜头放在新场景里的人来人往，勿回到【${sceneAvoid}】。` : ""}${GENTLE && recentImgs.length ? `\n【近5章已用过的静物意象——本章换载体勿复用(章内既有信物回扣不限)】${recentImgs.join("、")}` : ""}\n${PENMANSHIP}${GENTLE && voiceCard ? "\n" + voiceCard : ""}${canonHard ? "\n" + canonHard : ""}${(!GENTLE || i === 0 || last) && loreBlock ? "\n" + loreBlock : ""}${(!GENTLE || i === 0 || last) && canonInject ? "\n" + canonInject : ""}${(!GENTLE || i === 0 || last) && conBlock ? "\n" + conBlock : ""}${(!GENTLE || i === 0 || last) && evoGuidance ? "\n" + evoGuidance : ""}\n${GENTLE ? `${Math.round(secBudget * 0.55)}至${secBudget}字之间、写到从容即收${wrote >= MINLEN * 1.2 ? "——全章篇幅已足，本段务必短小、把本拍写完即收" : ""}（温情·宁短勿堆：够把这一段一件事写从容即可便收笔，不为凑字数往段里堆物象、感官与多重从句；一段只写一件事、不叠第二件事或多个新人新景）` : `约 ${perSec} 字`}。${last ? (GENTLE ? "段末以一点余味自然收束、不必强留悬念；但余味不要总落在静物停寂或一声渐息上，可以是一点暖意、一句寻常的人语、一个将启的明天、或一处微微敞开引人向往的画面——换着来，别每章都收在同一种静止里。且收在物象或动作处即止，不在其后再补一句『像……(情绪或抽象词)』那样的明喻或点题、议论。" : "段末留一个引向下一章的悬念钩子。") : ""}只输出正文，不要写任何章节标题或"第X章"字样。`;
}

// ── fixtures: 8 组固定 ctx, 覆盖 GENTLE真/假 × 首/中/末段(每组遍历全部段) × covered空/非空 × FULLCTX开/关 × weave有/无 × gdDomain有/无 ──
type FullCtx = OutlinePromptCtx & SecPromptCtx;
const base = (): FullCtx => ({
  sys: "你是一位修仙小说作者。",
  n: 12,
  vol: 1,
  scene: "坊市风波，卷入宗门间的明争暗斗",
  situAnchor: "",
  crisis: "魔道窥伺青云 ｜ 奇门·休门吉",
  bible: "青云宗四子命数交汇，各入门墙。",
  ros: "苏雪(冰·练气三层@青云坊市)、林焰(火·练气四层)",
  prevHook: "洞府石门后传来异响",
  forbid: "第10章「夜探坊市」、第11章「灯下故人」",
  gdDomain: "",
  sceneAvoid: "",
  weave: "",
  outlineBeat: "",
  obedience: "strict",
  arcHint: "",
  GENTLE: false,
  SECTIONS: 4,
  goal: "坊市惊变",
  ambience: "",
  text: "",
  prev: "",
  beats: ["主角入坊市遇旧识", "旧识引出宗门秘辛", "秘辛牵动各方暗流", "暗流之中杀机乍现"],
  covered: [],
  metNames: new Set<string>(),
  metRoles: new Set<string>(),
  seenPlaces: new Set<string>(),
  recentImgs: [],
  loreBlock: "",
  canonHard: "",
  canonInject: "",
  conBlock: "",
  evoGuidance: "",
  voiceCard: "",
  secBudget: 900,
  wrote: 0,
  perSec: 900,
  FULLCTX: false,
  MINLEN: 3000,
  PENMANSHIP: "【笔法·要紧】文字干净利落、节奏明快：多用动词与短句。",
});
const fixtures: Array<{ name: string; ctx: FullCtx }> = [
  { name: "F1 爽文基线·weave无·gdDomain无·covered空·FULLCTX关·crisis空·prev空(开篇fallback)", ctx: { ...base(), crisis: "", prev: "" } },
  { name: "F2 爽文·weave有·大纲strict·n=1+arcHint·prevHook空·covered非空(GENTLE假应被抑制)·注入块全非空", ctx: { ...base(), n: 1, arcHint: "世界已暗中发展一段，眼下正值：宗门大比前夜。", weave: "回收伏笔——给出回应或揭其真相：『故人之约』", outlineBeat: "主角初入宗门、立足坊市", obedience: "strict", prevHook: "", prev: "林焰握紧了剑。", goal: "大比前夜", wrote: 1200, covered: ["第1段已写：他进了坊市…到了灯下"], metNames: new Set(["苏雪"]), loreBlock: "【设定】青云坊市内禁飞遁。", canonHard: "【硬事实】林焰·练气四层。", canonInject: "【既立软设定】坊市灯会每旬一次。", conBlock: "【世界铁律】灵石不可伪造。", evoGuidance: "【进化指引】少用比喻。", voiceCard: "【在场声口】苏雪：清冷少言。" } },
  { name: "F3 温润·gdDomain有·covered空·weave有·balanced大纲·题延后goal空·注入块/声口/近章意象/处境锚全非空", ctx: { ...base(), GENTLE: true, gdDomain: "渡口集市", sceneAvoid: "灶房", ambience: "梅雨初歇，溪水新涨", situAnchor: "身在临水村；身份：药铺帮工", weave: "一桩旧欠须自然落实", outlineBeat: "随师下山行医一程", obedience: "balanced", goal: "", scene: "临水村安身，市集初开", beats: ["晨起赶集逢旧识", "旧识捎来山中口信", "口信牵出一桩旧欠", "暮归途中心事渐定"], recentImgs: ["铜壶", "旧蓑衣"], voiceCard: "【在场声口】阿芜：软糯爱笑。", canonHard: "【硬事实】虚谷·尚未入炼气。", loreBlock: "【设定】临水村渡口逢双日有集。", canonInject: "【既立软设定】药铺东家姓秦。", conBlock: "【世界铁律】凡人不可窥仙缘。", evoGuidance: "【发扬】对白见性情。", prev: "她把伞收了，立在檐下。", wrote: 800, secBudget: 700 } },
  { name: "F4 温润·gdDomain无(场景须流动支)·covered非空·metNames空(—支)·weave无·大纲空·注入块全空", ctx: { ...base(), GENTLE: true, goal: "", scene: "山居岁月，邻里往来", beats: ["晨起担水遇邻翁", "邻翁托带一包种子", "种子引出节令闲谈", "日落收工心境安然"], covered: ["第1段已写：晨起担水…院门半掩", "第2段已写：来客落座…话未说尽"], prev: "他把碗搁下了。", wrote: 1600, secBudget: 650 } },
  { name: "F5 温润·FULLCTX开(text>6000截尾)·covered非空·metNames/metRoles/seenPlaces非空", ctx: { ...base(), GENTLE: true, FULLCTX: true, goal: "", scene: "行脚途中，借宿何家", beats: ["投宿何家逢夜雨", "灶下闲话识人情", "雨歇庭前别旧客", "再上路时天色新"], text: "前文起头。" + "长".repeat(6200) + "——以上为已写正文之末。", prev: "（FULLCTX 下不该被采用）", covered: ["第1段已写：夜雨叩门…主家点灯", "已点名求购/售卖过【伞】——后文段落不得再写它的第二次完整成交"], metNames: new Set(["虚谷", "阿芜"]), metRoles: new Set(["老修士", "货郎"]), seenPlaces: new Set(["何家", "渡口"]), wrote: 2500, secBudget: 600 } },
  { name: "F6 温润·SECTIONS=3·wrote超限(≥1.2×MINLEN)·weave有(i=1落实)·covered非空·末段余味", ctx: { ...base(), GENTLE: true, SECTIONS: 3, goal: "", scene: "秋收前后，谷场往来", beats: ["谷场借斗起小误会", "误会化开互留一诺", "夜静检点心头一暖"], weave: "把一句托付自然落实", covered: ["第1段已写：借斗的人来了…话头一岔"], prev: "斗还在他手里。", wrote: 3700, secBudget: 350 } },
  { name: "F7 爽文·FULLCTX开·SECTIONS=2·weave有(i=1落实)·covered非空(GENTLE假应被抑制)", ctx: { ...base(), FULLCTX: true, SECTIONS: 2, goal: "双骄会猎", scene: "古秘境开启，四子结伴探宝", beats: ["秘境初开各显神通", "宝光深处暗流对撞"], weave: "自然埋下一个伏笔(只露端倪、勿点破)：『青铜小鼎』", text: "短正文，不足六千字。", prev: "鼎光一闪而没。", covered: ["第1段已写：x"], crisis: "宗门大比 ｜ 奇门·景门", wrote: 1100 } },
  { name: "F8 温润·n=1但arcHint空(块不出)·prevHook空·prev非空(尾窗-480)·ambience/sceneAvoid空·大纲balanced", ctx: { ...base(), GENTLE: true, n: 1, prevHook: "", goal: "", scene: "初到山村，安顿身心", beats: ["卸担入院识邻里", "灶冷开火借一灯", "灯下闲话知乡俗", "夜半听雨意渐安"], outlineBeat: "安顿身心、识得邻里", obedience: "balanced", crisis: "山雨欲来 ｜ 奇门·开门", prev: "廊下的灯还亮着，他没有去吹。", wrote: 400, secBudget: 800 } },
];

// ── 逐字节断言(Buffer 级) ──
let assertions = 0;
const sha8 = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 8);
function assertBytes(label: string, legacy: string, fresh: string): void {
  const a = Buffer.from(legacy, "utf8");
  const b = Buffer.from(fresh, "utf8");
  if (!a.equals(b)) {
    let off = 0;
    const min = Math.min(a.length, b.length);
    while (off < min && a[off] === b[off]) off++;
    console.error("✗ " + label + ": 逐字节失配 @byte " + off + " (legacy " + a.length + "B vs new " + b.length + "B)");
    console.error("  legacy…" + a.subarray(Math.max(0, off - 60), off + 60).toString("utf8") + "…"); // 按字节窗取上下文(CJK 下字符串下标≠字节偏移)
    console.error("  new   …" + b.subarray(Math.max(0, off - 60), off + 60).toString("utf8") + "…");
    rmSync(scratch, { recursive: true, force: true });
    process.exit(1);
  }
  assertions++;
}

for (const { name, ctx } of fixtures) {
  const lo = legacyOutlinePrompt(ctx);
  assertBytes(name + " · outline", lo, buildOutlinePrompt(ctx));
  const secShas: string[] = [];
  for (let i = 0; i < ctx.beats.length; i++) {
    const last = i === ctx.beats.length - 1;
    const ls = legacySecPrompt(ctx, i, last);
    assertBytes(name + " · sec[" + i + "]" + (last ? "(末)" : i === 0 ? "(首)" : "(中)"), ls, buildSecPrompt(ctx, i, last));
    secShas.push(sha8(ls));
  }
  console.log("✓ " + name + "\n  outline " + lo.length + " 字 sha:" + sha8(lo) + " · sec×" + ctx.beats.length + " sha:[" + secShas.join(" ") + "]");
}

rmSync(scratch, { recursive: true, force: true }); // 清理临时世界目录(锁随本进程退出自行释放)
console.log("\nGOLDEN ALL PASS — " + assertions + " 个逐字节断言全过(outline×" + fixtures.length + " + sec×" + (assertions - fixtures.length) + ")");
