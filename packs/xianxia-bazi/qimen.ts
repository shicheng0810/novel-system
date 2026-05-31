// packs/xianxia-bazi/qimen.ts — 时家奇门遁甲·转盘排局(确定性, 无随机/无 Date.now)
// 节气→阴阳遁+三元定局 → 地盘飞布三奇六仪 → 旬首定值符值使 → 转盘排九星/八门/八神 → 复合读吉凶。
// 比"按 tick 轮八门"真得多: 局随节气、值使随时辰移宫、吉凶由门+星+神合参。
import { Solar } from "lunar-javascript";

const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
// 地盘飞布次序: 六仪(戊己庚辛壬癸) + 三奇(丁丙乙)
const YI_QI = ["戊", "己", "庚", "辛", "壬", "癸", "丁", "丙", "乙"];
// 旬首 → 所遁之仪(甲子戊/甲戌己/甲申庚/甲午辛/甲辰壬/甲寅癸)
const XUN_YI: Record<string, string> = { 甲子: "戊", 甲戌: "己", 甲申: "庚", 甲午: "辛", 甲辰: "壬", 甲寅: "癸" };
// 九星本宫(洛书宫位 1-9)
const STARS: Record<number, string> = { 1: "天蓬", 2: "天芮", 3: "天冲", 4: "天辅", 5: "天禽", 6: "天心", 7: "天柱", 8: "天任", 9: "天英" };
// 八门转盘固定环(后天卦序: 坎1艮8震3巽4离9坤2兑7乾6)
const RING8 = [1, 8, 3, 4, 9, 2, 7, 6];
const GATE_RING = ["休门", "生门", "伤门", "杜门", "景门", "死门", "惊门", "开门"];
const GODS = ["值符", "螣蛇", "太阴", "六合", "白虎", "玄武", "九地", "九天"];
// 节气三元局数(上元/中元/下元), 阳遁冬至→芒种 / 阴遁夏至→大雪
const JU_TABLE: Record<string, [number, number, number]> = {
  冬至: [1, 7, 4], 小寒: [2, 8, 5], 大寒: [3, 9, 6], 立春: [8, 5, 2], 雨水: [9, 6, 3], 惊蛰: [1, 7, 4],
  春分: [3, 9, 6], 清明: [4, 1, 7], 谷雨: [5, 2, 8], 立夏: [4, 1, 7], 小满: [5, 2, 8], 芒种: [6, 3, 9],
  夏至: [9, 3, 6], 小暑: [8, 2, 5], 大暑: [7, 1, 4], 立秋: [2, 5, 8], 处暑: [1, 4, 7], 白露: [9, 3, 6],
  秋分: [7, 1, 4], 寒露: [6, 9, 3], 霜降: [5, 8, 2], 立冬: [6, 9, 3], 小雪: [5, 8, 2], 大雪: [4, 7, 1],
};
const YANG = new Set(["冬至", "小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明", "谷雨", "立夏", "小满", "芒种"]);
// 吉凶: 门(主) / 星 / 神 的吉凶倾向(正=趋凶, 负=趋吉, 喂 stress 缩放)
const GATE_OMEN: Record<string, { omen: "吉" | "平" | "凶"; advice: string; mult: number }> = {
  开门: { omen: "吉", advice: "宜远行、谒贵、正面破局", mult: 0.7 },
  休门: { omen: "吉", advice: "宜休养、和谈、化干戈", mult: 0.65 },
  生门: { omen: "吉", advice: "宜求财、结盟、寻机缘", mult: 0.6 },
  景门: { omen: "平", advice: "主文书血光、慎信传言", mult: 1.05 },
  杜门: { omen: "平", advice: "宜隐遁固守、不宜张扬", mult: 0.95 },
  伤门: { omen: "凶", advice: "忌争斗远行、易受创", mult: 1.3 },
  惊门: { omen: "凶", advice: "主惊惧口舌、谨防暗算", mult: 1.3 },
  死门: { omen: "凶", advice: "大凶、忌动土征伐、宜按兵", mult: 1.5 },
};
const STAR_ADJ: Record<string, number> = { 天心: -0.1, 天任: -0.1, 天辅: -0.1, 天禽: -0.05, 天冲: 0, 天英: 0.05, 天柱: 0.1, 天蓬: 0.1, 天芮: 0.15 };
const GOD_ADJ: Record<string, number> = { 太阴: -0.1, 六合: -0.1, 值符: -0.1, 九天: -0.05, 九地: -0.05, 朱雀: 0.05, 玄武: 0.1, 螣蛇: 0.1, 白虎: 0.15 };

function gzIndex(gz: string): number {
  const g = STEMS.indexOf(gz[0] ?? ""), z = BRANCHES.indexOf(gz[1] ?? "");
  for (let i = 0; i < 60; i++) if (i % 10 === g && i % 12 === z) return i;
  return 0;
}
const nextP = (p: number, dir: number): number => ((p - 1 + dir + 9) % 9) + 1; // 1..9 循环
function palaceOf(ground: Record<number, string>, stem: string): number {
  for (let p = 1; p <= 9; p++) if (ground[p] === stem) return p;
  return 5;
}

export interface QimenPlate {
  dun: "阳" | "阴";
  ju: number;
  jieqi: string;
  hourGZ: string;
  dutyStar: string; // 值符
  dutyGate: string; // 值使
  dutyGatePalace: number; // 值使落宫
  godAtDuty: string; // 值使宫八神
}

