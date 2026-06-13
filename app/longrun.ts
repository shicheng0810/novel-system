// app/longrun.ts v2 — 千章长篇连载引擎(修评估问题 + 每章 ≥3000 字)
//   · 情境推进: 故事局面随章/卷前进(破"开篇重写N遍"循环)
//   · 多段成章: 列节拍 → 分段续写 → ≥3000 字
//   · 防重复: 禁与近 6 章雷同, 每章须有新事件/地点/冲突
//   · 控战力崩坏: 36 级阶梯 + 慢进 + 仅卷末批准突破
//   · 可断点续写(文件 DB + 每章落盘) → 适合 hermes/nohup 长跑
// 环境: NOVEL_TARGET=1000  NOVEL_MINLEN=3000  NOVEL_SECTIONS=4  NOVEL_LIVE_LLM=hermes
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync, statSync, renameSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openDb } from "../core/services/db";
import { MockLLM, type LLMProvider } from "../core/services/llm";
import { makeLLM, configSignature } from "./llm-factory";
import * as store from "../core/services/store";
import { step } from "../core/runtime/world-actor";
import { PACK, natalLabel, goalLabel, plateLabel } from "./pack-select";
import { loadOutlinePlan, beatForChapter, beatObjForChapter } from "./outline-plan";
import { loadPL, savePL, nextProgressTask, beatSig, advanceStep, arcMilestonesFromPlan, type ProgressLedger } from "./progression-ledger"; // T2 温情进展账本+防拍子循环(处境维 ground truth; 仅 GENTLE, 爽文 null 零变更)
import { gentleEmergence, renderEmergence } from "./gentle-emergence"; // T2' 涌现际遇摄入(抽结构事实, 邀请式注入 weave; 仅 GENTLE)
import { loadLore, recallLore } from "./lore-lib";
import { pickArcStart } from "./arc-select";
import { loadGenome, loadLedger, buildGuidance, evolveOnce, loadGlobal, saveGenome, type Genome } from "./evolve"; // saveGenome/Genome=trial-verdict 幂等采纳用(蓝图§4.2·NOVEL_TRIAL gated)
import { hashStr } from "../core/util/rng"; // FNV-1a(确定性·禁 Math.random/Date.now): trial-request incumbent/候选 genome hash
import { computeSimFitness, saveSimFitness, loadSimFitness } from "./sim-fitness";
import { loadGD, saveGD, gentleDirect, motifSig, type SceneShift } from "./gentle-director"; // T2 温情变化驱动器(纯符号场景轮换)。classifyMotif 在 gentle-director 内部用、longrun 直接读 sh.avoidClass, 故不导入
import { computeWarmFit, saveWarmFit } from "./warm-fitness"; // T3 温情专属 fitness(loadWarmFit 在 evolve.ts 折进基因, longrun 只算+存)
import { dramaControl, loadDrama, saveDrama } from "./drama";
import { evolveSimRules, loadSimRules } from "./sim-rules";
import { personaBlock, recallShared, INNER_CN, voiceCardBlock } from "./persona";
import { deriveCanon, derivedBlock, derivedFacts } from "./derive-canon";
import { loadMinds, saveMinds, accrueImportance, selectQueue, batchReflect, situationFp } from "./minds";
import { loadConstraints, constraintsBlock, proposeConstraintMutation, saveConstraints } from "./constraints"; // saveConstraints 仅用于 [P1-4] 给 pending 提案补 triggerBasis 遥测字段(不碰 accept 路径)
import { canonStep, canonBlock, loadCanon, saveCanon } from "./canon";
import { loadEditLedger, saveEditLedger, lintChapter, buildRevisePrompt, passesGuards, updateEditLedger } from "./edit-ledger"; // 章后精修 pass(仅 GENTLE): 机检定位"用力过猛"→LLM 只做减法→三道闸守门
import { lintSeams, tradeAskedItems, extractRolesPlaces, echoLint, d13DedupSecond } from "./lint-seams"; // 症⑤拼接病检测(零LLM·仅GENTLE): 结构病只记日志(治本=生成端跨段已写账), 表层项(单物过劳/市井堆/套语对)并入减法 directives; tradeAskedItems=[修3b]同物二卖已写账; extractRolesPlaces=[竹光窄处修]未具名角色/地点入账(老修士×2/何家×2盲区)
import type { WorldSnapshot, CharacterState } from "../core/domain/world";

const TARGET = Number(process.env["NOVEL_TARGET"] ?? 1000);
const MINLEN = Number(process.env["NOVEL_MINLEN"] ?? 3000);
const SECTIONS = Number(process.env["NOVEL_SECTIONS"] ?? 4);
const WARMUP = Number(process.env["NOVEL_WARMUP"] ?? 0); // 世界预演化: 起跑前静默推演 N tick(不出章)再写第 1 章, 让关系/恩怨/派系成形(StoryBox 实证: 先模拟提升人物/冲突)。0=快起笔(创世即写)
// 笔法风格: 默认爽文向(明快短句); NOVEL_STYLE=温润 切到温情/文学向(留白、舒缓、重内心与余味) —— 温情向/启发向世界用, 不被默认的明快爽利指令带跑。
// [P2-2 模板层进化·2026-06-11·用户「启动模板层」] 槽位外置: NOVEL_TPL_FILE 指向变体JSON({槽名:替换文本}); 缺省=字面量(golden逐字节同=零行为变更)。
//   白名单槽位防进化之手摸裁判: 检测器/canon硬约束/标题闸/voiceCard结构永不外置; 变体=runner臂对照·过双门·人签转正·registry立户。首槽=endGentle(章末余味收束句·settleRatio/similePerK直接可测)。
const TPL_DEFAULT: Record<string, string> = {
  penRestraint: "【克制从内容来】含蓄克制贵在写了什么、没说什么，而不靠『没急着/没多问/没接话/没吭声』这几个固定句式反复造含蓄——全章这类否定式克制句以两三处为度，其余处让人物直接动、直接答。",
  penDensity: "【疏密相间·要紧·降信息密度】全章须有疏有密、忌每段都是密集的微距静物与感官特写堆叠（读着会累）：浓墨细描的段落之后，接几段疏朗的纯对话或纯动作给读者喘息；一段只写一件事、写透它，不在同段叠第二件事或第二个新人、新景；以物载情贵在精不贵频：全章至多一两件信物，同一件物被摸/按/把玩以全章两三处为度——本段至多写它一次，上文若已特写过它、本段宁可不提；回扣是点睛，不是节拍器，也不必每段都端出新器物；克制每段的器物与感官细节总量，容得下不上静物特写的低密度段落；新出场的人不必一来就交代其满身道具与全部身世，先坐实再慢慢显；对白重言外之意、一句别塞进多条事实；宁可写短、把一件事写从容即收，不为凑字数往段里堆物象、感官与多重从句。",
  secBudgetGentle: "（温情·宁短勿堆：够把这一段一件事写从容即可便收笔，不为凑字数往段里堆物象、感官与多重从句；一段只写一件事、不叠第二件事或多个新人新景）",
  endGentle: "段末以一点余味自然收束、不必强留悬念；但余味不要总落在静物停寂或一声渐息上，可以是一点暖意、一句寻常的人语、一个将启的明天、或一处微微敞开引人向往的画面——换着来，别每章都收在同一种静止里。且收在物象或动作处即止，不在其后再补一句『像……(情绪或抽象词)』那样的明喻或点题、议论。",
};
const TPL: Record<string, string> = (() => { try { const f = process.env["NOVEL_TPL_FILE"]; if (!f) return TPL_DEFAULT; return { ...TPL_DEFAULT, ...(JSON.parse(readFileSync(f, "utf8")) as Record<string, string>) }; } catch { return TPL_DEFAULT; } })();
const PENMANSHIP = process.env["NOVEL_STYLE"] === "温润"
  ? `【笔法·要紧】笔调温润、克制、有留白与回味：容得下环境、细节与内心的细腻铺陈，不必处处明快短促；以具体的人间烟火细节承载情感、不喊口号、不滥煽情；对白自然，可有寒暄、欲言又止与言外之意；节奏舒缓有韵、重在触动余味与启发，而非爽利推进。仍须干净、不无谓注水，避免"仿佛/似乎/宛如"之类空泛模糊词。\n${TPL["penDensity"]}【简净·白描驱动】多用事实白描、名词与动词扛节奏；比喻为看清事物而非为更美，忌每段一喻、连续两个物象不连用比喻（"碎银般的月光""像一串丝线""旧铜钱"这类范文熟喻尤其避开）。【一情一信号】一个情绪只落一次身体信号(如鼻子一酸、手一顿)便收，不在其后反复回到同一处("胸口那个撞过的地方")把同一情绪翻译第二三遍。【节律破规整·容瑕疵】句子长短错落、容得下突兀的短句与不那么周正的节奏；切忌段段都是“动作→环境→对话→一个停顿（手停了/火光缩了/声远了）”同一模板，不必每个情绪都用一个凝滞动作镇一下、也不必段段以一句环境白描把情绪缓冲掉，容得下直接收在人物话里或动作上的段。【过场要快·详略有别】递物收物、拨火添柴、整理药包这类过场与铺垫动作点到即止、能略则略，不把一个小动作分解成“伸手—碰—停—搁”四拍；笔墨集中到这一章真正要紧的一两件事（重逢、交托、旧恩点破）上，过场快、核心慢。${process.env["NOVEL_RESTRAINT_CLAUSE"] !== "0" ? TPL["penRestraint"] : ""}`
  : `【笔法·要紧】文字干净利落、节奏明快：多用动词与短句，少堆砌形容词与比喻；删去"仿佛/似乎/像是/宛如/一般"之类的模糊修饰；对白须推动情节、不寒暄铺垫；不为凑字数而注水环境描写。`;
const GENTLE = process.env["NOVEL_STYLE"] === "温润"; // 温情/温润向: 节拍走「场景流连/相遇展开/心境流转」而非生新冲突跳切, 章末留余味而非硬悬念
const EDIT_PASS = GENTLE && process.env["NOVEL_EDIT_PASS"] !== "0"; // 章后精修 pass: 温润世界默认开(NOVEL_EDIT_PASS=0 关), 爽文永不跑。逼近大师(.audit/20260608-master-benchmark): 删比喻过密/情绪过释/象征过劳/点破尾巴
const SEG_LEDGER_ON = process.env["NOVEL_SEG_LEDGER"] === "1"; // [EXP-2裁决·2026-06-10用户人签裁撤·registry#4/5/6→DONE] 6章配对无差(flags p=1·d1c p=0.5·D2/tradeReps双零)且指令在催肥章长+30%(5095→3576)→默认关(=1可回开)。注入块自坍缩: covered/人地账/交易账输入置空·检测器D7-D12照跑(lint用canon∪roster非metNames)·节拍全景#7独立不在此gate·爽文本就不走
const MICRO_TENSION_ON = GENTLE && process.env["NOVEL_MICRO_TENSION"] === "1"; // 修1b轮盘·[EXP-1裁决2026-06-10默认关]: 预注册消融B臂(无轮盘)全维更净(flags 0/6 vs A臂0.67/章·顶针/丸药同物二卖复发=轮盘在制造重复求购素材)→改opt-in; stakes路径改走ST-3事实参数化(十源不给措辞给sim账本事实)待做
// 日常张力轮盘(A3 十源 taxonomy): 纯涌现世界(无 outline-plan→stageGoal 恒空→T2/T2' 永久死)的 weave 兜底。
//   按 n 确定性轮换(禁随机/时钟, resume 安全); 措辞回避冲突词族, 与 beatSpec『绝不靠冲突』共存; 仅 GENTLE。
//   评审裁决: n%4===0 章跳过(呼吸章·摩擦总预算)——否则每章固定多源强制摩擦=把『处处圆润』换成『处处硌牙』, 同样是均匀病。
const MICRO_TENSION = [
  "给主角一桩具体的小想头（一样物、一口吃食、一句想听的话），本章想要而未全得——或得了，却晚了一步、贵了一截",
  "凡赠与收受须有一来一回的推让且有人『输』——收下的人记下一笔，或回敬一样不对等的东西；勿一递即收、一谢即完",
  "安排一桩在场者彼此心知却都不说破的小事，对话全在别处打转——不许任何人把它点明",
  "本章须有一次小失手：话多了半句、礼数错了一着、借口当场被人看穿——写当事人自己的窘，不写旁人的谅解",
  "钱要见数目（几文、几升、抹掉的零头）；给出去的东西先疼一下再给；白送须有不白送的理由",
  "让营生带来一次轻慢（被压价、被当下人使唤、被玩笑学舌），主角受了、赔笑或回一句软中带硬的话——不愤怒、不升级、也不指望对方悔悟",
  "给本章一只看不见的钟（天黑、落雨、收市、糕要凉），让至少一件事赶上或没赶上它",
  "让主角揣一件不能说的小事，章内至少两次差点被问到——他岔开了，本章不揭穿",
  "主角今天有一件想办成的具体小事（一句话说得清、当天见分晓），章内须不顺手一次，章末见分晓——成了、没成、或成了一半",
  "好意不许顺利落地：受的人先挡一下，或受了之后别扭地还一手（一句不领情的话、一样硬塞的回礼）",
];
const ECHO_SRCS = [() => PENMANSHIP, () => MICRO_TENSION.join("；"), () => voiceCard]; // [D10·治理] 回声监控源(笔法+轮盘+声口卡; beatSpec样例已删)·惰性取值(voiceCard每章重建)
const FULLCTX = GENTLE && process.env["NOVEL_FULLCTX"] === "1"; // [B2·overhaul·治理裁决"无条件开工"] 段间传全量已写正文(封顶6000字)替代尾窗——治四段互盲的结构根(指令防御已实证失聪); 默认关·canary 6章+EXP-3验收(D2/D8/tradeReps→0)后转正并退休已写账族5项
const VOL = 25;
const sys = PACK.composeProfile?.systemPrompt ?? "你是一位修仙小说作者。";
const tierName = (id: string | undefined): string => PACK.progression.tiers.find((t) => t.id === id)?.name ?? id ?? "练气初期";
let llm: LLMProvider = makeLLM(); // 章节文笔(可热切换); sim 用 mock 跑世界推演
let llmSig = configSignature();
const sim = new MockLLM();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", ".novel-output", process.env["NOVEL_SAGA_DIR"] ?? "saga");
const CH_DIR = join(ROOT, "chapters");
mkdirSync(CH_DIR, { recursive: true });
const loreLib = loadLore(ROOT); // T3 触发式设定库(freeform 世界由 server 据配置写 lore.json; 无则 null, 不召回)
let arcHint = ""; // C方案: 预演化挑出的最佳弧线 → 注入第1章开篇做 in-medias-res 框定(无预演化则空)
let gdir = GENTLE ? loadGD(ROOT) : null; // T2 温情变化驱动器状态(sameStreak/lastMotifs/lastDomain/turn), 跨重启持久; 爽文为 null
let pledger: ProgressLedger | null = GENTLE ? loadPL(ROOT) : null; // T2 温情进展账本(situation/reachedMilestones/writtenBeats/lastAdvanceCh/turn), 跨重启持久; 爽文为 null
let gdLastMotifs: string[] = []; // T1-①: 近章 2-gram 静物指纹, 喂 rollSummary 钝化 bible 自反馈

