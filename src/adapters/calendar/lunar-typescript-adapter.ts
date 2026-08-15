import { Solar } from "lunar-typescript";
import { isStemBranch } from "../../domain/calendar/constants";
import { parseBeijingDateTime } from "../../domain/calendar/beijing-time";
import { CalendarDomainError, type BeijingDateTime, type CalendarAdapter, type CalendarPrimitives, type SolarTermBoundary } from "../../domain/calendar/types";

const JIE_NAMES = new Set(["立春", "惊蛰", "清明", "立夏", "芒种", "小暑", "立秋", "白露", "寒露", "立冬", "大雪", "小寒"]);
const ZHONG_QI_NAMES = new Set(["雨水", "春分", "谷雨", "小满", "夏至", "大暑", "处暑", "秋分", "霜降", "小雪", "冬至", "大寒"]);

function solarText(solar: Solar): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${solar.getYear()}-${pad(solar.getMonth())}-${pad(solar.getDay())}T${pad(solar.getHour())}:${pad(solar.getMinute())}:${pad(solar.getSecond())}`;
}

function boundary(value: { getName(): string; getSolar(): Solar }, kind: "jie" | "zhongqi"): SolarTermBoundary {
  const name = value.getName();
  if (!(kind === "jie" ? JIE_NAMES : ZHONG_QI_NAMES).has(name)) {
    throw new Error(`历法库返回了未知${kind === "jie" ? "节" : "中气"}：${name}`);
  }

  const solar = value.getSolar();
  const beijingDateTime = solarText(solar);
  try {
    return { name, kind, beijingDateTime, utcEpochMs: parseBeijingDateTime(beijingDateTime).utcEpochMs };
  } catch (error) {
    if (!(error instanceof CalendarDomainError) || error.detail.code !== "OUT_OF_SUPPORTED_RANGE") throw error;
    return {
      name,
      kind,
      beijingDateTime,
      utcEpochMs: Date.UTC(solar.getYear(), solar.getMonth() - 1, solar.getDay(), solar.getHour(), solar.getMinute(), solar.getSecond()) - 8 * 60 * 60 * 1000,
    };
  }
}

function assertBoundaryOrder(time: BeijingDateTime, previous: SolarTermBoundary, next: SolarTermBoundary, kind: string): void {
  if (previous.utcEpochMs > time.utcEpochMs || next.utcEpochMs <= time.utcEpochMs || previous.utcEpochMs >= next.utcEpochMs) {
    throw new Error(`历法库返回了非单调${kind}边界`);
  }
}

export class LunarTypescriptAdapter implements CalendarAdapter {
  read(time: BeijingDateTime): CalendarPrimitives {
    const solar = Solar.fromYmdHms(time.year, time.month, time.day, time.hour, time.minute, time.second);
    const lunar = solar.getLunar();
    const civilDayPillar = lunar.getDayInGanZhiExact2();
    if (!isStemBranch(civilDayPillar)) {
      throw new Error("历法库返回了无效干支日");
    }

    const liChunSolar = Solar.fromYmdHms(time.year, 7, 1, 12, 0, 0).getLunar().getJieQiTable()["立春"];
    if (!liChunSolar) {
      throw new Error("历法库缺少立春边界");
    }

    const previousJie = boundary(lunar.getPrevJie(false), "jie");
    const nextJie = boundary(lunar.getNextJie(false), "jie");
    const previousZhongQi = boundary(lunar.getPrevQi(false), "zhongqi");
    const nextZhongQi = boundary(lunar.getNextQi(false), "zhongqi");
    assertBoundaryOrder(time, previousJie, nextJie, "节");
    assertBoundaryOrder(time, previousZhongQi, nextZhongQi, "中气");

    return {
      lunarDate: {
        year: lunar.getYear(),
        month: Math.abs(lunar.getMonth()),
        day: lunar.getDay(),
        isLeapMonth: lunar.getMonth() < 0,
        display: lunar.toString(),
      },
      civilDayPillar,
      liChun: boundary({ getName: () => "立春", getSolar: () => liChunSolar }, "jie"),
      previousJie,
      nextJie,
      previousZhongQi,
      nextZhongQi,
    };
  }
}