// tick → 时辰粒度日期(2 时辰... 实为 2h/tick = 1 时辰/tick); 显式 UTC, 确定性可重放
export function qimenDate(tick: number): Date {
  return new Date(Date.UTC(2000, 0, 1) + tick * 2 * 3600000);
}

export function castQimen(date: Date): QimenPlate {
  const y = date.getUTCFullYear(), mo = date.getUTCMonth() + 1, d = date.getUTCDate(), h = date.getUTCHours();
  let jieqi = "冬至", hourGZ = "甲子", daysIn = 0;
  try {
    const lunar = Solar.fromYmdHms(y, mo, d, h, 0, 0).getLunar();
    hourGZ = lunar.getEightChar().getTime();
    const jq = lunar.getPrevJieQi(true);
    jieqi = jq.getName();
    const js = jq.getSolar();
    daysIn = Math.max(0, Math.floor((Date.UTC(y, mo - 1, d) - Date.UTC(js.getYear(), js.getMonth() - 1, js.getDay())) / 86400000));
  } catch {
    /* 回落默认局 */
  }
  const dun: "阳" | "阴" = YANG.has(jieqi) ? "阳" : "阴";
  const dir = dun === "阳" ? 1 : -1;
  const yuan = Math.min(2, Math.floor(daysIn / 5)); // 上元0/中元1/下元2(每元5日)
  const ju = (JU_TABLE[jieqi] ?? [1, 7, 4])[yuan] ?? 5;

  // 地盘飞布三奇六仪: 戊起局数宫, 阳顺阴逆
  const ground: Record<number, string> = {};
  let p = ju;
  for (const stem of YI_QI) {
    ground[p] = stem;
    p = nextP(p, dir);
  }

  // 旬首定值符值使
  const idx = gzIndex(hourGZ);
  const xunHeadIdx = Math.floor(idx / 10) * 10;
  const xunHead = (STEMS[xunHeadIdx % 10] ?? "甲") + (BRANCHES[xunHeadIdx % 12] ?? "子");
  const yi = XUN_YI[xunHead] ?? "戊";
  const fuPalace = palaceOf(ground, yi); // 值符星本宫
  const dutyStar = STARS[fuPalace] ?? "天禽";
  // 时干宫: 值符随时干移宫(甲遁于旬首仪)
  const hourGan = hourGZ[0] ?? "甲";
  const shiganPalace = hourGan === "甲" ? fuPalace : palaceOf(ground, hourGan);

  // 八门转盘: 值使门随时辰移宫(旬内时辰序)
  const gateOffset = idx - xunHeadIdx; // 0..9
  const fuRingIdx = RING8.indexOf(fuPalace === 5 ? 2 : fuPalace);
  const dutyGate = GATE_RING[fuRingIdx === -1 ? 0 : fuRingIdx] ?? "休门";
  const landRing = (((fuRingIdx === -1 ? 0 : fuRingIdx) + gateOffset * dir) % 8 + 8) % 8;
  const dutyGatePalace = RING8[landRing] ?? 1;

  // 八神转盘: 值符神坐值符星所到之时干宫, 阳顺阴逆
  const godSeat = shiganPalace === 5 ? 2 : shiganPalace;
  const seatRing = RING8.indexOf(godSeat);
  const godPlate: Record<number, string> = {};
  for (let i = 0; i < 8; i++) {
    const r = (((seatRing === -1 ? 0 : seatRing) + i * dir) % 8 + 8) % 8;
    godPlate[RING8[r] ?? 1] = GODS[i] ?? "值符";
  }
  const godAtDuty = godPlate[dutyGatePalace] ?? "值符";

  return { dun, ju, jieqi, hourGZ, dutyStar, dutyGate, dutyGatePalace, godAtDuty };
}

// 复合读吉凶: 值使门(主) + 值符星 + 值使宫八神 → omen + stress 缩放
export function readOmen(plate: QimenPlate): { omen: "吉" | "平" | "凶"; advice: string; mult: number } {
  const g = GATE_OMEN[plate.dutyGate] ?? { omen: "平" as const, advice: "虚实难料", mult: 1 };
  const adj = (STAR_ADJ[plate.dutyStar] ?? 0) + (GOD_ADJ[plate.godAtDuty] ?? 0);
  const mult = Math.max(0.5, Math.min(1.6, g.mult + adj));
  // 门定基调, 星神微调后可升降一档
  const omen: "吉" | "平" | "凶" = mult <= 0.85 ? "吉" : mult >= 1.2 ? "凶" : "平";
  return { omen, advice: g.advice, mult };
}

// 给大事/裁决的天机判语(替代旧 tick%8 轮门)
export function qimenForecast(tick: number): { line: string; mult: number; omen: "吉" | "平" | "凶" } {
  const plate = castQimen(qimenDate(tick));
  const r = readOmen(plate);
  const line = `奇门·${plate.dun}遁${plate.ju}局(${plate.jieqi})，值符${plate.dutyStar}、值使「${plate.dutyGate}」临${plate.godAtDuty}（${r.omen}）：${r.advice}`;
  return { line, mult: r.mult, omen: r.omen };
}

export function plateLabel(tick: number): string {
  const p = castQimen(qimenDate(tick));
  return `${p.dun}遁${p.ju}局·值使${p.dutyGate}(${p.godAtDuty})`;
}