// 单写者锁: 同一世界目录只许一个 longrun 写。防多进程赛跑串台(历史教训: 失败重开堆叠僵尸写者→同一章号被写两遍→标题/正文互相覆盖)。
const LOCK = join(ROOT, "longrun.lock");
if (existsSync(LOCK)) {
  const oldPid = Number(readFileSync(LOCK, "utf8").trim());
  let alive = false;
  try { process.kill(oldPid, 0); alive = oldPid > 0; } catch { alive = false; } // kill(pid,0) 不发信号, 仅探活
  const fresh = (() => { try { return Date.now() - statSync(LOCK).mtimeMs < 10 * 60 * 1000; } catch { return false; } })(); // 锁文件 mtime = 心跳(主循环每章重写刷新)
  if (alive && fresh) { // PID 活【且】心跳新鲜(<10min)才认作真写者 → 防 pkill -9 后 PID 被系统复用而误判有写者退出(锁与"pkill -9 重启"打架)
    console.error(`[longrun] 世界「${process.env["NOVEL_SAGA_DIR"] ?? "saga"}」已有写者 PID ${oldPid} 在跑(心跳新鲜)，本进程退出以免赛跑串台。`);
    process.exit(0);
  } // PID 活但心跳陈旧 = 多半 PID 复用(旧写者已 pkill -9、releaseLock 没跑)→ 接管
}
const heartbeat = (): void => { try { writeFileSync(LOCK, String(process.pid), "utf8"); } catch { /* ignore */ } }; // 重写刷新 mtime
heartbeat();
const releaseLock = (): void => { try { if (existsSync(LOCK) && Number(readFileSync(LOCK, "utf8").trim()) === process.pid) unlinkSync(LOCK); } catch { /* ignore */ } };
process.on("exit", releaseLock);
process.on("SIGINT", () => { releaseLock(); process.exit(0); });
process.on("SIGTERM", () => { releaseLock(); process.exit(0); });

// 自进化: 默认开(设 NOVEL_EVOLVE=0 关)。基因(生成参数+引擎 priorWeight)与进化记忆(避雷/发扬/指引)落盘在世界目录。
const EVOLVE = process.env["NOVEL_EVOLVE"] !== "0";
// [P0-2·三缺失 gate·蓝图 .audit/20260610-evolution-overhaul §3.1] "照算照 log 不写"消融开关(判别轮/exp-runner 臂用·§4.8)。默认全 1 = 现状逐字节。
const DRAMA_ON = process.env["NOVEL_DRAMA"] !== "0";          // =0: drama tuning 照算、dramaLog 照记, 但不写 snapshot.props.tuning/dramaFocus、dramaHint 不进提示
const GD_ON = process.env["NOVEL_GD"] !== "0";                // =0: gentleDirect 照跑、dispatchLog 照记, 但 longrun 不消费 sceneShift
const DYN_BUDGET_ON = process.env["NOVEL_DYN_BUDGET"] !== "0"; // =0: 动态段预算关, secBudget 回退 perSecG
// [P0-10·蓝图§3.1] 铁律提案显式 gate: 默认随 NOVEL_EVOLVE 判定(关 EVOLVE 即不再发提案——修蓝图证据#12 ":651 提案块不受 EVOLVE 门"); 设 NOVEL_CONSTRAINT_PROPOSE 可独立控制。
const CONSTRAINT_PROPOSE = (process.env["NOVEL_CONSTRAINT_PROPOSE"] ?? process.env["NOVEL_EVOLVE"] ?? "1") !== "0";
// [P1-1·draft 双轨 gate·蓝图§3.2·默认关] ="1": 进化评估窗(critique/metricsOf/avoidHits)读修订前草稿(drafts 表·缺 draft 回退成稿); 导演用(motifSig/gentle-director/warm 的 recentCh)仍读成稿。
const FIT_DRAFT = process.env["NOVEL_FIT_DRAFT"] === "1";
// [P1-4·质变层换源 gate·蓝图§3.2·默认=现状] 停滞判数据源: "fitness"=scores.fitness 滚3(现状·污染分) / "clean"=W_clean 趋势+draft-objFit(edit-ledger.lints 滚窗·去偏)。48 章强制兜底两源共用。
const STAG_SRC = process.env["NOVEL_STAGNATION_SRC"] ?? "fitness";
// [§4.2/4.3·trial-request 写者侧钩子·蓝图·默认关] ="1": 卷边界持锁同步 VACUUM INTO 导出 fork 基底 + 快照 state jsons + 写 trial-request.json + 幂等采纳 trial-verdict。默认关=零行为。
const TRIAL = process.env["NOVEL_TRIAL"] === "1";
// X4 传承闭环: 新世界(无本地 genome)可经 NOVEL_WORLD_INTENT 指定目标引擎策略 niche, 从全局 QD 存档取该 niche 精英起步(群像类世界取群像引擎而非全局文笔冠军)。别名「群像/爽文」→低代谢×生长; 或直接传「低代谢×生长」。已有本地 genome 的世界不受影响。
const _intentRaw = (process.env["NOVEL_WORLD_INTENT"] ?? "").trim();
const worldIntent: { turnover?: string; structure?: string } | undefined = _intentRaw
  ? (_intentRaw === "群像" || _intentRaw === "爽文" ? { turnover: "低代谢", structure: "生长" } : (() => { const [t, s] = _intentRaw.split("×"); return { turnover: t || undefined, structure: s || undefined }; })())
  : undefined;
let evoGenome = loadGenome(ROOT, worldIntent);
let evoGuidance = buildGuidance(loadLedger(ROOT), evoGenome, loadGlobal(ROOT).avoid);
let drama = loadDrama(ROOT); // T4 临界控制器 + 戏剧导演状态(coldStreak/hotStreak), 跨重启持久
const minds = loadMinds(ROOT); // M3 全员连续心智: pending_importance 队列 + 上次反思章, 跨重启持久
let conBlock = constraintsBlock(loadConstraints(ROOT).active); // 规则层: 世界铁律(定义概念空间), 每章注入
let canonInject = canonBlock(loadCanon(ROOT)); // 一致性·软层: 已确立软设定 + 待修正矛盾, 每章注入
let canonHard = ""; // 一致性·硬层(deriveCanon): 引擎权威境界/派系/生死/恩怨, 每章从快照确定性派生 + 强注入(prose 不漂)
let voiceCard = ""; // 声口卡(仅 GENTLE): 在场者各自声气, 每章重建, 注入写台词 secPrompt 分化声口(.audit/20260608-ai-tells 症③治本)
let lastChLen = 0; // [Q2·协同审计] 上章净字数 → 章级软上限(上章超配>1.8×MINLEN→本章段配额×0.85·确定性·治"约900字"与"宁短勿堆"对撞的连环超配)
let mustKeepNames: string[] = []; // [Q7] 本章 sim 大事主语(陨落/飞升/灭派/了仇)→ 修订第四闸(正史保真)
let situAnchor = ""; // [Q9] 进展账本机读处境锚 → outline 防漂移(仅 GENTLE)
let lastRosterNames: string[] = []; // [D3兜底] 本章 roster 人名 → lint-seams 排除(canon 未生成时防名字泄漏进道具表)

// 叙事·伏笔账(setup→payoff 跨章结构, 文件持久化, resume 安全)
interface Foreshadow { id: string; desc: string; plantedCh: number; dueCh: number; paid: boolean }
const FS_FILE = join(ROOT, "foreshadows.json");
function readFs(): Foreshadow[] {
  try {
    return existsSync(FS_FILE) ? (JSON.parse(readFileSync(FS_FILE, "utf8")) as Foreshadow[]) : [];
  } catch {
    return [];
  }
}
function writeFs(list: Foreshadow[]): void {
  const tmp = FS_FILE + ".tmp." + process.pid; // [档C②·原子写] 同目录 tmp+rename 防 torn-write→readFs 静默回 [](蓝图 .audit/20260610-evolution-overhaul §3.2)
  writeFileSync(tmp, JSON.stringify(list, null, 2), "utf8"); renameSync(tmp, FS_FILE);
}

// ── [P0-1·干预四账①④·蓝图 .audit/20260610-evolution-overhaul §3.1] drama 覆写账 + clamp 账 → sim-fitness.json 附加字段(遥测·零行为·确定性按 ch 键·滚64) ──
// 预注册退休条款: 2卷无消费者即停写(蓝图P0-1)。
// 写法注意: saveSimFitness 整写该文件 → 账随 _sfTele 内存随行、n%8 评估窗重挂回(longrun 不改 sim-fitness.ts);
// 文件尚不存在(新世界前8章)时只记内存不造半截文件——dramaControl/evolve 按 SimFitness 全形状读它, 半截会炸。
interface SimFitTelemetry { dramaLog: Array<{ ch: number; mult: Record<string, number> }>; clampLog: Array<{ ch: number; n: number; keys: string[] }> }
const SIMFIT_FILE = join(ROOT, "sim-fitness.json");
const _sfTele: SimFitTelemetry = (() => { // 启动恢复(resume 安全)
  try { const j = JSON.parse(readFileSync(SIMFIT_FILE, "utf8")) as Partial<SimFitTelemetry>; return { dramaLog: Array.isArray(j.dramaLog) ? j.dramaLog : [], clampLog: Array.isArray(j.clampLog) ? j.clampLog : [] }; } catch { return { dramaLog: [], clampLog: [] }; }
})();
function recordDramaTelemetry(ch: number, mult: Record<string, number>, clampKeys: string[]): void {
  _sfTele.dramaLog = [..._sfTele.dramaLog.filter((x) => x.ch !== ch), { ch, mult }].slice(-64); // 弃章重试同 ch → 覆盖, 确定性
  _sfTele.clampLog = [..._sfTele.clampLog.filter((x) => x.ch !== ch), { ch, n: clampKeys.length, keys: clampKeys }].slice(-64);
  try {
    if (!existsSync(SIMFIT_FILE)) return;
    const j = JSON.parse(readFileSync(SIMFIT_FILE, "utf8")) as Record<string, unknown>;
    if (typeof j["total"] !== "number") return; // 形状守门: 只往完整 SimFitness 文件上挂账
    j["dramaLog"] = _sfTele.dramaLog; j["clampLog"] = _sfTele.clampLog;
    const tmp = SIMFIT_FILE + ".tmp." + process.pid; // [档C②·原子写] 同目录 tmp+rename 防 torn-write 撕坏完整 SimFitness(蓝图 .audit/20260610-evolution-overhaul §3.2)
    writeFileSync(tmp, JSON.stringify(j, null, 2), "utf8"); renameSync(tmp, SIMFIT_FILE);
  } catch { /* 遥测非关键, 失败不阻断写章 */ }
}

// ── [档C②·内存态落盘·蓝图§3.2] main 循环内存态(recent/prevHook/revivals/seenFactions/seenPairs/prevPresent/lastChLen)每章原子写 + 启动恢复 ──
// resume 后 recent 不再为空 → forbid/标题同构闸/复兴排期/涌现新颖闸跨重启生效。确定性·全世界通用(与 GENTLE 无关层)。
// 不入此账的内存态及理由: bible(快照 props 已持久)、evCursor(保留现有 resume 语义=maxSeq, 防陈年积压灌爆"近时变故")、gdLastMotifs/mustKeepNames/situAnchor/voiceCard/canonHard 等(每章消费前必重算)。
const RS_FILE = join(ROOT, "runtime-state.json");
interface RuntimeState { ch: number; recent: string[]; prevHook: string; revivals: Array<{ faction: string; at: number }>; seenFactions: string[]; seenPairs: string[]; prevPresent: string[]; lastChLen: number }
function writeRuntimeState(rs: RuntimeState): void {
  try { const tmp = RS_FILE + ".tmp"; writeFileSync(tmp, JSON.stringify(rs), "utf8"); renameSync(tmp, RS_FILE); } catch { /* 非关键 */ } // 原子写: 同目录 tmp+rename
}
function readRuntimeState(): RuntimeState | null {
  try {
    if (!existsSync(RS_FILE)) return null;
    const j = JSON.parse(readFileSync(RS_FILE, "utf8")) as Partial<RuntimeState>;
    return {
      ch: typeof j.ch === "number" ? j.ch : 0,
      recent: Array.isArray(j.recent) ? j.recent.filter((x): x is string => typeof x === "string") : [],
      prevHook: typeof j.prevHook === "string" ? j.prevHook : "",
      revivals: Array.isArray(j.revivals) ? j.revivals.filter((x): x is { faction: string; at: number } => !!x && typeof x.faction === "string" && typeof x.at === "number") : [],
      seenFactions: Array.isArray(j.seenFactions) ? j.seenFactions.filter((x): x is string => typeof x === "string") : [],
      seenPairs: Array.isArray(j.seenPairs) ? j.seenPairs.filter((x): x is string => typeof x === "string") : [],
      prevPresent: Array.isArray(j.prevPresent) ? j.prevPresent.filter((x): x is string => typeof x === "string") : [],
      lastChLen: typeof j.lastChLen === "number" ? j.lastChLen : 0,
    };
  } catch { return null; }
}

