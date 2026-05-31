// packs/freeform/index.ts — 配置驱动的"自由世界"包。
// 世界 = 一份 WorldConfig(可由提示词 LLM 生成, 见 app/gen-world.ts)。
// NOVEL_WORLD_CONFIG=路径.json 指定世界; 缺省用下面的示例(末世废土)。引擎+八字+奇门一字不改。
import { readFileSync, existsSync } from "node:fs";
import { makePack, type WorldConfig } from "./make-pack";
import { plateLabel } from "../xianxia-bazi/qimen";

// 默认示例世界: 末世废土(证明随便换个 genre 都能开)
const SAMPLE: WorldConfig = {
  id: "wasteland",
  displayName: "末世废土",
  bible: "核冬之后第三十年，钢铁避难所『方舟』的四名年轻幸存者——各有八字命格，在辐射、掠夺与背叛的废土上挣扎求存、争夺最后的物资与秩序。",
  protagonists: [
    { name: "陆沉", faction: "方舟避难所" },
    { name: "野鸦", faction: "黑鸦掠夺团" },
    { name: "阿铁", faction: "废土商队" },
    { name: "灰", faction: "拾荒散众" },
  ],
  factions: ["方舟避难所", "黑鸦掠夺团", "废土商队", "变异群落", "拾荒散众", "旧军残部"],
  locations: [
    { id: "loc-ark", name: "方舟避难所", yield: 0.7 },
    { id: "loc-ruin", name: "废都遗迹", yield: 0.9 },
    { id: "loc-station", name: "废弃加油站", yield: 0.4 },
    { id: "loc-rad", name: "辐射禁区", yield: 1.0 },
    { id: "loc-market", name: "黑市集散地", yield: 0.6 },
    { id: "loc-water", name: "净水站", yield: 0.5 },
    { id: "loc-nest", name: "变异巢穴", yield: 0.3 },
  ],
  tierNames: ["拾荒者", "幸存者", "老兵", "小头目", "团长", "废土枭雄", "一方霸主", "废土王"],
  goalMap: {
    七杀格: { label: "称霸", desc: "武力割据、号令废土", axis: "initiative" },
    伤官格: { label: "称霸", desc: "不服管束、自立山头", axis: "discord" },
    劫财: { label: "夺资", desc: "抢夺物资、囤积自保", axis: "initiative" },
    偏财格: { label: "夺资", desc: "倒卖稀缺、积累家底", axis: "initiative" },
    正财格: { label: "囤积", desc: "务实囤粮、稳守一隅", axis: "caution" },
    正官格: { label: "立序", desc: "重建秩序、立规护民", axis: "caution" },
    比肩: { label: "求生", desc: "结伴自立、活下去", axis: "initiative" },
    偏印格: { label: "钻研", desc: "钻研旧世科技、独善其身", axis: "discord" },
    正印格: { label: "护佑", desc: "护佑同伴、守护避难所", axis: "caution" },
    食神格: { label: "结盟", desc: "笼络人心、缔结同盟", axis: "harmony" },
  },
  storyEvents: [
    { name: "辐射风暴", summary: "一场致命辐射风暴席卷废土，各方被迫退守、物资告急", gatherAt: "loc-ark", crisis: "辐射风暴压境，避无可避，去留见人心", stressDelta: 0.3, factionShifts: [{ a: "方舟避难所", b: "黑鸦掠夺团", delta: -2 }] },
    { name: "物资争夺", summary: "废都遗迹惊现旧世物资库，群雄闻讯而至、刀兵相向", gatherAt: "loc-ruin", crisis: "物资库现世，谁抢到谁活命", stressDelta: 0.26, factionShifts: [{ a: "黑鸦掠夺团", b: "废土商队", delta: -3 }, { a: "方舟避难所", b: "废土商队", delta: 1 }] },
    { name: "变异潮", summary: "辐射禁区的变异体倾巢涌出，人类势力被迫暂时联手", gatherAt: "loc-rad", crisis: "变异潮汹涌，存亡之际人类暂盟", stressDelta: 0.32, factionShifts: [{ a: "变异群落", b: "方舟避难所", delta: -3 }, { a: "方舟避难所", b: "废土商队", delta: 2 }] },
    { name: "黑市火并", summary: "黑市集散地一桩交易崩盘，两团火并、血染集市", gatherAt: "loc-market", crisis: "黑市火并，旧账新仇一并清算", stressDelta: 0.24, factionShifts: [{ a: "黑鸦掠夺团", b: "旧军残部", delta: -2 }] },
    { name: "避难所沦陷", summary: "方舟避难所遭内应出卖、险些沦陷，存亡一线", gatherAt: "loc-ark", crisis: "避难所被出卖，墙倒众人推", stressDelta: 0.3, factionShifts: [{ a: "方舟避难所", b: "拾荒散众", delta: -2 }, { a: "方舟避难所", b: "旧军残部", delta: 1 }] },
    { name: "净水之争", summary: "唯一的净水站水源枯竭传闻四起，各方屯水自保、暗流汹涌", gatherAt: "loc-water", crisis: "水源告危，一滴水一条命", stressDelta: 0.2, factionShifts: [] },
  ],
  arcs: [
    "核冬第三十年，四名幸存者初聚方舟、各怀心思",
    "首次出舱拾荒，遭遇掠夺团、生死一线",
    "废都遗迹寻物资，盟约与背叛并生",
    "辐射风暴压境，避难所内人心浮动",
    "变异潮爆发，人类势力被迫联手御敌",
    "黑市火并升级，卷入势力间的血仇",
    "内应出卖，避难所险些沦陷",
    "争夺最后的净水与秩序，王座之争初现",
    "废土枭雄并起，旧世遗产引动大战",
    "更大的旧军残部入局，废土棋盘骤然扩大",
  ],
  composePrompt: "你是一位末世废土题材的小说作者，文笔冷硬粗粝、节奏紧绷，擅写辐射废土上的求生、掠夺、背叛与人性挣扎。可借八字命格写人物性情、借奇门天机写时运转折，但不点破术语。",
  spawnNames: ["独眼", "毒蝎", "老周", "莉莉丝", "铁砧", "夜枭", "拾穗", "瘸腿王", "电锯", "白骨", "焦土", "渡鸦"],
  reviverNames: ["归来者", "卷土客", "复燃", "再生人", "灰中王", "东山"],
  moodWords: ["濒临崩溃", "杀机毕露", "冷静盘算", "古井无波"],
};

function loadConfig(): WorldConfig {
  const p = process.env["NOVEL_WORLD_CONFIG"];
  if (p && existsSync(p)) {
    try {
      return JSON.parse(readFileSync(p, "utf8")) as WorldConfig;
    } catch {
      /* 损坏则用示例 */
    }
  }
  return SAMPLE;
}

const built = makePack(loadConfig());
export default built.pack;
export const natalLabel = built.natalLabel;
export const goalLabel = built.goalLabel;
export const describeMind = built.describeMind;
export { plateLabel };
