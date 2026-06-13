// app/persona.ts — M2 终身记忆之「每角色 persona digest」。把 LLM 抽取的 canon 属性 + 符号态(M1 drive / 恩怨 bond / 执念 goal / 复仇)
//   拼成一段"此人此刻是谁、心里揣着什么"的定长前情, 每次其登场注入 compose → 角色带着自己的一生与恩怨出场。
//   零新 LLM(canon 已有、其余读 snapshot props)。core/ 不涉, 叶子模块。
import type { WorldSnapshot, CharacterState } from "../core/domain/world";
import type { Canon } from "./canon";
import { natalLabel } from "./pack-select"; // [修2·gentle-stakes] 命格十神→小毛病轴(已核验无环: pack-select 只 import packs+core 类型)

// M1 通用内态键 → 措辞(core 出 generic innerDrive, 这里渲染)
export const INNER_CN: Record<string, string> = { ambition: "执念在心", want: "求而不得", grudge: "意有所怨", attachment: "心有所系", vengeance: "复仇噬心", distress: "心绪如焚", calm: "" };

const numOf = (c: CharacterState, k: string): number => (typeof c.props[k] === "number" ? (c.props[k] as number) : 0);

// 声口指纹(.audit/20260608-ai-tells 症③治本·确定性派生·零 LLM·resume 安全): 历练→语速句长, innerDrive→态度句式。
//   只给句法/语速/态度倾向, 不贴固定口头禅(master-benchmark 警告: 口头禅比同腔更假)。仅 GENTLE 路径用。
const DRIVE_VOICE: Record<string, string> = {
  ambition: "语气直、少寒暄", vengeance: "话冷而短、偶尔刺一句", grudge: "答话发冷、点到为止",
  attachment: "爱以反问试探、把话往回收", want: "话里带迟疑、欲言又止", distress: "话急而碎、按不住", calm: "语慢而稳、常答非所问",
};
function deriveVoice(c: CharacterState): string {
  const li = numOf(c, "历练");
  const speed = li >= 15 ? "话疏而短、常留半句" : li < 6 ? "年少话密、爱把来龙去脉说全" : ""; // 语速/句长 ← 历练
  const drive = DRIVE_VOICE[String(c.props["innerDrive"] ?? "")] ?? ""; // 态度/句式 ← innerDrive
  const tag = [speed, drive].filter(Boolean).join("、");
  if (tag) return tag;
  return li < 6 ? "话不多、先答事实再慢补、不主动展开" : ""; // 年少无强 drive 给腼腆缺省; 中年无 drive 者不强加声口
}

// 小毛病轴(评测④『好得太标准』治本·.audit/20260609-gentle-stakes 修2): 命格十神→随身小毛病。缺点=美德的影子(同源律): 务实的影子是心疼钱、自立的影子是嘴硬——人物不裂。
//   胎记式跨章稳定(同一缺点换处境重现>每章换新毛病); 另按 narrativeStress/resource 叠状态毛病(疲惫/拮据), 随 sim 起伏=露法天然轮换。
//   每格 2 措辞按 c.id 字符和散列选(评审: 成品文案单串会被 LLM 逐字搬运成 prompt 回声=新 tic); 确定性零 LLM、resume 安全; 仅 GENTLE 消费。
const PATTERN_FLAW: Array<[string, [string, string]]> = [
  ["比肩", ["嘴硬不肯受人帮衬，担子再沉也说不沉", "逞强，累了伤了也不肯让人搭手"]],
  ["劫财", ["见不得同行俏，嘴上不说、暗暗较劲", "好胜，听人夸别家手艺就不自在"]],
  ["食神", ["贪一口嘴，能拖则拖", "嘴馋手散漫，捎带的吃食总想先尝一口"]],
  ["伤官", ["忍不住点破人短处，话到嘴边收不住", "眼尖嘴快，见活计粗糙就要说，不留情面"]],
  ["偏财", ["轻诺，应承下来转头银钱不凑手", "大手大脚记不住账，月底对不上数"]],
  ["正财", ["心疼钱，白给了东西半天还在心里拨那几文", "抠细账，抹个零头也肉疼"]],
  ["七杀", ["急性子，对磨叽的人应声一声比一声短", "性急等不得人，话没听完就接茬"]],
  ["正官", ["规矩大过人情，多收一文也非找回去不可", "古板认死理，人情面前不肯通融"]],
  ["偏印", ["多心，小账记得很久", "疑心重，旁人一句闲话琢磨一路"]],
  ["正印", ["心软不会拒绝，回头又怪自己", "耳根软，明知吃亏也驳不开情面"]],
];
function flawSeed(id: string): number { let h = 0; for (const ch of id) h = (h + ch.charCodeAt(0)) & 0xffff; return h; }
function deriveFlaw(c: CharacterState): string {
  const natal = natalLabel(c);
  const cell = PATTERN_FLAW.find(([p]) => natal.includes(p))?.[1];
  const base = cell ? cell[flawSeed(c.id) % 2]! : "";
  const stress = typeof c.narrativeStress === "number" ? c.narrativeStress : 0;
  const res = numOf(c, "resource");
  const overlay = stress >= 0.6 ? "近来乏得很，耐心比平日短" : res > 0 && res <= 12 ? "手头紧，一文钱掰着花" : "";
  return [base, overlay].filter(Boolean).join("；");
}

