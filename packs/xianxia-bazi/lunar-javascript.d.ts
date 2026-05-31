// 最小 ambient 声明: 覆盖本包用到的 lunar-javascript API(排四柱/十神)
declare module "lunar-javascript" {
  interface EightChar {
    getDayGan(): string;
    getDayZhi(): string;
    getYear(): string;
    getMonth(): string;
    getDay(): string;
    getTime(): string;
    getYearShiShenGan(): string;
    getMonthShiShenGan(): string;
    getTimeShiShenGan(): string;
    getYearShiShenZhi(): string[];
    getMonthShiShenZhi(): string[];
    getDayShiShenZhi(): string[];
    getTimeShiShenZhi(): string[];
  }
  interface JieQi {
    getName(): string;
    getSolar(): SolarInstance;
  }
  interface Lunar {
    getEightChar(): EightChar;
    getPrevJieQi(wholeDay?: boolean): JieQi;
  }
  interface SolarInstance {
    getLunar(): Lunar;
    getYear(): number;
    getMonth(): number;
    getDay(): number;
  }
  export const Solar: {
    fromYmdHms(year: number, month: number, day: number, hour: number, minute: number, second: number): SolarInstance;
  };
}