const db = openDb(join(ROOT, "world.db"));
const worldId = "saga";

// 单写者锁: 防主循环 step 与"快速裁决"step 并发(JS 单线程, 仅 await 处可能交错)
let _busy = false;
async function guardedStep(): Promise<void> {
  while (_busy) await new Promise((r) => setTimeout(r, 30));
  _busy = true;
  try {
    await step(db, worldId, PACK, sim);
  } finally {
    _busy = false;
  }
}
// 临界区(读快照→改 props→存快照)须与 step 互斥: 否则 setInterval 的快速裁决 step 在其 await 处交错, 旁路 saveSnapshot 会丢更新(审计: drama/bible 写竞态)
async function withLock<T>(fn: () => T): Promise<T> {
  while (_busy) await new Promise((r) => setTimeout(r, 30));
  _busy = true;
  try { return fn(); } finally { _busy = false; }
}

// 情境随章/卷推进(破开篇循环); 循环时升级世界。优先用内容包提供的场景弧线(换 genre 即换场景)
const ARCS: string[] = PACK.arcs ?? [
  "青云宗灵根试炼方毕，四子定根骨、各入门墙",
  "分配洞府、初遇同门，恩怨与机缘并生",
  "后山秘谷历练，逢异兽、夺机缘，险象环生",
  "坊市风波，卷入宗门间的明争暗斗",
  "古秘境开启，四子结伴探宝，盟约暗生嫌隙",
  "宗门大比，道争升级为生死之搏",
  "魔道窥伺青云，白薇阴脉之秘渐浮",
  "夺舍之劫，正魔交锋，生死相托",
  "渡劫历险，境界跃迁，旧敌新仇交织",
  "更高层的势力入局，棋盘骤然扩大",
];
function sceneFor(n: number): string {
  const idx = Math.floor((n - 1) / 6);
  const arc = ARCS[idx % ARCS.length];
  const cycle = Math.floor(idx / ARCS.length);
  return cycle === 0 ? arc : `${arc}（第${cycle + 1}重天地，势力更巨、对手更强、修为更高）`;
}

// [E3] arrivedIds(可选): 本章新到在场者 → 缀「·新到此地」纯标注(仅作素材, 不单独施压)。爽文不传 → 零变更。
function roster(snap: WorldSnapshot, arrivedIds?: Set<string>): string {
  return Object.values(snap.characters)
    .filter((c) => c.present)
    .map((c) => {
      const bonds = Object.entries(c.props)
        .filter(([k, v]) => k.startsWith("bond:") && typeof v === "number" && v !== 0)
        .map(([k, v]) => `${(v as number) > 0 ? "善" : "争"}${k.slice(5)}`)
        .join(",");
      const fac = typeof c.props["faction"] === "string" ? `·${c.props["faction"]}` : "";
      const loc = snap.locations[c.locationId ?? ""]?.name;
      const gl = goalLabel(c);
      const inner = INNER_CN[String(c.props["innerDrive"] ?? "")] ?? "";
      const fresh = arrivedIds?.has(c.id) ? "·新到此地" : "";
      return `${c.name}(${natalLabel(c)}·${tierName(c.progressionTier)}${gl ? "·" + gl : ""}${inner ? "·" + inner : ""}${fac}${loc ? "@" + loc : ""}${bonds ? "，" + bonds : ""}${fresh})`;
    })
    .join("、");
}

async function rollSummary(prev: string, recentGoals: string[], dropMotifs: string[] = []): Promise<string> {
  // T1-①[C3]: 温情向钝化 bible 自反馈——剔除近章反复静物词, 只留结构线索, 防器物特写回灌后续每章导致镜头锁死(主因)。
  const drop = GENTLE && dropMotifs.length
    ? `\n【压缩须剔除】近章反复出现的具体静物/场景词(${dropMotifs.slice(0, 8).join("、")})——只保留人物关系/势力/未了伏笔/境界/恩怨等结构性线索，勿把器物特写写进纲要(它们会回灌后续每章导致镜头锁死)。`
    : "";
  const p = `${sys}\n长篇连载【前情纲要】(保住人物关系/势力/未了伏笔/当前境界/已发生的大事)：\n${prev}\n新增：${recentGoals.join("；")}${drop}\n压缩重写为不超过200字的新纲要，只留对后续连贯最关键的线索，只输出纲要。`;
  return (await llm.complete(p, { thinking: false, temperature: 0.6 })).replace(/\s+/g, " ").slice(0, 320);
}

