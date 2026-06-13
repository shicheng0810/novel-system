// app/opener-facts.ts — P2 Phase B·开篇事实底牌(OFS·.audit/20260612-consistency-research/P2-opener-facts-spec)。
//   worlds/<saga>.json 既有硬事实(主角名+派系 / 规范地点名)→ 数据型紧凑串 → 开篇 ch1-5 注入·防开篇改名/换数/角色错位/造异名。
//   机理: 开篇是事实一致性最难章(canon.json 开篇尚空·canonHard 只带 sim 境界派系不带散文微事实·in-medias-res 把最多首次确立事实塞 ch1)。硬事实配置里本有, 只是没 seed 进 ch1。
//   零随机·确定性·**非散文(数据条·避 induction-head 复制·同 FACT_LEDGER v2 教训)**·仅 GENTLE·空则注入自坍缩(golden 逐字节同)·resume 安全。
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

interface WorldCfg { protagonists?: Array<{ name?: string; faction?: string }>; locations?: Array<{ name?: string } | string>; }

// 据 worlds/<saga>.json 生成开篇事实底牌串(数据型)。无配置/空→返回""(注入坍缩)。
export function buildOpenerFacts(saga: string, out = join(process.cwd(), ".novel-output")): string {
  try {
    const f = join(out, "worlds", `${saga}.json`);
    if (!existsSync(f)) return "";
    const w = JSON.parse(readFileSync(f, "utf8")) as WorldCfg;
    const chars = (w.protagonists ?? []).map((p) => `${p.name ?? ""}=${p.faction ?? ""}`).filter((x) => x.length > 1 && !x.startsWith("="));
    const locs = (w.locations ?? []).map((l) => (typeof l === "string" ? l : l.name ?? "")).filter(Boolean);
    if (!chars.length && !locs.length) return "";
    const parts: string[] = [];
    if (chars.length) parts.push(`角色身份(勿改名/勿换派系): ${chars.join("; ")}`);
    if (locs.length) parts.push(`地点规范名(勿造异名·勿把同一地写成两个名): ${locs.join("/")}`);
    return `【本世界既定事实·开篇须据此立稳, 勿与之矛盾(同一人/地/数, 后文不得给冲突值)】\n${parts.join("\n")}`;
  } catch { return ""; }
}