// 单角色 persona digest(符号合成, 零 LLM): 属性(canon) + 心境(drive) + 恩怨账(top bonds) + 执念/复仇。gentle=true 末尾附声口指纹。
export function personaDigest(c: CharacterState, snap: WorldSnapshot, canon: Canon, gentle = false): string {
  const nameOf = (id: string): string => snap.characters[id]?.name ?? id;
  const attrs = (canon.characters[c.name] ?? []).slice(0, 3); // canon 抽取的关键属性(灵根/身份/状态)
  const inner = INNER_CN[String(c.props["innerDrive"] ?? "")] ?? "";
  const bonds = Object.entries(c.props)
    .filter(([k, v]) => k.startsWith("bond:") && typeof v === "number" && Math.abs(v as number) >= 2 && snap.characters[k.slice(5)]?.present)
    .sort((a, b) => Math.abs(b[1] as number) - Math.abs(a[1] as number))
    .slice(0, 3)
    .map(([k, v]) => `${(v as number) > 0 ? "亲" : "仇"}${nameOf(k.slice(5))}`);
  const av = typeof c.props["avenge"] === "string" ? `誓为「${String(c.props["avenge"])}」复仇` : "";
  const li = numOf(c, "历练");
  const seasoned = li >= 15 ? "历经百劫" : li >= 6 ? "略有阅历" : "";
  const mind = typeof c.props["mind"] === "string" ? (c.props["mind"] as string) : ""; // M3 反思产出的当下心声
  const voice = gentle ? deriveVoice(c) : ""; // 温润: 末尾附声口指纹(进 outline 前情)
  // [治理·registry#9 立裁] 毛病不再进 outline 通道: 与 voiceCard(secPrompt)双通道冗余且为回声面×2; 声口卡侧保留(.audit/20260609-eval-governance §六.1)
  const parts = [attrs.join("、"), seasoned, inner, bonds.length ? "牵系：" + bonds.join("、") : "", av, voice ? "说话：" + voice : ""].filter(Boolean);
  if (!parts.length && !mind) return "";
  return `${c.name}——${mind ? "「" + mind + "」　" : ""}${parts.join("；")}`;
}

// 在场排序热度(模块级, personaBlock/voiceCardBlock 共用): 有复仇/强恩怨/高执念者优先(更该被前情点到)
const charHeat = (c: CharacterState): number => {
  let h = typeof c.props["avenge"] === "string" ? 3 : 0;
  for (const [k, v] of Object.entries(c.props)) if (k.startsWith("bond:") && typeof v === "number") h += Math.min(2, Math.abs(v as number) / 3);
  const d = c.props["drives"]; if (d && typeof d === "object") h += Number((d as Record<string, number>)["ambition"] ?? 0);
  return h;
};

// 在场者 persona 块(注入 compose; 取在场中最"有戏"的若干人, 避免过长)。gentle=true 每人附声口指纹 + 标题点名声气。
export function personaBlock(snap: WorldSnapshot, canon: Canon, limit = 8, gentle = false): string {
  const present = Object.values(snap.characters).filter((c) => c.present);
  const top = [...present].sort((a, b) => charHeat(b) - charHeat(a)).slice(0, limit);
  const lines = top.map((c) => personaDigest(c, snap, canon, gentle)).filter(Boolean);
  const title = gentle
    ? "【在场者·各怀心事与声口(须体现其当下心境与恩怨; 对白须随各人声气变、勿千人一腔)】"
    : "【在场者·各怀心事(须体现其当下心境与恩怨, 勿写成路人)】";
  return lines.length ? `${title}\n${lines.join("\n")}` : "";
}

// 在场者声口卡(仅 GENTLE·注入写台词的 secPrompt): 只声口、去恩怨、控长度。
//   修复"persona 只进 outline(longrun:207) 不进写对白 secPrompt(:228)"的架构断点 → 同一 LLM 写对白被按角色分流, 而非全用一种最优温润腔(.audit/20260608-ai-tells 症③治本)。
const FLAW_ON = process.env["NOVEL_FLAW"] !== "0"; // [EXP-2臂gate·registry#8毛病轴]
export function voiceCardBlock(snap: WorldSnapshot, limit = 4): string {
  const present = Object.values(snap.characters).filter((c) => c.present);
  const top = [...present].sort((a, b) => charHeat(b) - charHeat(a)).slice(0, limit);
  const lines = top.map((c, k) => {
    const v = deriveVoice(c);
    const f = FLAW_ON && k < 2 ? deriveFlaw(c) : ""; // [修2·评审节食] 毛病只给 heat 前2人; NOVEL_FLAW=0=EXP-2消融臂
    const seg = [v, f ? `小毛病：${f}` : ""].filter(Boolean).join("；");
    return seg ? `${c.name}：${seg}` : "";
  }).filter(Boolean);
  return lines.length ? `【在场者声口与小毛病·对白随各人声气变、勿千人一腔；毛病全章合计只漏两三处、半句话级，漏完即收：不解释、不找补、不让旁人夸『其实心好』、叙述者不替他把代价洗掉；勿照搬此处字句，须换措辞换场合露】\n${lines.join("\n")}` : "";
}

// 宿缘召回(零 LLM, 词法): 从显著记忆里挑"同时点到两位在场者"的旧账, 让同框者想起前事
export function recallShared(salient: Array<{ characterId: string; body: string }>, snap: WorldSnapshot, limit = 3): string[] {
  const present = Object.values(snap.characters).filter((c) => c.present);
  const names = present.map((c) => c.name).filter(Boolean);
  const out: string[] = [];
  for (const m of salient) {
    const hit = names.filter((n) => n && m.body.includes(n));
    if (hit.length >= 2) { out.push(m.body); if (out.length >= limit) break; }
  }
  return out;
}