// 章后精修 pass(仅 GENTLE·EDIT_PASS): 机检零 LLM 定位"用力过猛"→ LLM 只做减法重写 → 三道确定性闸守门(改过头则弃用、回退原稿)。
// 纯增益层、可丢弃; 与进化 critique 的 overused/fixes 隔离(只用自家机检 + edit-ledger), 防品类污染。依据 .audit/20260608-master-benchmark/。
// [D13确定性去重·2026-06-11·registry#23退路] xiqiao 30章验证 directive 失聪(修订采纳但复写幸存×2/地板拒×1)→最终文本零LLM外科删第二处(≥16字原样段·扩句·占比≥0.55·至多2处)。盖三个返回路径(含地板拒=ch5盲区)。gate=NOVEL_DEDUP(默认开)。
const DEDUP_ON = process.env["NOVEL_DEDUP"] !== "0";
function dedupFinal(text: string, n: number): string {
  if (!DEDUP_ON || !GENTLE) return text;
  try {
    const { text: out, removed } = d13DedupSecond(text);
    if (removed.length) console.log(`  🧹 确定性去重 第${n}章: 删第二处复写×${removed.length}: 「${removed.join("」「")}」`);
    return out;
  } catch { return text; }
}
async function reviseChapter(draft: string, n: number, goal: string): Promise<string> {
  try {
    const ledger = loadEditLedger(ROOT);
    const lint = lintChapter(draft, ledger, n);
    ledger.lints = [...(ledger.lints ?? []).filter((x) => x.ch !== n), { ch: n, similePerK: lint.metrics.similePerK, microPerK: lint.metrics.microPerK, settleRatio: lint.metrics.settleRatio, pauseBeats: lint.metrics.pauseBeats, flagged: lint.flagged, smilePerK: lint.metrics.smilePerK, givePerK: lint.metrics.givePerK }].slice(-16); // [Q5] lint(draft·修订前)落盘: W_clean 观察版数据源(断"genome替编辑领功"归因链); smile/give=[修5]观察
    const seams = lintSeams(draft, [...new Set([...Object.keys(loadCanon(ROOT).characters ?? {}), ...lastRosterNames])], goal); // 症⑤拼接检测(零LLM·canon∪roster 名排除)
    for (const f of seams.flags) console.log(`  ⛓ 拼接病(只记·治本在跨段已写账) 第${n}章: ${f}`);
    const echo = echoLint(draft, goal, ECHO_SRCS.map((g) => g())); // [D10] 正文回声监控(标题闸在生成端·此处记账)
    if (echo.bodyHits.length) console.log(`  ⛓ D10回声 第${n}章: ${echo.bodyHits.map((g) => `正文«${g}»×≥2`).join(" ")}`);
    if (seams.metrics.d1cPairs > 0 || seams.metrics.tradeReps > 0) console.log(`  ⛓ seam 度量 第${n}章: 套语对=${seams.metrics.d1cPairs}(语料基线p50=5·修法1疗效指标)${seams.metrics.d3Props.length ? " 道具触碰=" + seams.metrics.d3Props.join(",") : ""}${seams.metrics.tradeReps ? " 同物二卖=" + seams.metrics.tradeReps : ""}`);
    const directives = [lint.flagged ? lint.directives : "", ...seams.issues.map((s, k) => `S${k + 1}. ${s}`)].filter(Boolean).join("\n");
    if (!directives) { saveEditLedger(ROOT, updateEditLedger(ledger, draft, n)); return dedupFinal(draft, n); } // 无违规: 只更账本、原样返回(去重照过)
    const mlint = { ...lint, flagged: true, directives };
    let revised = "";
    for (let attempt = 0; attempt < 2; attempt++) { // LLM 抽风回退占位 → 重试一次
      revised = (await llm.complete(buildRevisePrompt(sys, draft, mlint), { thinking: false, temperature: 0.4 })).trim()
        .replace(/^#{1,6}\s+[^\n]*\n+/, "").replace(/^第[零〇一二三四五六七八九十百千两\d]+[章回][^\n]*\n+/, ""); // 去混进的标题行
      if (revised.replace(/\s/g, "").length >= 200) break;
      if (attempt < 1) await new Promise((r) => setTimeout(r, 8000));
    }
    const guard = passesGuards(draft, revised, canonHard, mustKeepNames); // 四道闸: 长度/留白/一致性/正史(Q7 大事主语不得删没)
    if (!guard.ok) { console.log(`  ✂️ 精修弃用(${guard.reason}) → 保留原稿 · 第${n}章`); saveEditLedger(ROOT, updateEditLedger(ledger, draft, n)); return dedupFinal(draft, n); }
    // [P0-2·draft 落盘·蓝图 .audit/20260610-evolution-overhaul §3.1] 采纳修订前: 修订前草稿写 drafts 独立表(与 chapters 彻底隔离 → resume 章号源 readChapters/listChapters 不被污染); P1-1 经 NOVEL_FIT_DRAFT 读它。本函数仅 EDIT_PASS(=GENTLE)路径调用 → 天然 GENTLE-gated, 爽文零变。
    try { store.saveDraft(db, worldId, n, draft, Date.now()); } catch (e) { console.log(`  ✂️ draft 落盘失败(不阻断): ${String(e).slice(0, 60)}`); }
    // [P0-1·干预四账③·revisedDelta] 修订采纳记账(滚64·按 ch 键确定性·遥测零行为)。预注册退休条款: 2卷无消费者即停写(蓝图P0-1)。
    ledger.revisedDelta = [...(ledger.revisedDelta ?? []).filter((x) => x.ch !== n), { ch: n, beforeLen: draft.replace(/\s/g, "").length, afterLen: revised.replace(/\s/g, "").length, dims: [...lint.dims, ...(seams.issues.length ? ["seam"] : [])] }].slice(-64);
    const before = lint.metrics;
    console.log(`  ✂️ 章后精修 第${n}章《${goal}》: 喻${before.similePerK}/k${before.cliches.length ? " 熟套喻-" + before.cliches.length : ""}${before.bodyRepeats.length ? " 情绪回环-" + before.bodyRepeats.length : ""}${before.crossImgs.length ? " 跨章意象-" + before.crossImgs.length : ""}${before.workingObj.length ? " 象征过劳-" + before.workingObj.length : ""}${before.explainTail ? " 删点破尾" : ""}${before.microPerK >= 3 ? " 过细动作" + before.microPerK + "/k" : ""}${before.settleRatio >= 0.12 ? " 段尾缓冲" + (before.settleRatio * 100 | 0) + "%" : ""}${before.pauseBeats >= 6 ? " 停顿拍-" + before.pauseBeats : ""}`);
    saveEditLedger(ROOT, updateEditLedger(ledger, revised, n));
    return dedupFinal(revised, n);
  } catch (e) { console.log(`  ✂️ 精修异常(保留原稿): ${String(e).slice(0, 80)}`); return dedupFinal(draft, n); }
}

// ── [档C①·模板可测化·蓝图 .audit/20260610-evolution-overhaul §3.2] prompt 装配纯函数 ──
// 两个巨型模板从 writeChapter 原样搬出(模板文本一个字不改·治理冻结资产·禁改), 全部自由变量经 ctx 显式入参,
// 函数不读任何模块级可变 let(situAnchor/arcHint/voiceCard/canonHard/canonInject/conBlock/evoGuidance 由调用点取当前值传入)。
// golden 逐字节回归: app/prompt-golden.ts(legacy 模板抠自重构前备份, 同 ctx 求值 === 断言)。
export interface OutlinePromptCtx { sys: string; n: number; vol: number; scene: string; situAnchor: string; crisis: string; bible: string; ros: string; prevHook: string; forbid: string; gdDomain: string; sceneAvoid: string; weave: string; outlineBeat: string; obedience: string; arcHint: string; GENTLE: boolean; SECTIONS: number }
export function buildOutlinePrompt(ctx: OutlinePromptCtx): string {
  const beatSpec = ctx.GENTLE
    ? `列出本章 ${ctx.SECTIONS} 个叙事节拍(每个≤20字)：首拍由上章余韵自然承接；节拍可是一次相遇或对话的展开、一段心境或回忆的流转、一程行脚或一桩寻常事的经过、一桩小为难或一个要付一点小代价的选择，前后气脉相承、连贯不跳，不必每拍生新冲突；但每拍过后须留下一样带得走的东西（一句应承、一份欠情、一桩新知道的事、一个没说出口的念头），后拍须用到前拍留下的东西——节拍打乱重排便不成立，才算连贯；${ctx.SECTIONS} 拍中至少一拍须有一点不顺：一样想要而未全得的东西、一次小失手、一回不对等的人情推让、一笔叫人心疼的小账——温情的张力来自人心微澜与人情推拉，不来自打斗危机，其余拍照旧温润；同类小事（同一货品的买卖、同样的赠收）一章至多一回，若再现，第二回必须出岔子或变了意思，不得原样重演；但全章不可困守一处一物——须有人事、场景或时令的自然流动（一次出门、一个来客、一段路、一场天时之变都好），少让主角独对同一件旧物反复出神；多写人来人往与世态人情、人物自己的小算盘与取舍，而非只作旁观；${ctx.outlineBeat ? "本阶段内主角处境宜较阶段开端有所挪移(多识一人、多走一程、道行或心境长进一分、近一桩牵念)、顺这条人生主线缓缓向前；不必每章都动、容得下纯质感的呼吸章；这一步绝不靠任何冲突/争斗/危机/失去来体现、" : ""}末拍以一个安静的画面或一点余味收束、不必留硬悬念，但容得下一桩未尽之事、一位将至之客、一句没说完的话作余韵的软钩。全章须有一处稍密或稍疾的段落(一段世俗白描信息密些、或一句短促的话、一桩骤来的小事)与通篇舒缓相对位、勿全程一个速度。只列 ${ctx.SECTIONS} 行节拍。`
    : `列出本章 ${ctx.SECTIONS} 个情节节拍(每个≤20字)：首拍由上章钩子直接引发；每拍须是前一拍的直接后果(因果相承"因→果→再生变"，不得并列罗列)；${ctx.outlineBeat ? "在推进上述大纲主线的前提下" : `在"当前情境"内`}生新事件/冲突/转折；末拍留引向下章的悬念。只列 ${ctx.SECTIONS} 行节拍。`;
  return `${ctx.sys}\n【连载第${ctx.n}章·第${ctx.vol}卷】\n【当前情境】${ctx.scene}${ctx.GENTLE && ctx.situAnchor ? `\n【当前处境·机读锚(以此为准勿漂移)】${ctx.situAnchor}` : ""}\n【当前世界大事】${ctx.crisis || "暂无"}\n【前情纲要】${ctx.bible}\n【在场(含亲疏)】${ctx.ros}\n【上章末钩子】${ctx.prevHook || "（开篇）"}\n【最近章节标题——严禁雷同、严禁重演开篇灵根试炼】${ctx.forbid}${ctx.GENTLE ? (ctx.gdDomain ? `\n【本章场景·须切换·要紧】本章主场景须离开【${ctx.sceneAvoid}】(同一处室内/同一旧物特写)，转到【${ctx.gdDomain}】：把镜头挪到那里的人事往来与世态人情。节拍仍温润连贯、章末留余味，只换舞台不跳冲突。` : `\n【温情·场景须流动·要紧】温情绝不等于停滞。审视上面近几章标题：若总绕在同一处（如灶房、院中、同一只碗/灶火/旧物旁），本章必须把镜头挪开——换一处地点（出门赶集、访友、上山下山、渡口、田间水边、别人家、远行途中、市集庙会），或推进季候天时（晴雨更替、节气流转、晨昏交接），或让一个新面孔自然进入（行脚僧、求医人、孩童、归乡客、远来故人）。宁可写人来人往、世态流动，也不要让主角又一次独对同一件旧物出神。`) : ""}${ctx.weave ? `\n【本章叙事任务·须落实】${ctx.weave}` : ""}${ctx.outlineBeat ? (ctx.obedience === "balanced" ? `\n【本章大纲主线·建议方向】${ctx.outlineBeat} —— 优先顺势推进这条主线；但世界若自发涌现变数/冲突，可顺其自然地偏离，不必硬贴。` : `\n【本章须遵循的大纲主线·最要紧】${ctx.outlineBeat} —— 你列的 ${ctx.SECTIONS} 个节拍必须服务于推进这条主线、顺着它走，不可跑偏到别处情节。`) : ""}${ctx.n === 1 && ctx.arcHint ? "\n【开篇·in-medias-res·要紧】" + ctx.arcHint : ""}\n${beatSpec}`;
}
export interface SecPromptCtx { sys: string; n: number; goal: string; vol: number; scene: string; ambience: string; crisis: string; ros: string; text: string; prev: string; beats: string[]; covered: string[]; metNames: Set<string>; metRoles: Set<string>; seenPlaces: Set<string>; weave: string; sceneAvoid: string; recentImgs: string[]; loreBlock: string; canonHard: string; canonInject: string; conBlock: string; evoGuidance: string; voiceCard: string; secBudget: number; wrote: number; perSec: number; GENTLE: boolean; FULLCTX: boolean; SECTIONS: number; MINLEN: number; PENMANSHIP: string }
export function buildSecPrompt(ctx: SecPromptCtx, i: number, last: boolean): string {
  return `${ctx.sys}\n【第${ctx.n}章${ctx.goal ? `《${ctx.goal}》` : ""}·第${ctx.vol}卷·情境：${ctx.scene}】${ctx.GENTLE && ctx.ambience ? `\n【本章风物背景】${ctx.ambience}` : ""}\n【当前世界大事】${ctx.crisis || "暂无"}\n【在场角色及修为】${ctx.ros}\n【${ctx.FULLCTX ? "本章已写正文·从头至此（它是事实依据：接续其情节人物时序，但勿照抄其句子、比喻与措辞——同样的意思换说法）" : "上文结尾"}】${(ctx.FULLCTX ? ctx.text.slice(-6000) : ctx.prev.slice(ctx.GENTLE ? -480 : -280)) || "（本章开篇，承接上一章）"}${ctx.GENTLE ? `\n【本章节拍全景】${ctx.beats.map((b, k) => `${k + 1}.${b}${k < i ? "(已写)" : k === i ? "(本段)" : "(留待后段勿提前)"}`).join(" ")}` : ""}${ctx.GENTLE && ctx.covered.length ? `\n【本章已写之事·最要紧·绝不重写】${ctx.covered.join("；")}；已出场：${[...ctx.metNames].join("、") || "—"}${ctx.metRoles.size ? `；已遇(未具名)：${[...ctx.metRoles].join("、")}` : ""}${ctx.seenPlaces.size ? `；已到过：${[...ctx.seenPlaces].join("、")}` : ""}。以上均已发生：本段只能向前续写，不得另起一个版本重写开头或离开/动身的场景，已出场者——包括上列未具名者——不得再次以生人引入或重问来历身份，再相逢须接续前话；已到过之处同章再去须交代缘由、不作初到写法；同一日时序只进不退，不得章中途另起一日重述昨日之约；所在地须顺上文连续、不得无故折返起点。` : ""}\n续写本章第${i + 1}/${ctx.SECTIONS}段，对应情节：「${ctx.beats[i]}」。${ctx.weave && i === Math.min(1, ctx.SECTIONS - 1) ? `本段须自然落实：${ctx.weave}。` : ""}须由上段结果直接引发、承接因果，各角色言行暗合其命格性情。${ctx.GENTLE && ctx.sceneAvoid ? `\n本段须把镜头放在新场景里的人来人往，勿回到【${ctx.sceneAvoid}】。` : ""}${ctx.GENTLE && ctx.recentImgs.length ? `\n【近5章已用过的静物意象——本章换载体勿复用(章内既有信物回扣不限)】${ctx.recentImgs.join("、")}` : ""}\n${ctx.PENMANSHIP}${ctx.GENTLE && ctx.voiceCard ? "\n" + ctx.voiceCard : ""}${ctx.canonHard ? "\n" + ctx.canonHard : ""}${(!ctx.GENTLE || i === 0 || last) && ctx.loreBlock ? "\n" + ctx.loreBlock : ""}${(!ctx.GENTLE || i === 0 || last) && ctx.canonInject ? "\n" + ctx.canonInject : ""}${(!ctx.GENTLE || i === 0 || last) && ctx.conBlock ? "\n" + ctx.conBlock : ""}${(!ctx.GENTLE || i === 0 || last) && ctx.evoGuidance ? "\n" + ctx.evoGuidance : ""}\n${ctx.GENTLE ? `${Math.round(ctx.secBudget * 0.55)}至${ctx.secBudget}字之间、写到从容即收${ctx.wrote >= ctx.MINLEN * 1.2 ? "——全章篇幅已足，本段务必短小、把本拍写完即收" : ""}${TPL["secBudgetGentle"]}` : `约 ${ctx.perSec} 字`}。${last ? (ctx.GENTLE ? TPL["endGentle"] : "段末留一个引向下一章的悬念钩子。") : ""}只输出正文，不要写任何章节标题或"第X章"字样。`;
}

// [档C①] writeChapter 位置参收编为单一 ctx 对象(蓝图同条·唯一调用点同步改): 字段=原位置参原名, 顶部解构后函数体零改动。
interface ChapterCtx { n: number; vol: number; scene: string; crisis: string; bible: string; ros: string; recent: string[]; prevHook: string; weave: string; outlineBeat: string; obedience: string; ambience?: string; sceneAvoid?: string; gdDomain?: string }
async function writeChapter(chCtx: ChapterCtx): Promise<{ goal: string; text: string; hook: string }> {
  const { n, vol, scene, crisis, bible, ros, recent, prevHook, weave, outlineBeat, obedience, ambience = "", sceneAvoid = "", gdDomain = "" } = chCtx;
  const forbid = recent.slice(-6).join("、") || "无";
  const outline = await llm.complete(
    buildOutlinePrompt({ sys, n, vol, scene, situAnchor, crisis, bible, ros, prevHook, forbid, gdDomain, sceneAvoid, weave, outlineBeat, obedience, arcHint, GENTLE, SECTIONS }),
    { temperature: 0.9 },
  );
  const beats = outline.split("\n").map((s) => s.replace(/^[\d.、)\-—•·*\s]+/, "").replace(/^节拍[零〇一二三四五六七八九十\d]+[：:、.\s]*/, "").trim()).filter(Boolean).slice(0, SECTIONS);
  while (beats.length < SECTIONS) beats.push("情节推进");

  const titleStyle = PACK.composeProfile?.titleStyle ?? "简洁自然、有画面感的标题，避免堆砌并列短语与生硬对仗";
  const mkTitle = async (basis: string): Promise<string> => (await llm.complete(`${sys}\n为本章起一个标题。要求：紧扣本章核心转折，自然、有画面感、含一点悬念；≤12字；${titleStyle}。不含"第X章"字样，不得与「${forbid}」雷同。只回标题本身：\n${basis}`, { thinking: false, temperature: 1.0 }))
    .replace(/\s+/g, " ")
    .replace(/[《》「」#*_~`\n]/g, "") // 去书名号/markdown 强调符
    .replace(/^[\s\-—•·*]+/, "") // 去前导项目符/破折号
    .replace(/^.{0,40}?(标题|本章|以下|这里有?|符合你|贴合本章|供[你您]|建议|方案)[^：:\n]{0,30}[：:]\s*/, "") // 去掉 LLM 前言("这里有几个贴合本章…的标题：")
    .replace(/^\s*\d+\s*[.、)）]\s*/, "") // 去掉前导编号"1."
    .replace(/^第[零〇一二三四五六七八九十百千两\d]+[章回][:：\s]*/, "") // 去掉混进的"第X章"
    .replace(/^节拍[零〇一二三四五六七八九十\d]+[：:、.\s]*/, "") // 去掉混进的"节拍一："
    .replace(/\s*[（(]?\s*(或者也?可以|或可|也可以(考虑|叫)|或者可以|或者[：:]|备选|另拟|供选)[\s\S]*$/, "") // 去掉 LLM 多给的"或者也可以考虑：X"/"（或可…"备选标题(保留首个)
    .slice(0, 20);
  let goal = GENTLE ? "" : await mkTitle(beats.join("；")); // 温润: 标题延后到正文写完据实起题(治症④标题幻想"两双鞋"·.audit/20260609-stitching); 爽文原时序原字节

  const perSec = Math.ceil((MINLEN / SECTIONS) * 1.2);
  const perSecG = GENTLE && lastChLen > MINLEN * 1.8 ? Math.round(perSec * 0.85) : perSec; // [Q2] 章级软上限: 上章超配(实测温润超配40-60%)→本章段配额降15%(确定性·防连环超配)
  const recentImgs = GENTLE ? [...new Set(loadEditLedger(ROOT).usedImages.filter((u) => u.ch >= n - 5 && u.ch < n).map((u) => u.img))] : []; // [Q6] 近5章已用静物意象→上游避免(直降 edit-pass 跨章意象触发率)
  const loreBlock = recallLore(loreLib, `${crisis} ${ros} ${beats.join(" ")} ${goal} ${weave}`); // T3: 召回本章相关设定(关键词命中→注入, 保设定一致)
  let text = "";
  let prev = "";
  // 症⑤拼接病(仅GENTLE·.audit/20260609-stitching): 跨段已写账——段间唯一通道原是尾窗280字(段i对段i-2可见度=0), 各段把同一情境各写成独立短篇(两次离驿/三次初遇/搭扣12次)。零LLM段指纹+出场名, 确定性, 爽文 covered 恒空=零变更。
  const covered: string[] = [];
  const metNames = new Set<string>();
  const metRoles = new Set<string>(); // 未具名角色(老修士/大嫂…)·竹光窄处修: 不入账则后段当生人重引
  const seenPlaces = new Set<string>(); // 已到过地点(何家/X村…)·不入账则后段重访如初到
  const knownNames = GENTLE ? [...new Set(ros.match(/[一-龥]{2,4}(?=\()/g) ?? [])] : []; // roster 格式 `名(修为)` ASCII 左括号
  if (GENTLE) lastRosterNames = knownNames; // [D3兜底] canon 未生成的新世界, lint-seams 道具检测用 roster 名排除(防主角名2-gram混进道具表)
  for (let i = 0; i < beats.length; i++) {
    const last = i === beats.length - 1;
    const wrote = text.replace(/\s/g, "").length; // 已写净字数
    const secBudget = GENTLE ? (DYN_BUDGET_ON ? Math.min(perSecG, Math.max(350, Math.round(Math.max(350, MINLEN * 1.35 - wrote) / (beats.length - i)))) : perSecG) : perSec; // [Q2+·实测ch4超配到8115] 动态段预算: 全章软预算≈1.35×MINLEN, 按剩余均分——前段超写→后段确定性收紧, 不靠 LLM 自觉。[P0-2 三 gate③·NOVEL_DYN_BUDGET=0→回退 perSecG(动态预算关·指令用 perSecG)] 默认1=现状逐字节。
    const secPrompt = buildSecPrompt({ sys, n, goal, vol, scene, ambience, crisis, ros, text, prev, beats, covered, metNames, metRoles, seenPlaces, weave, sceneAvoid, recentImgs, loreBlock, canonHard, canonInject, conBlock, evoGuidance, voiceCard, secBudget, wrote, perSec, GENTLE, FULLCTX, SECTIONS, MINLEN, PENMANSHIP }, i, last);
    let sec = "";
    for (let attempt = 0; attempt < 4; attempt++) { // 每段守门: 正常数百字; <120 字多半是 DeepSeek 抽风回退 mock 占位 → 等 15s 重试本段, 扛持续抽风、防部分垃圾混入
      sec = await llm.complete(secPrompt, { thinking: false, temperature: evoGenome.gen.temperature, topP: evoGenome.gen.topP, frequencyPenalty: evoGenome.gen.frequencyPenalty, presencePenalty: evoGenome.gen.presencePenalty }); // 进化基因控制采样
      if (sec.replace(/\s/g, "").length >= 120) break;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 15000));
    }
    const clean = sec.trim()
      .replace(/^第\s*[零〇一二三四五六七八九十百千两\d]+\s*[\/／]\s*[零〇一二三四五六七八九十百千两\d]+\s*段[：:．.、]?\s*\n*/, "") // 去掉 LLM 抄进正文的「第1/4段：」分段标记(只匹配带/的 prompt 分段格式, 不误伤「第三段路…」类正文)
      .replace(/^(#{1,6}\s*)?第[零〇一二三四五六七八九十百千两\d]+[章回][^\n]*\n+/, "") // 去掉混进正文的章标题行
      .replace(/^#{1,6}\s+[^\n]*\n+/, ""); // 去掉任何残留 markdown 标题行
    text += (text ? "\n\n" : "") + clean;
    prev = sec;
    if (GENTLE && SEG_LEDGER_ON) { // 症⑤跨段已写账: 零LLM段指纹(首句…尾句)+出场名累积, 喂后续段防互盲重写(SEG_LEDGER=0→输入置空·注入块自坍缩=EXP-2消融臂)
      const sents = clean.split(/[。！？\n]/).map((s) => s.trim()).filter(Boolean);
      covered.push(`第${i + 1}段已写：${(sents[0] ?? "").slice(0, 32)}…${(sents[sents.length - 1] ?? "").slice(0, 24)}`);
      for (const nm of knownNames) if (clean.includes(nm)) metNames.add(nm);
      const rp = extractRolesPlaces(clean, knownNames); // 未具名角色+地点入账
      for (const r of rp.roles) metRoles.add(r);
      for (const p of rp.places) seenPlaces.add(p);
      for (const it of tradeAskedItems(clean, knownNames)) if (!covered.some((c) => c.includes(`【${it}】`)))
        covered.push(`已点名求购/售卖过【${it}】——后文段落不得再写它的第二次完整成交；若必须再现，须变了意思、不得原样重演；上文若有一桩尚未收尾的交易，照常写完不算重演`); // [修3b] 同物二卖治本(回声载体已删: 括号样例与节拍名是指纹·.audit/20260609-eval-governance §六.2)
    }
  }
  if (GENTLE) { // 据实起题(症④): 标题延后到正文写完, 只可用正文确有的意象, 杜绝『两双鞋』式幻想承诺
    const ps = text.split(/\n\n+/);
    const basis = `节拍：${beats.join("；")}\n正文开头：${ps[0]?.slice(0, 160) ?? ""}\n正文结尾：${ps[ps.length - 1]?.slice(0, 160) ?? ""}\n【标题只可用上面正文里确实出现的物象与数量，不得自创数量词或正文没有的物件】`;
    goal = await mkTitle(basis);
    const te = echoLint("", goal, ECHO_SRCS.map((f) => f())).titleHits; // [D10·治理] 标题回声闸: 标题命中注入措辞→重起一次("话多半句"成标题本可一行拦住)
    if (te.length) {
      console.log(`  ⛓ D10标题回声 第${n}章: «${te.join("、")}» → 重起标题`);
      goal = await mkTitle(`${basis}\n【标题不得含以下字眼（系统内部用语）】${te.join("、")}`);
    }
    // [标题同构闸·机械防重复(同"不得雷同"类·v6实测6/6连用"一X，半Y"模板)] 候选与近章≥2同构 → 重起一次
    const tplOf = (t: string): string => `${t[0] ?? ""}|${t.includes("半") ? "半" : ""}|${/[，,]/.test(t) ? "逗" : ""}`;
    const recentT = recent.slice(-6).map((s) => s.replace(/^第[^章]*章\s*/, "").replace(/[「」《》]/g, "").trim()).filter(Boolean); // recent 存「第N章「题」」格式·须剥引号(否则t[0]=「永不同构·v7 ch36-38半X三连漏判实证)
    if (recentT.filter((t) => tplOf(t) === tplOf(goal)).length >= 2) {
      console.log(`  ⛓ 标题同构 第${n}章: «${goal}» 与近章句构连用 → 重起`);
      goal = await mkTitle(`${basis}\n【近几章标题已连用同一种句构，本章标题必须换一种句式结构（字数、断句、起头都换）】`);
    }
  }
  if (EDIT_PASS) text = await reviseChapter(text, n, goal); // 章后精修: 机检 + LLM 减法 + 三道闸(仅温润)
  return { goal, text, hook: beats[beats.length - 1] ?? "" };
}

async function main(): Promise<void> {
  let n = store.listChapters(db, worldId).filter((c) => c.id.startsWith("saga-ch-")).length; // 只数标题(不读全量正文)
  if (n === 0) {
    const seeded = PACK.seedWorld({ worldId, packId: PACK.id, seed: "千章长篇", config: {} });
    seeded.props["autoCompose"] = false;
    store.saveSnapshot(db, worldId, seeded, 0, Date.now());
    store.setSchedulerState(db, worldId, { gen: 0, nextTick: 0, status: "running" }, Date.now());
  }
  const s0 = store.loadSnapshot(db, worldId);
  let bible = s0 && typeof s0.snapshot.props["bible"] === "string" ? (s0.snapshot.props["bible"] as string) : (process.env["NOVEL_BIBLE"]?.trim() || "青云宗灵根试炼，苏雪(冰)、林焰(火)、玄渊(幽)、白薇(阴脉之谜)四修命数交汇，各入门墙。"); // 新世界(无快照)可经 NOVEL_BIBLE 注入自定义 premise; 已有世界续用快照 bible(不受影响)
  const recent: string[] = [];
  let prevHook = "";
  // [E2/E3 T2'] 涌现际遇跨章状态(仅 GENTLE): 新颖闸(faction/对子首现) + 在场差分基准。[档C②] 现随 runtime-state.json 跨重启恢复(下方), 无存档时才重启重建。
  let prevPresent = new Set<string>();
  const seenFactions = new Set<string>(); const seenPairs = new Set<string>();
  let evCursor = n > 0 ? store.maxSeq(db, worldId) : 0; // P1-2 resume 安全: 已有章节(重启)则游标设当前 maxSeq(已落盘章对应事件视为已叙述), 免首章把全史兴亡当近时变故重灌 LLM; 新世界(含预演化)从 0 起、首章 in-medias-res 叙述预演化建起的局面。
  let revivals: Array<{ faction: string; at: number }> = [];
  { // [档C②·内存态恢复·蓝图§3.2] 已有章的世界且存档在 → 恢复主循环内存态(resume 后 forbid/标题同构闸/复兴排期/涌现新颖闸继续生效); 新世界(n===0)不吃陈年存档。
    const rs = n > 0 ? readRuntimeState() : null;
    if (rs) {
      recent.push(...rs.recent.slice(-64));
      prevHook = rs.prevHook;
      revivals = rs.revivals;
      for (const f of rs.seenFactions) seenFactions.add(f);
      for (const p of rs.seenPairs) seenPairs.add(p);
      prevPresent = new Set(rs.prevPresent);
      lastChLen = rs.lastChLen;
      console.log(`  ♻ 恢复运行态(写于第${rs.ch}章): 近章题×${rs.recent.length} · 钩子${rs.prevHook ? "有" : "无"} · 复兴排期×${rs.revivals.length}`);
    }
  }
  const outlinePlan = loadOutlinePlan(ROOT); // 严格跟纲模式: 有计划则逐章 steer 情节(松散底座模式为 null)
  if (outlinePlan?.beats.length) console.log(`  📑 跟纲模式(${outlinePlan.obedience === "balanced" ? "均衡·软建议、世界可偏离" : "照写·硬遵循"}): ${outlinePlan.beats.length} 段大纲主线`);
  let _wasPaused = false;
  const PAUSE = join(ROOT, "paused"); // 网页暂停开关(存在=暂停)

  // 🌱 世界预演化(C·挑最有戏弧线起笔): scout 临时 db 静默空跑 N tick 探弧线 → sim-fitness+Reagan+可空降性挑最佳弧 → 定 in-medias-res 起笔 tick → 真世界快进到该 tick(同 worldId/seed 确定性复现 scout 前 T tick) → 第 1 章从冲突现场起笔。
  //   step() 在 autoCompose=false 下只推演不落章。scout 在内存 db 看完整弧线(供排序)、不污染真世界; 真世界只快进到起笔点 T(< N), 故不回溯、无风险。研究 .audit/20260604-arc-selection-research/。
  if (n === 0 && WARMUP > 0) {
    console.log(`  🌱 世界预演化(挑弧线起笔): scout 静默推演 ${WARMUP} tick 探最有戏的弧线…`);
    const sdb = openDb(":memory:"); // scout: 内存 db, 同 worldId/seed → 与真世界确定性一致
    const sseed = PACK.seedWorld({ worldId, packId: PACK.id, seed: "千章长篇", config: {} });
    sseed.props["autoCompose"] = false;
    store.saveSnapshot(sdb, worldId, sseed, 0, Date.now());
    store.setSchedulerState(sdb, worldId, { gen: 0, nextTick: 0, status: "running" }, Date.now());
    const warmRefill = (xdb: typeof db, t: number): void => { // 群像稳态补血(scout 与真世界快进共用, 防预演化期人口坍塌; 高位 index 避免与章节期 spawn 撞 id)
      if (t % 5 !== 0 || !PACK.spawnCharacter) return;
      const sp = store.loadSnapshot(xdb, worldId);
      const present = sp ? Object.values(sp.snapshot.characters).filter((c) => c.present).length : 99;
      if (present < 16) { const k = present < 10 ? Math.min(4, 16 - present) : 1; for (let i = 0; i < k; i++) store.enqueueInput(xdb, `warmup-spawn-${t}-${i}`, worldId, "spawn-character", { character: PACK.spawnCharacter("预演化", 2000 + t * 4 + i) }, Date.now()); }
    };
    for (let t = 0; t < WARMUP; t++) { warmRefill(sdb, t); await step(sdb, worldId, PACK, sim); }
    const pick = pickArcStart(store.readEvents(sdb, worldId), GENTLE); // 温情向: 用温情情感弧权重(压暴烈、抬救赎)+放松起笔位置
    const T = Math.max(1, Math.min(pick ? pick.tick : Math.floor(WARMUP / 2), WARMUP - 1));
    arcHint = pick ? (GENTLE
      ? `世界已暗中走过一程、结下些人情旧识。本章从眼下一个寻常而有人情味的当口徐徐写起——读者一翻开就在人情与气息里、不在打斗或危机里，但正当主角一桩小为难、一个要不要伸手的当口；从容入场、不急着交代前情，前事留待后文细补。眼下牵系（若它与下方在场人事、生死事实相左，则以在场事实为准，只取其情味与方向）：${pick.arc.desc}`
      : `世界已暗中发展一段，眼下正值：${pick.arc.desc}。本章 in-medias-res 直接切入这个局面（读者一翻开就在矛盾/张力里），不从头交代，前情留待后文渐补。`) : "";
    console.log(`  🌱 scout 完: ${pick ? `选「${pick.arc.pattern}」"${pick.arc.desc}"(分${pick.score}) → in-medias-res 起笔 tick${T}（峰值 tick${pick.arc.atTick} 是开篇要建向的目标）` : `未筛出弧线 → 取中点 tick${T} 起笔`}`);
    console.log(`  🌱 真世界快进到起笔点 tick${T}…`);
    for (let t = 0; t < T; t++) {
      if (existsSync(PAUSE)) { await new Promise((r) => setTimeout(r, 3000)); t--; continue; }
      warmRefill(db, t);
      await guardedStep();
    }
    console.log(`  🌱 已快进到起笔点 → 第 1 章从此 in-medias-res 起笔`);
  }
  console.log(`长篇连载 v2：目标 ${TARGET} 章 · 每章≥${MINLEN}字(${SECTIONS}段) · 从第 ${n + 1} 章续写（LLM=${llm.id}）`);
  // 快速裁决: 作者在网页裁决后, 每 ~15s 检一次, 有待裁就用 sim 快走一步即时落定(不必等当前章写完)
  setInterval(() => {
    if (!_busy && store.countPendingInputs(db, worldId, "author-verdict") > 0) void guardedStep();
  }, 15000);
  while (n < TARGET) {
    if (existsSync(PAUSE)) { // 暂停: 原地等待, 不推进世界/不写章
      if (!_wasPaused) { console.log("⏸ 世界已暂停（网页点继续或删 paused 文件恢复）"); _wasPaused = true; }
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    if (_wasPaused) { console.log("▶ 世界已继续"); _wasPaused = false; }
    n++;
    heartbeat(); // 刷新单写者锁 mtime(心跳): 让本写者的锁保持"新鲜", 防被误判为陈旧锁接管
    const vol = Math.floor((n - 1) / VOL) + 1;
    let scene = sceneFor(n);          // T1-②: 可被 T2 的 sceneShift 覆盖为「时令·新舞台」
    let ambience = "";                // T2 写入: 时令/风物背景(独立于 crisis)[C1 C6]
    let sceneAvoid = "";              // T2 写入: 须避开的场景「类」(非字面词)[C5]
    let gdDomain = "";                // T2 写入: 须切换到的场景域(驱动 outline 硬指令)[C5]
    // 世代更替 + 群像稳态: 每 5 章补血, 维持在场 ~16; 跌破下限 10 → 批量补(防坍塌, 已验证旧世界减员快于补员→塌到 2 人)。turnoverRate 旋钮另在引擎侧调折损节律。
    if (n % 5 === 0 && PACK.spawnCharacter) {
      const sp0 = store.loadSnapshot(db, worldId);
      const present = sp0 ? Object.values(sp0.snapshot.characters).filter((c) => c.present).length : 99;
      const ROSTER_TARGET = 16, FLOOR = 10; // 目标在场人数(勿与模块级 TARGET=章节总目标混淆)
      if (present < ROSTER_TARGET) {
        const nSpawn = present < FLOOR ? Math.min(4, ROSTER_TARGET - present) : 1;
        for (let k = 0; k < nSpawn; k++) store.enqueueInput(db, `spawn-${n}-${k}`, worldId, "spawn-character", { character: PACK.spawnCharacter("长篇", n + k) }, Date.now());
      }
    }
    // T4 临界控制器 + 戏剧导演: 每章在进化 baseline(evoGenome.engine)上做稳态/戏剧干预 → 写 tuning/dramaFocus/dramaHint, 本章步进据此演化
    let dramaHintText = "";
    if (EVOLVE) {
      dramaHintText = await withLock(() => { // 与 step 互斥, 防快速裁决 step 交错覆盖本章 tuning/dramaFocus/simRules
        const spd = store.loadSnapshot(db, worldId);
        if (!spd) return "";
        const dc = dramaControl(store.readRecentEvents(db, worldId, 300), spd.snapshot, loadSimFitness(ROOT), evoGenome.engine, drama, GENTLE); // 只需近窗事件算雪崩密度; GENTLE=温情向: 冷不加注(否则每章顶高 conflictRate 绕过基因锚)
        drama = dc.ctrl; saveDrama(ROOT, drama);
        { // [P0-1·干预四账①④·蓝图§3.1] 本章 drama 覆写倍率(tuning/基因 base·含 clamp 后实效) + clamp 咬合键 → sim-fitness.json(遥测零行为·NOVEL_DRAMA=0 时照记)。预注册退休条款: 2卷无消费者即停写(蓝图P0-1)。
          const mult: Record<string, number> = {};
          for (const k of ["eventBias", "conflictRate", "structureGrowth", "turnoverRate", "moveBias"] as const) mult[k] = +(dc.tuning[k] / Math.max(0.01, evoGenome.engine[k])).toFixed(2);
          recordDramaTelemetry(n, mult, dc.clamped);
        }
        if (DRAMA_ON) { // [P0-2 三 gate①·NOVEL_DRAMA=0=照算照log不写] 关→本章不覆写 tuning/dramaFocus(消融臂/判别轮用·蓝图§4.8); 默认1=现状逐字节。
          spd.snapshot.props["tuning"] = { ...dc.tuning };
          spd.snapshot.props["dramaFocus"] = dc.dramaFocus;
        }
        // T5: 把已准入的进化机制注入活世界(保留各机制的 lastFired 冷却态, 防每章重置后狂触发)
        const fileRules = loadSimRules(ROOT).active;
        const cur = Array.isArray(spd.snapshot.props["simRules"]) ? (spd.snapshot.props["simRules"] as Array<{ id: string; lastFired?: number }>) : [];
        const lastById = new Map(cur.map((r) => [r.id, r.lastFired]));
        spd.snapshot.props["simRules"] = fileRules.map((r) => ({ ...r, lastFired: lastById.get(r.id) ?? r.lastFired ?? -99999 }));
        // T2 温情变化驱动器: 读落盘近章(标题+正文, resume 安全)→ 2-gram 名词指纹测坍塌 → 为【下一章 n+1】派 sceneShift(forCh=n+1, 下轮 :scene-read 守门消费)。
        // 与 step 互斥(在本 withLock 内)防竞态; sceneShift 写进同一 spd.snapshot, 随下面 saveSnapshot 一次落盘(不新增写)。纯符号、不碰 tuning/crisis。[C2 C4 C11]
        if (GENTLE && gdir) {
          const rc = store.readRecentChapters(db, worldId, 4);
          // [T1-4] occupied 解耦: 仅 hard steer 的 beat 让位(温情软脊梁 steer:soft 不抢 T2 → 慢燃主线与场景轮换正交叠加, var 不被关掉)。
          // 旧 strict plan 无 steer 字段 → (?? "hard") 缺省 hard → 仍让位(向后兼容)。[吸收批评二·命门]
          const nextBeat = beatObjForChapter(outlinePlan, n + 1);
          const isHard = !nextBeat ? false : (nextBeat.steer ?? "hard") === "hard";
          const occupied = isHard || readFs().some((f) => !f.paid && f.dueCh <= n + 1); // 下一章被硬大纲/伏笔占用 → 让位(weave 此处尚未算, 用同义的 outline+伏笔到期判定)[C11]
          const present = Object.values(spd.snapshot.characters).filter((c) => c.present);
          const locCount: Record<string, number> = {};
          for (const c of present) { const ln = spd.snapshot.locations[c.locationId ?? ""]?.name; if (ln) locCount[ln] = (locCount[ln] ?? 0) + 1; }
          const curLocation = Object.entries(locCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ""; // 在场众数 location, 供候选可达过滤
          const gd = gentleDirect(n + 1, rc.map((c) => c.goal), rc.map((c) => c.text), gdir, occupied, curLocation, present.map((c) => c.name));
          gdir = gd.ctrl; saveGD(ROOT, gdir); gdLastMotifs = gd.motifs;
          if (gd.sceneShift) spd.snapshot.props["sceneShift"] = gd.sceneShift;
          if (gd.sceneShift && n % 2 === 0) console.log(`  ${gd.log}`);
        }
        store.saveSnapshot(db, worldId, spd.snapshot, spd.lastSeq, Date.now());
        if (n % 4 === 0) console.log(`  🎭 ${dc.log}`);
        return DRAMA_ON ? dc.dramaHint : ""; // [P0-2 gate①] 关=导演 hint 也不进提示(干预整体"不写"); 默认1=现状
      });
    }
    for (let t = 0; t < 3; t++) await guardedStep();

    // 议事·奇门定夺: 作者若宽限期(~3章)内未裁, 由奇门吉凶自动落定(吉/平→依准, 凶→另议); 作者可在窗口内 /api/verdict 抢先裁
    {
      const sp = store.loadSnapshot(db, worldId);
      const pend = sp && Array.isArray(sp.snapshot.props["pendingDecisions"]) ? (sp.snapshot.props["pendingDecisions"] as Array<{ decisionId: string; valence?: number }>) : [];
      const curTick = sp?.snapshot.tick ?? 0;
      const GRACE_TICKS = existsSync(join(ROOT, "manualverdict")) ? 3 * 3 : 0; // 默认全自动裁决(作者后参与→世界起步无人值守, 议事立即据奇门吉凶定夺: 吉/平依准、凶另议)。作者到场可经网页关「全自动」→建 manualverdict 文件 → 恢复约3章宽限、亲自裁(重启亦记得该选择)
      let auto = false;
      for (const p of pend) {
        const m = p.decisionId.match(/t(\d+)$/);
        const age = curTick - (m ? Number(m[1]) : curTick);
        if (age >= GRACE_TICKS) {
          const v = p.valence ?? 0;
          let accept = v >= -0.2; // 原逻辑: valence<-0.2→reject 否则 accept(逐字节等价)
          if (GENTLE) { const cid = (p as { charId?: string }).charId; const c = cid ? sp?.snapshot.characters[cid] : undefined; const ti = c ? Number(String(c.progressionTier ?? "t0").replace(/^t/, "")) : 0; if (Number.isFinite(ti) && ti >= 5) accept = v > 0.3; } // [去饱和·L3] 温情高阶(tierIdx≥5)封顶突破只大吉(valence>0.3)才批→封顶稀有、降归隐刷屏; 爽文/低阶走原逻辑逐字节不变
          store.enqueueInput(db, `auto-${p.decisionId}`, worldId, "author-verdict", { decisionId: p.decisionId, verdict: accept ? "accept" : "reject" }, Date.now());
          auto = true;
        }
      }
      if (auto) await guardedStep();
    }

    const snap = store.loadSnapshot(db, worldId);
    if (!snap) throw new Error("no snapshot");
    if (GENTLE && GD_ON) { // T2: 消费上一轮为本章 n 派的 sceneShift(forCh===n 守门, 防 resume 串旧章)→ 覆盖 scene/ambience/sceneAvoid/gdDomain。[P0-2 三 gate②·NOVEL_GD=0=gentleDirect 照跑照记 dispatchLog 但此处不消费] 默认1=现状逐字节。
      const sh = snap.snapshot.props["sceneShift"] as SceneShift | undefined;
      if (sh && sh.forCh === n) { gdDomain = sh.domain.startsWith("(原处") ? "" : sh.domain; scene = `${sh.timeShift}。${sceneFor(n)}`; ambience = sh.ambience; sceneAvoid = sh.avoidClass; } // 仅真换域才驱动 outline 硬指令; 软调(只推时令/新面孔)gdDomain 空、走泛提示
    }
    // [E3] 本章新到在场者差分(仅 GENTLE, 仅作 roster 素材标注、不单独施压)。爽文 arrived=undefined → roster 零变更。
    const presentIds = new Set(Object.values(snap.snapshot.characters).filter((c) => c.present).map((c) => c.id));
    const arrived = (GENTLE && prevPresent.size > 0) ? new Set([...presentIds].filter((id) => !prevPresent.has(id))) : undefined;
    const ros = roster(snap.snapshot, arrived);
    prevPresent = presentIds;
    canonHard = derivedBlock(deriveCanon(snap.snapshot, tierName)); // 权威硬事实(境界/派系/生死/恩怨)从快照确定性派生, 本章强注入
    const t0 = Date.now();
    const crisisBase = typeof snap.snapshot.props["crisis"] === "string" ? (snap.snapshot.props["crisis"] as string) : "";
    const fr = snap.snapshot.props["factionRelations"] as Record<string, Record<string, number>> | undefined;
    const facSummary = fr
      ? Object.entries(fr).flatMap(([a, m]) => Object.entries(m).filter(([b]) => a < b).map(([b, v]) => `${a}与${b}${v > 0 ? "结盟" : v < 0 ? "交恶" : "中立"}`)).slice(0, 4).join("；")
      : "";
    // 变故: 自上章以来的陨落/吞并 + 复兴 + 怀复仇者 → 写进本章正文。【仅叙述耦合副作用(evCursor推进/复兴入队出队/伏笔/反思)延后到本章落盘成功后, 守门弃章则这些一概不发生 → 干净重试。注: 世界步进/drama streak 已在上方提交、不随弃章回滚——但 evCursor 未推进, 其新事件下章如实补叙, 无重复计数】
    const newEvs = store.readEventsSince(db, worldId, evCursor); // 增量读(替代全量读再 filter, 治千章 O(N^2))
    const upsets = newEvs.filter((e) => e.kind === "CharacterFell" || e.kind === "FactionDissolved" || e.kind === "VengeanceResolved" || e.kind === "CharacterTranscended").map((e) => e.summary).filter((s): s is string => !!s);
    mustKeepNames = upsets.map((s) => (s.match(/^[一-龥]{2,4}/) ?? [""])[0]!).filter(Boolean); // [Q7] 大事主语→修订第四闸(防减法把陨落/飞升当冗余删掉)
    // 被吞并的派系排期 8 章后复兴; 到期者此处只算"值"(供正文), 真正入队/出队延后到落盘后
    const dueRevivals = PACK.reviveFaction ? revivals.filter((r) => n >= r.at) : [];
    const reviveSpawns: Array<{ faction: string; reviver: CharacterState }> = [];
    const reviveNotes: string[] = [];
    for (const r of dueRevivals) { const reviver = PACK.reviveFaction!(r.faction, n); reviveSpawns.push({ faction: r.faction, reviver }); reviveNotes.push(`${r.faction}残部拥立${reviver.name}、揭竿复兴`); }
    const avengers = Object.values(snap.snapshot.characters)
      .filter((c) => c.present && typeof c.props["avenge"] === "string")
      .map((c) => `${c.name}痛失${String(c.props["avenge"])}、誓复此仇`);
    const upheaval = [...upsets, ...avengers, ...reviveNotes].join("；");
    const qimen = plateLabel(snap.snapshot.tick ?? n * 3);
    const crisis = [crisisBase, `奇门·${qimen}`, facSummary ? `派系格局：${facSummary}` : "", upheaval ? `近时变故：${upheaval}` : "", dramaHintText ? `导演：${dramaHintText}` : ""].filter(Boolean).join(" ｜ ");
    const sig = configSignature();
    if (sig !== llmSig) { llm = makeLLM(); llmSig = sig; console.log(`↻ LLM 已切换为 ${llm.id}`); } // 网页改设置 → 热切换, 无需重启长跑
    // 认知②: 召回在场角色的显著情景记忆 → 章节作前情回响(callback)
    const present = new Set(Object.values(snap.snapshot.characters).filter((c) => c.present).map((c) => c.id));
    const echoes = store.readSalientMemories(db, worldId, 0.6, 6).filter((m) => present.has(m.characterId)).map((m) => m.body);
    const baseEcho = echoes.length ? `${bible}\n【角色近事回响】${echoes.slice(0, 4).join("；")}` : bible;
    // M2 终身记忆: 每角色 persona digest(canon属性+M1心境+恩怨账+执念) + 宿缘旧账, 注入前情 → 角色带一生与恩怨出场(零新 LLM)
    const persona = personaBlock(snap.snapshot, loadCanon(ROOT), 8, GENTLE); // 温润: persona 附声口指纹(进 outline 前情)
    voiceCard = GENTLE ? voiceCardBlock(snap.snapshot) : ""; // 声口卡(去恩怨·控长)→ 写对白 secPrompt, 修 persona 只进 outline 不进 secPrompt 的断点
    const shared = recallShared(store.readSalientMemories(db, worldId, 0.6, 40), snap.snapshot);
    const sharedOn = !GENTLE || n % VOL === 1; // [治理·registry#20 降频] 宿缘旧账疗效未证→温润只在卷首章注(爽文原频不变)
    const bibleEcho = [baseEcho, persona, sharedOn && shared.length ? "【宿缘·同框者旧账(可点到)】" + shared.slice(0, 3).join("；") : ""].filter(Boolean).join("\n");
    // 叙事·伏笔账: 到期回收 / 每 6 章埋设(开放伏笔 < 3 时), 形成 setup→payoff 跨章结构
    const fsList = readFs();
    let weave = "";
    let paidDue: Foreshadow | undefined; // 落盘成功后才置 paid + writeFs(防守门弃章 → 伏笔假回收 + 灌假 consFit 适应度)
    let plantedF: Foreshadow | undefined;
    const due = fsList.find((f) => !f.paid && f.dueCh <= n);
    if (due) {
      const mentioned = GENTLE ? Object.values(snap.snapshot.characters).filter((c) => c.name && due.desc.includes(c.name)) : []; // [Q7] 伏笔生死校验: 所涉人物全不在场→改追忆/遗物/转述措辞(防回收时把已陨/已走者写活)
      const allAbsent = mentioned.length > 0 && mentioned.every((c) => !c.present);
      weave = allAbsent
        ? `回收伏笔——所涉之人已不在场，以追忆、遗物或他人转述的方式给出回应或揭其真相："${due.desc}"`
        : `回收伏笔——给出回应或揭其真相："${due.desc}"`;
      if (GENTLE && beatForChapter(outlinePlan, n)) weave += "；并顺势推进本阶段主线"; // [Q8] 回收并入主线(伏笔不再抢断进展方向)
      paidDue = due;
      console.log(`  ⟡ 回收伏笔: ${due.desc}`);
    } else if (n % 6 === 0 && fsList.filter((f) => !f.paid).length < 3) {
      const fsGoal = GENTLE ? beatForChapter(outlinePlan, n) : ""; // [Q8] 伏线宜顺主线方向生长(仅温润; 爽文共用行需授权未动)
      const fsKind = GENTLE ? `『伏线』(一桩牵念/一件旧物/一个未竟之约/一段故人将至的因缘，温润日常向、勿用悬疑惊险字眼，≤24字)` : `"伏笔"(一桩悬念/隐秘/信物/预言/未了之债，≤24字)`;
      const hook = (await llm.complete(`${sys}\n据当前态势构思一个可在 8~14 章后回收的${fsKind}，只回伏笔本身：${fsGoal ? `\n本阶段主线：${fsGoal}（伏线宜顺主线方向生长）` : ""}\n世界大事：${crisis}\n在场：${ros.slice(0, 200)}`)).replace(/\s+/g, " ").replace(/[《》「」#]/g, "").slice(0, 30);
      if (hook) {
        plantedF = { id: `fs-${n}`, desc: hook, plantedCh: n, dueCh: n + 8 + (n % 7), paid: false };
        weave = `自然埋下一个伏笔(只露端倪、勿点破)："${hook}"`;
        console.log(`  ⟡ 埋伏笔: ${hook}（第${plantedF.dueCh}章回收）`);
      }
    }
    // [T2] weave 空窗兜底: 无伏笔可写(weave==="")的空窗章, 由进展账本补一句温润推进任务(经现成 weave→【本章叙事任务·须落实】注入)。仅 GENTLE; 与 outlineBeat 软方向互补(阶段方向 vs 本章一小步)。
    if (GENTLE && pledger && weave === "") {
      const stageGoal = beatForChapter(outlinePlan, n);
      const curBeat = beatObjForChapter(outlinePlan, n);
      const prevStage = curBeat ? beatForChapter(outlinePlan, curBeat.from - 1) : ""; // 上一阶段落点(取不到给"")
      // [E2 T2'] 涌现际遇结构事实 → 作 nextProgressTask 第5参附带(单路: 只此一处入 weave, 由 gap<8 节流; 同份 newEvs 零额外读库)。
      const emerge = renderEmergence(gentleEmergence(newEvs, snap.snapshot, seenFactions, seenPairs));
      if (stageGoal) weave = nextProgressTask(pledger, n, stageGoal, prevStage, emerge);
      else if (MICRO_TENSION_ON && n % 4 !== 0) weave = `${MICRO_TENSION[n % MICRO_TENSION.length]!}${emerge ? `。世间近来有这些动静，可拾一二自然融入：${emerge}` : ""}`; // [修1b] 纯涌现世界兜底: stageGoal 恒空+emerge 算出即丢——一并接活; n%4===0 留呼吸章
    }
    conBlock = constraintsBlock(loadConstraints(ROOT).active); // 拾取议事已批准的铁律变更(规则层概念空间)
    situAnchor = GENTLE && pledger ? [pledger.situation.place && `身在${pledger.situation.place}`, pledger.situation.role && `身份：${pledger.situation.role}`, pledger.situation.nearPerson && `近旁有${pledger.situation.nearPerson}`].filter(Boolean).join("；") : ""; // [Q9] 进展账本机读处境→outline 锚(防情境字符串漂移)
    const ch = await writeChapter({ n, vol, scene, crisis, bible: bibleEcho, ros, recent, prevHook, weave, outlineBeat: beatForChapter(outlinePlan, n), obedience: outlinePlan?.obedience ?? "strict", ambience, sceneAvoid, gdDomain });
    lastChLen = ch.text.replace(/\s/g, "").length; // [Q2] 供下章软上限判定(上章超配→降段配额)

    if (ch.text.replace(/\s/g, "").length < MINLEN * 0.4) { // 守门: 疑似 LLM 失败回退占位(正常≥3000字)→ 不落盘、退避重试本章, 不推进(防垃圾入正文/污染进化)
      console.log(`  ⚠ 第${n}章疑似生成失败(仅${ch.text.length}字, 多半 DeepSeek 瞬时故障回退占位)→ 弃, 30s 后重试本章`);
      n--; await new Promise((r) => setTimeout(r, 30000)); continue;
    }
    writeFileSync(join(CH_DIR, `ch-${String(n).padStart(4, "0")}.md`), `# 第${n}章　${ch.goal}\n\n${ch.text}\n`, "utf8");
    store.saveChapter(db, { id: `saga-ch-${n}`, worldId, goal: ch.goal, text: ch.text, status: "inscribed", createdAt: Date.now() });
    // [T2] 本章落盘成功 → 追加拍子签名到进展账本(防循环历史; 滚动近 12 章)。turn 计数器自增, resume 确定性。仅 GENTLE。
    if (GENTLE && pledger) {
      pledger.writtenBeats.push({ sig: beatSig(ch.goal, ch.hook), ch: n });
      pledger.writtenBeats = pledger.writtenBeats.slice(-12);
      pledger.turn++;
      savePL(ROOT, pledger);
    }
    // ── 本章落盘成功 → 现在才提交叙述耦合副作用(守门弃章则下面一概未发生 → 干净重试; 修审计「守门 n-- 不回滚 evCursor/复兴/伏笔」)。世界步进已在上方提交但 evCursor 未推进→新事件下章补叙不重复 ──
    for (const e of newEvs) evCursor = Math.max(evCursor, e.seq ?? 0);
    for (const e of newEvs) if (e.kind === "FactionDissolved") { const f = (e.payload as { faction?: string }).faction; if (f) revivals.push({ faction: f, at: n + 8 }); }
    for (const rs of reviveSpawns) store.enqueueInput(db, `revive-${rs.faction}-${n}`, worldId, "spawn-character", { character: rs.reviver }, Date.now());
    revivals = revivals.filter((r) => n < r.at);
    if (paidDue) { paidDue.paid = true; writeFs(fsList); }
    else if (plantedF) { fsList.push(plantedF); writeFs(fsList); }
    // M3 批量异步反思(落盘后跑: 守门弃章不浪费 LLM、不双重累加卷入度)
    if (EVOLVE) {
      try {
        accrueImportance(minds, newEvs, snap.snapshot);
        if (n - minds.lastReflectCh >= 3) {
          const queue = selectQueue(minds, snap.snapshot, minds.force); // force-set 角色即便未破阈也 union 进队(里程碑大事必反思)
          minds.lastFp = minds.lastFp ?? {};
          const fresh: string[] = []; let cachedN = 0;
          const forceSet = new Set(minds.force ?? []); // 大事经历者(复仇/破境/羁绊者陨落)强制反思, 绕过 M4 情境指纹缓存(防漏反思)
          for (const id of queue) { const c = snap.snapshot.characters[id]; if (!c) continue; if (forceSet.has(id) || situationFp(c) !== minds.lastFp[id]) fresh.push(id); else { delete minds.pendingImp[id]; cachedN++; } } // M4: 情境未变且无大事→复用旧心声、不调 LLM
          if (fresh.length) {
            const recentByChar = (c: CharacterState): string =>
              newEvs.filter((e) => (e.payload as { characterId?: string })?.characterId === c.id || (e.summary ?? "").includes(c.name)).map((e) => e.summary).filter((s): s is string => !!s).slice(-2).join("；") || "近来世事牵动";
            const updates = await batchReflect(llm, sys, snap.snapshot, fresh, crisis, recentByChar);
            if (updates.length) {
              store.enqueueInput(db, `mind-${n}`, worldId, "mind-update", { updates }, Date.now());
              for (const id of fresh) { delete minds.pendingImp[id]; const c = snap.snapshot.characters[id]; if (c) minds.lastFp[id] = situationFp(c); } // 反思过即清零 + 记指纹
              minds.lastReflectCh = n;
              console.log(`  🧠 批量反思 ${updates.length} 人(1次LLM${cachedN ? "·缓存复用" + cachedN + "人" : ""}): ${updates.slice(0, 3).map((u) => (snap.snapshot.characters[u.id]?.name ?? u.id) + "「" + u.mind + "」").join(" ")}`);
            }
          } else if (cachedN) minds.lastReflectCh = n;
        }
        saveMinds(ROOT, minds);
      } catch (e) { console.log("  🧠 反思跳过:", String(e).slice(0, 60)); }
    }
    try { // 发 compose 事件 → SSE 点亮「成文」灯 + 触发网页"新章已落"+刷新(长跑此前不发, 故成文灯不亮)
      store.appendEvent(db, { id: `compose:ch${n}:ChapterInscribed`, worldId, lineId: "main", tick: n * 3, kind: "ChapterInscribed", subsystem: "compose", severity: "notable", verb: "成文", subject: ch.goal, summary: `第${n}章《${ch.goal}》落成`, payload: { kind: "ChapterInscribed", chapterId: `saga-ch-${n}`, sceneIds: [] }, ts: Date.now() });
    } catch { /* 灯轨非关键, 失败不影响写章 */ }
    recent.push(`第${n}章「${ch.goal}」`);
    prevHook = ch.hook;
    // [档C②·内存态落盘·蓝图§3.2] 每章原子写 runtime-state.json(tmp+rename) → 跨重启恢复 forbid/标题同构闸/复兴排期/涌现新颖闸。确定性·全世界通用。
    writeRuntimeState({ ch: n, recent: recent.slice(-64), prevHook, revivals, seenFactions: [...seenFactions], seenPairs: [...seenPairs], prevPresent: [...prevPresent], lastChLen });

    if (n % 8 === 0) { // 一致性: 更新设定档 canon + 校验矛盾, 喂生成(修正)与适应度(canonStep 先于 evolveOnce)
      try {
        const rcc = store.readRecentChapters(db, worldId, 8).map((c) => ({ goal: c.goal, text: c.text }));
        const cs = await canonStep(llm, sys, ROOT, rcc, n, derivedFacts(deriveCanon(snap.snapshot, tierName))); // 传引擎权威硬事实, 一致性校验据此判 prose 对错(不再让 LLM 自抽境界)

        // 可验证子目标②: 伏笔回收率(据伏笔账本, 到期未收=扣分)
        const fsAll = readFs(); const due = fsAll.filter((f) => f.dueCh <= n);
        const fsRate = due.length ? +((due.filter((f) => f.paid).length / due.length) * 10).toFixed(1) : 10;
        const cc = loadCanon(ROOT); cc.lastForeshadow = fsRate; saveCanon(ROOT, cc);
        canonInject = canonBlock(cc);
        console.log(`  📜 canon ${Object.keys(cs.canon.characters).length}人·一致性${cs.score}/10·伏笔回收${fsRate}/10${cs.contradictions.length ? " ⚠" + cs.contradictions[0]!.slice(0, 32) : ""}`);
      } catch (e) { console.log("  📜 canon 跳过:", String(e).slice(0, 60)); }
    }
    // [T2] 每 8 章里程碑判定: 搭 canonStep 同班 LLM 读近 8 章判处境 + 哪些里程碑真达成, 写回账本(真 ground truth, 非自评)。仅 GENTLE。
    if (GENTLE && pledger && n % 8 === 0) {
      try {
        const rc = store.readRecentChapters(db, worldId, 8);
        pledger = await advanceStep(pledger, rc.map((c) => ({ goal: c.goal, text: c.text })), arcMilestonesFromPlan(outlinePlan), n, llm);
        savePL(ROOT, pledger);
        console.log(`  🌱 进展账本: 已达里程碑 ${pledger.reachedMilestones.length}/${arcMilestonesFromPlan(outlinePlan).length} · 处境「${pledger.situation.place || "—"}/${pledger.situation.role || "—"}」 · 近挪移第${pledger.lastAdvanceCh}章`);
      } catch (e) { console.log("  🌱 进展账本跳过:", String(e).slice(0, 60)); }
    }
    if (n % 8 === 0) {
      if (GENTLE) { const rc = store.readRecentChapters(db, worldId, 4); gdLastMotifs = motifSig(rc.map((c) => c.goal), rc.map((c) => c.text)); } // T1-①[C3]: 由近章正文算 2-gram 静物指纹, 喂 rollSummary 剔除→断 bible 自反馈(主因)
      bible = await rollSummary(bible, recent.slice(-8), GENTLE ? gdLastMotifs : []);
      if (EVOLVE) {
        try {
          const recentRows = store.readRecentChapters(db, worldId, 48); // 近 48 章(novelty 对照窗口; 不再读全量千章正文); 保留 id → [P1-1] draft 双轨按章号对齐
          const recentCh = recentRows.map((c) => ({ goal: c.goal, text: c.text })); // 成稿窗: warm/novelty/导演用照旧读成稿(P1-1 只换 evolveOnce 评估窗)
          // 模拟层 fitness: 先算好存盘(evolveOnce 会读它折进基因适应度; server 读出来画曲线)
          const spf = store.loadSnapshot(db, worldId);
          if (spf) {
            const sf = computeSimFitness(store.readRecentEvents(db, worldId, 800), spf.snapshot, recentCh, vol, n); // 近 800 事件(recency 加权下足够; sift/张力按近窗算)
            Object.assign(sf as unknown as Record<string, unknown>, { dramaLog: _sfTele.dramaLog, clampLog: _sfTele.clampLog }); // [P0-1·四账①④] saveSimFitness 整写文件 → 账字段随评估窗重挂(只增不删)
            saveSimFitness(ROOT, sf);
            console.log(`  🌍 模拟层${sf.total}/10 · 故事链${sf.sift.score}(${sf.sift.chains}条:${Object.entries(sf.sift.patterns).map(([k, v]) => k + v).join(",")}) · 派系张力${sf.tension.score}(势均${sf.tension.balance}/交锋${sf.tension.directness}/化解${sf.tension.resolution}) · 新颖${(sf.novelty * 10).toFixed(1)}${sf.sift.dangling.length ? " · 悬而未决:" + sf.sift.dangling.length : ""}`);
            if (GENTLE) { // T3: 温情专属 fitness 平行 slot(零冲突项, W_var 用 2-gram 名词指纹 → 测 novelty 看不见的坍塌)。evolveOnce GENTLE 分支折进基因。
              const wf = computeWarmFit(store.readRecentEvents(db, worldId, 800), spf.snapshot, recentCh, ROOT); // [T3] 补 ROOT 入参: progressMomentum 读 progression-ledger.json 算 W_progress
              saveWarmFit(ROOT, wf);
              console.log(`  🌿 温情层${wf.total}/10 · 场景多样${wf.var} · 关系暖${wf.bond} · 人情${wf.social} · 善了${wf.arc} · 推进${wf.progress} · 涌现${wf.emerge} · 留白${wf.breath}`);
            }
          }
          // [P1-1·draft 双轨 gate·蓝图§3.2·默认关] NOVEL_FIT_DRAFT=1: 进化评估窗(critique/metricsOf/avoidHits 全在 evolveOnce 内消费此窗)读修订前草稿(drafts 表·缺 draft 的章回退成稿)→ 量基因的"制造量"而非 edit-pass 擦除后的成稿(断"genome 替编辑领功"归因链)。默认关=evalWin 与原 recentCh.slice(-8) 同引用语义、逐字节同。
          let evalWin = recentCh.slice(-8);
          if (FIT_DRAFT) {
            const chOf = (id: string): number => Number(id.replace(/^saga-ch-/, ""));
            const rows8 = recentRows.slice(-8).filter((r) => Number.isFinite(chOf(r.id)));
            if (rows8.length) {
              const dmap = new Map(store.readDrafts(db, worldId, Math.min(...rows8.map((r) => chOf(r.id))), Math.max(...rows8.map((r) => chOf(r.id)))).map((d) => [d.ch, d.text]));
              evalWin = rows8.map((r) => ({ goal: r.goal, text: dmap.get(chOf(r.id)) ?? r.text }));
            }
          }
          const evo = await evolveOnce(llm, sys, ROOT, vol, evalWin);
          evoGenome = evo.genome; evoGuidance = evo.guidance; // 下一卷据此生成
          console.log(`  🧬 ${evo.report}`);
        } catch (e) { console.log("  🧬 进化跳过:", String(e).slice(0, 80)); }
      }
      // T5 模拟器自创机制: 每 16 章让 LLM 提议一条全新世界机制 → 静态/新颖/影子模拟三闸 → 过则注入活世界(模拟器自己长出新玩法)
      if (EVOLVE && n % 16 === 0) {
        try {
          const sps = store.loadSnapshot(db, worldId);
          if (sps) { const out = await evolveSimRules(llm, sys, ROOT, sps.snapshot, PACK, recent.slice(-6).join("；"), vol); console.log(`  🧪 ${out.report}`); }
        } catch (e) { console.log("  🧪 机制提议跳过:", String(e).slice(0, 80)); }
      }
      // 规则层进化: 每 24 章, 若无待裁且距上次铁律变更≥16章, 提议一条【变革性】铁律变异 → 进议事由作者裁决
      // [P0-10·蓝图§3.1] 提案块受 CONSTRAINT_PROPOSE 门(默认=NOVEL_EVOLVE 值): 修"提案块不受 EVOLVE 门"(蓝图证据#12); 铁律三红线(永远等人/pending 堵死/不碰 accept)原样不动。
      if (CONSTRAINT_PROPOSE && n % 24 === 0) {
        try {
          const con0 = loadConstraints(ROOT);
          if (!con0.pending && n - con0.lastChangeCh >= 16) {
            // [P1-4·质变层换源 gate·蓝图§3.2·默认=现状] NOVEL_STAGNATION_SRC="clean" → 停滞判改读去偏列: W_clean 四维趋势(edit-ledger.lints·draft 侧"制造量"账) + draft-objFit 代理(scores.obj, NOVEL_FIT_DRAFT 开时即 draft 侧); 默认 "fitness"=现状(scores.fitness 滚3·污染分)。48 章强制兜底两源共用。
            let stagnating: boolean; let basis: string;
            if (STAG_SRC === "clean") {
              const xs = (loadEditLedger(ROOT).lints ?? []).slice(-12);
              const lin = (v: number, good: number, bad: number): number => Math.max(0, Math.min(10, 10 * (bad - v) / (bad - good)));
              const cleanOf = (x: { similePerK: number; microPerK: number; settleRatio: number; pauseBeats: number }): number => (lin(x.microPerK, 1.7, 3.0) + lin(x.settleRatio, 0.05, 0.12) + lin(x.pauseBeats, 3, 6) + lin(x.similePerK, 4, 6)) / 4; // 与 warm-fitness.cleanSignal 同式(draft 侧 W_clean)
              const mean = (a: number[]): number => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 5);
              const half = Math.floor(xs.length / 2);
              const dClean = Math.abs(mean(xs.slice(half).map(cleanOf)) - mean(xs.slice(0, half).map(cleanOf)));
              const objs = loadLedger(ROOT).scores.slice(-3).map((s) => s.obj);
              const objFlat = objs.length >= 3 && Math.max(...objs) - Math.min(...objs) < 0.5;
              stagnating = xs.length >= 8 && dClean < 0.5 && objFlat; // 两路去偏信号都平趴才判停滞(样本不足不触发, 交 48 章兜底)
              basis = `clean:ΔW_clean=${+dClean.toFixed(2)}(n=${xs.length})·objRange=${objs.length >= 3 ? +(Math.max(...objs) - Math.min(...objs)).toFixed(2) : "n/a"}`;
            } else {
              const fits = loadLedger(ROOT).scores.slice(-3).map((s) => s.fitness);
              stagnating = fits.length >= 3 && Math.max(...fits) - Math.min(...fits) < 0.6; // 适应度停滞=该换空间(Wiggins uninspiration)
              basis = `fitness:range=${fits.length >= 3 ? +(Math.max(...fits) - Math.min(...fits)).toFixed(2) : "n/a"}(滚3)`;
            }
            if (stagnating || n - con0.lastChangeCh >= 48) { // 停滞触发, 或每48章强制一次防僵化
              const mut = await proposeConstraintMutation(llm, sys, ROOT, recent.slice(-6).join("；"), vol);
              if (mut) {
                try { // [P1-4] 提案对象附 triggerBasis(写进 pending·纯遥测字段, 不碰 accept 路径; loadConstraints 原样带过 pending → 字段存活)
                  const cc = loadConstraints(ROOT);
                  if (cc.pending) { (cc.pending as unknown as Record<string, unknown>)["triggerBasis"] = stagnating ? basis : `forced:48ch(${basis})`; saveConstraints(ROOT, cc); }
                } catch { /* 遥测非关键 */ }
                console.log(`  ⚖ 铁律提案(${mut.kind}${stagnating ? "·因停滞" : ""}): ${mut.after ?? mut.target} ——待议事裁决`);
              }
            }
          }
        } catch (e) { console.log("  ⚖ 铁律提案跳过:", String(e).slice(0, 80)); }
      }
      await withLock(() => { // 与 step 互斥, 防 bible 写覆盖快速裁决 step 的世界推进
        const s = store.loadSnapshot(db, worldId);
        if (s) { s.snapshot.props["bible"] = bible; store.saveSnapshot(db, worldId, s.snapshot, s.lastSeq, Date.now()); } // tuning 改由 T4 控制器每章写
      });
    }
    // [§4.2/4.3·trial-request 写者侧钩子·蓝图 .audit/20260610-evolution-overhaul·NOVEL_TRIAL=1 才动(默认关=零行为)]
    // 卷边界落盘后: ①持锁同步 VACUUM INTO 导出 fork 基底(蓝图§4.3: 写者持锁点是唯一安全导出点; 严禁 fs cp 活 WAL 库=撕裂基底) ②同窗快照 state jsons ③写 trial-request.json(§3.4 schema) ④读 trial-verdict.json 幂等采纳。
    if (TRIAL && n % VOL === 0) {
      try {
        const expDir = join(ROOT, "exp", `v${vol}`);
        mkdirSync(expDir, { recursive: true });
        await withLock(() => { // ①+②: 与 step 互斥的同一持锁窗口内导出 db 基底并快照 state jsons(蓝图§4.3)
          const baseDb = join(expDir, "base.db");
          const baseDbSql = baseDb.split("'").join("''"); // SQL 单引号转义(路径含引号的极端情形); 先算好, 不在模板串 ${} 里嵌引号
          if (!existsSync(baseDb)) db.exec(`VACUUM INTO '${baseDbSql}'`); // 幂等: 已导出过(弃章重试/重启)不重导——VACUUM INTO 对已存在文件会报错
          for (const f of ["genome.json", "evolution.json", "archive.json", "drama.json", "constraints.json", "edit-ledger.json", "warm-fitness.json", "warm-fitness-history.json", "sim-fitness.json", "sim-fitness-history.json", "gentle-director.json", "progression-ledger.json", "foreshadows.json", "canon.json", "minds.json", "sim-rules.json", "outline-plan.json", "lore.json", "runtime-state.json"]) {
            try { if (existsSync(join(ROOT, f))) copyFileSync(join(ROOT, f), join(expDir, f)); } catch { /* 单文件失败不阻断 */ }
          }
        });
        // ③ trial-request.json(蓝图§3.4 schema): incumbent=FNV hash of genome JSON; candidatePool=读 dir/trial-candidates.json 若在; preregistered 主指标/守门照蓝图默认。
        const genomeRaw = existsSync(join(ROOT, "genome.json")) ? readFileSync(join(ROOT, "genome.json"), "utf8") : JSON.stringify(evoGenome);
        const candidatePool = (() => { try { const f = join(ROOT, "trial-candidates.json"); return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as Array<{ genome?: unknown; origin?: string }>) : []; } catch { return []; } })();
        const req = { vol, incumbent: (hashStr(genomeRaw) >>> 0).toString(16), forkBase: `exp/v${vol}/base.db`, candidatePool, preregistered: { primary: ["lintsPerCh_draft", "dlg1k"], guards: ["D1-D12", "弃章率", "章长cv", "rep4g", "echo"] } };
        const reqTmp = join(expDir, "trial-request.json.tmp");
        writeFileSync(reqTmp, JSON.stringify(req, null, 2), "utf8"); renameSync(reqTmp, join(expDir, "trial-request.json"));
        console.log(`  🧪 trial-request v${vol} 已落(fork=exp/v${vol}/base.db · incumbent=${req.incumbent} · 候选×${candidatePool.length})`);
        // ④ 幂等采纳 verdict(evolve.ts 未导出 adoptVerdict → 写者侧自实现·蓝图§4.2"按卷号键幂等原子采纳"): humanSigned 且该卷无 adopted marker 才动;
        //    winner=候选 hash → 从该卷 trial-request 候选池按 FNV(JSON.stringify(genome)) 对齐取基因 saveGenome 热生效; winner="incumbent"=现任续任只记 marker。genome.json 在 trial 流程里只由 verdict 写(蓝图§4.6)。
        const vdFile = join(ROOT, "trial-verdict.json");
        if (existsSync(vdFile)) {
          const vd = JSON.parse(readFileSync(vdFile, "utf8")) as { vol?: number; winner?: string; humanSigned?: boolean };
          if (vd.humanSigned === true && typeof vd.vol === "number") {
            const vdDir = join(ROOT, "exp", `v${vd.vol}`);
            const adoptedMark = join(vdDir, "verdict-adopted.json");
            if (!existsSync(adoptedMark)) {
              let applied = "incumbent 续任";
              let ok = true;
              if (vd.winner && vd.winner !== "incumbent") {
                const reqOld = (() => { try { return JSON.parse(readFileSync(join(vdDir, "trial-request.json"), "utf8")) as { candidatePool?: Array<{ genome?: unknown }> }; } catch { return null; } })();
                const hit = (reqOld?.candidatePool ?? []).find((c) => c.genome && (hashStr(JSON.stringify(c.genome)) >>> 0).toString(16) === vd.winner);
                if (hit?.genome) {
                  saveGenome(ROOT, hit.genome as Genome);
                  evoGenome = loadGenome(ROOT, worldIntent); evoGuidance = buildGuidance(loadLedger(ROOT), evoGenome, loadGlobal(ROOT).avoid); // 热生效: 下一章即用新基因
                  applied = `候选 ${vd.winner} 上任`;
                } else { applied = `候选 ${vd.winner} 未在 v${vd.vol} 池中 → 不采纳(待修正 verdict)`; ok = false; }
              }
              if (ok) { mkdirSync(vdDir, { recursive: true }); const mkTmp = adoptedMark + ".tmp"; writeFileSync(mkTmp, JSON.stringify({ vol: vd.vol, winner: vd.winner ?? "incumbent", atCh: n }), "utf8"); renameSync(mkTmp, adoptedMark); }
              console.log(`  🧪 trial-verdict v${vd.vol}: ${applied}`);
            }
          }
        }
      } catch (e) { console.log(`  🧪 trial 钩子跳过: ${String(e).slice(0, 80)}`); }
    }
    console.log(`第 ${n}/${TARGET} 章　《${ch.goal}》　${ch.text.length}字　(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  console.log(`\n完成 ${TARGET} 章 → ${CH_DIR}`);
}

// [档C①] NOVEL_PROMPT_GOLDEN=1 仅供 app/prompt-golden.ts 导入 buildOutlinePrompt/buildSecPrompt 时跳过主循环(golden 不起写者);
// 生产路径从不设此变量 → 守卫为假分支, main() 照旧立即执行, 行为零变。
if (process.env["NOVEL_PROMPT_GOLDEN"] !== "1") main().catch((e: unknown) => {
  console.error(String(e).slice(0, 300));
  process.exit(1);
});
