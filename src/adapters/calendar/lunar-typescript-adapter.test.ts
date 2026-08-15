import { afterEach, describe, expect, it, vi } from "vitest";
import { Solar } from "lunar-typescript";
import { parseBeijingDateTime } from "../../domain/calendar/beijing-time";
import { LunarTypescriptAdapter } from "./lunar-typescript-adapter";

const adapter = new LunarTypescriptAdapter();

function fakeTerm(name: string, text: [number, number, number, number, number, number]) {
  return { getName: () => name, getSolar: () => Solar.fromYmdHms(...text) };
}

function fakeLunar(overrides: Record<string, unknown> = {}) {
  return {
    getYear: () => 2024,
    getMonth: () => 1,
    getDay: () => 1,
    toString: () => "二〇二四年正月初一",
    getDayInGanZhiExact2: () => "甲辰",
    getJieQiTable: () => ({ "立春": Solar.fromYmdHms(2024, 2, 4, 16, 27, 7) }),
    getPrevJie: () => fakeTerm("立春", [2024, 2, 4, 16, 27, 7]),
    getNextJie: () => fakeTerm("惊蛰", [2024, 3, 5, 10, 22, 45]),
    getPrevQi: () => fakeTerm("大寒", [2024, 1, 20, 22, 7, 22]),
    getNextQi: () => fakeTerm("雨水", [2024, 2, 19, 12, 13, 12]),
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("LunarTypescriptAdapter", () => {
  it("returns only lunar and boundary primitives for the ordinary case", () => {
    const result = adapter.read(parseBeijingDateTime("2024-02-10T14:30:00"));

    expect(result).toMatchObject({
      lunarDate: { display: "二〇二四年正月初一", isLeapMonth: false },
      civilDayPillar: "甲辰",
      previousJie: { name: "立春", beijingDateTime: "2024-02-04T16:27:07" },
      nextJie: { name: "惊蛰", beijingDateTime: "2024-03-05T10:22:45" },
      previousZhongQi: { name: "大寒", beijingDateTime: "2024-01-20T22:07:22" },
      nextZhongQi: { name: "雨水", beijingDateTime: "2024-02-19T12:13:12" },
    });
    expect(result).not.toHaveProperty("monthGeneral");
    expect(result).not.toHaveProperty("yearPillar");
  });

  it("does not shift the civil lunar date or civil day pillar at 23:00", () => {
    const result = adapter.read(parseBeijingDateTime("2026-08-14T23:00:00"));

    expect(result.lunarDate.display).toBe("二〇二六年七月初二");
    expect(result.civilDayPillar).toBe("庚申");
  });

  it.each(["1900-01-01T00:00:00", "2100-12-31T23:59:59"])("loads adjacent boundaries at the supported edge %s", (value) => {
    const time = parseBeijingDateTime(value);
    const result = adapter.read(time);

    expect(result.previousJie.utcEpochMs).toBeLessThanOrEqual(time.utcEpochMs);
    expect(result.nextJie.utcEpochMs).toBeGreaterThan(time.utcEpochMs);
    expect(result.previousZhongQi.utcEpochMs).toBeLessThanOrEqual(time.utcEpochMs);
    expect(result.nextZhongQi.utcEpochMs).toBeGreaterThan(time.utcEpochMs);
  });

  it("rejects an unknown term returned by the library", () => {
    vi.spyOn(Solar.prototype, "getLunar").mockReturnValue(fakeLunar({ getPrevJie: () => fakeTerm("未知", [2024, 2, 4, 16, 27, 7]) }) as never);

    expect(() => adapter.read(parseBeijingDateTime("2024-02-10T14:30:00"))).toThrow("未知节");
  });

  it("rejects an invalid stem-branch returned by the library", () => {
    vi.spyOn(Solar.prototype, "getLunar").mockReturnValue(fakeLunar({ getDayInGanZhiExact2: () => "甲丑" }) as never);

    expect(() => adapter.read(parseBeijingDateTime("2024-02-10T14:30:00"))).toThrow("无效干支日");
  });

  it("rejects a missing annual Li Chun returned by the library", () => {
    vi.spyOn(Solar.prototype, "getLunar")
      .mockReturnValueOnce(fakeLunar() as never)
      .mockReturnValueOnce(fakeLunar({ getJieQiTable: () => ({}) }) as never);

    expect(() => adapter.read(parseBeijingDateTime("2024-02-10T14:30:00"))).toThrow("缺少立春边界");
  });

  it("rejects non-monotonic boundaries returned by the library", () => {
    vi.spyOn(Solar.prototype, "getLunar").mockReturnValue(fakeLunar({ getPrevJie: () => fakeTerm("立春", [2024, 3, 6, 10, 22, 45]) }) as never);

    expect(() => adapter.read(parseBeijingDateTime("2024-02-10T14:30:00"))).toThrow("非单调节边界");
  });
});
