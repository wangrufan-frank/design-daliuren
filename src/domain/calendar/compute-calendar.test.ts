import { describe, expect, it } from "vitest";
import { LunarTypescriptAdapter } from "../../adapters/calendar/lunar-typescript-adapter";
import { referenceSession } from "../../test/reference-session";
import type { CourseInput } from "../chart/types";
import { CALENDAR_RULE_IDS } from "./constants";
import { setCalendarCorrection } from "./corrections";
import { computeCalendar, isCalendarResult, runCalendarStage } from "./compute-calendar";
import type { CalendarAdapter, CalendarResult } from "./types";

const adapter = new LunarTypescriptAdapter();
const baseInput: CourseInput = {
  civilDateTime: "2024-02-10T14:30:00",
  timeZone: "Asia/Shanghai",
  locationName: "北京",
  longitude: 116.4074,
  latitude: 39.9042,
  corrections: {},
};

function validResult(): CalendarResult {
  const outcome = computeCalendar(baseInput, adapter);
  if (!outcome.ok) throw new Error(`expected success, got ${outcome.error.code}`);
  return outcome.value;
}

describe("computeCalendar", () => {
  it("composes the exact automatic snapshot metadata", () => {
    const result = computeCalendar(baseInput, adapter);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot).toMatchObject({
      stage: "calendar",
      dependsOn: [],
      ruleId: "calendar/traditional-beijing-zi-v1",
      source: "automatic",
      value: result.value,
    });
    expect(isCalendarResult(result.snapshot.value)).toBe(true);
  });

  it.each([
    ["yearPillar", "乙巳", (value: CalendarResult) => value.pillars.year, { automatic: "甲辰", effective: "乙巳", source: "manual" }],
    ["monthPillar", "丁卯", (value: CalendarResult) => value.pillars.month, { automatic: "丙寅", effective: "丁卯", source: "manual" }],
    ["dayPillar", "乙巳", (value: CalendarResult) => value.pillars.day, { automatic: "甲辰", effective: "乙巳", source: "manual" }],
    ["hourPillar", "甲子", (value: CalendarResult) => value.pillars.hour, { automatic: "辛未", effective: "甲子", source: "manual" }],
    ["monthGeneral", "亥", (value: CalendarResult) => value.monthGeneral, { automatic: { name: "神后", branch: "子" }, effective: { name: "登明", branch: "亥" }, source: "manual" }],
    ["divinationHour", "子", (value: CalendarResult) => value.divinationHour, { automatic: "未", effective: "子", source: "manual" }],
  ] as const)("keeps the automatic value while applying a manual %s", (field, correction, select, expected) => {
    const result = computeCalendar(setCalendarCorrection(baseInput, field, correction), adapter);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(select(result.value)).toEqual(expected);
    expect(result.snapshot.source).toBe("manual");
    expect(result.value.evidence).toContainEqual(expect.objectContaining({
      ruleId: CALENDAR_RULE_IDS.correction,
      field,
    }));
  });

  it("rejects a malformed correction before reading the adapter and creates no snapshot", () => {
    const input = {
      ...baseInput,
      corrections: { dayPillar: "甲丑" },
    } as unknown as CourseInput;
    const mustNotRun: CalendarAdapter = { read: () => { throw new Error("adapter must not run"); } };

    const result = computeCalendar(input, mustNotRun);

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_CALENDAR_CORRECTION", field: "dayPillar" }),
    });
    expect(result).not.toHaveProperty("snapshot");
  });

  it.each([
    ["not-a-date", "INVALID_BEIJING_DATETIME"],
    ["2101-01-01T00:00:00", "OUT_OF_SUPPORTED_RANGE"],
  ] as const)("maps input %s to %s without a snapshot", (civilDateTime, code) => {
    const result = computeCalendar({ ...baseInput, civilDateTime }, adapter);

    expect(result).toMatchObject({ ok: false, error: { code } });
    expect(result).not.toHaveProperty("snapshot");
  });

  it("maps adapter exceptions to a stable user error and preserves the cause separately", () => {
    const cause = new Error("private adapter detail");
    const result = computeCalendar(baseInput, { read: () => { throw cause; } });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "CALENDAR_ADAPTER_FAILURE", message: "历法数据读取失败", cause },
    });
    if (result.ok) return;
    expect(result.error.message).not.toContain(cause.message);
    expect(result).not.toHaveProperty("snapshot");
  });

  it("maps incomplete solar-term boundaries separately from adapter exceptions", () => {
    const timeResult = computeCalendar(baseInput, adapter);
    if (!timeResult.ok) throw new Error("expected fixture setup to succeed");
    const primitives = adapter.read({
      isoLocal: timeResult.value.civilDateTime,
      year: 2024,
      month: 2,
      day: 10,
      hour: 14,
      minute: 30,
      second: 0,
      utcEpochMs: Date.UTC(2024, 1, 10, 6, 30),
    });
    const incomplete: CalendarAdapter = {
      read: () => ({ ...primitives, nextZhongQi: undefined }) as never,
    };

    const result = computeCalendar(baseInput, incomplete);

    expect(result).toMatchObject({ ok: false, error: { code: "SOLAR_TERM_BOUNDARY_FAILURE" } });
    expect(result).not.toHaveProperty("snapshot");
  });
});

describe("isCalendarResult", () => {
  it("rejects malformed values at every strict runtime boundary", () => {
    const cases: Array<[string, (value: CalendarResult) => void]> = [
      ["invalid automatic pillar", (value) => { value.pillars.year.automatic = "甲丑" as never; }],
      ["invalid effective pillar", (value) => { value.pillars.day.effective = "甲丑" as never; }],
      ["automatic source with a different effective value", (value) => { value.pillars.year.effective = "乙巳"; }],
      ["noncanonical automatic month-general pair", (value) => { value.monthGeneral.automatic = { name: "登明", branch: "子" }; }],
      ["noncanonical effective month-general pair", (value) => { value.monthGeneral.effective = { name: "登明", branch: "子" }; }],
      ["automatic month pillar branch differing from month build", (value) => {
        value.pillars.month = { automatic: "丁卯", effective: "丁卯", source: "automatic" };
      }],
      ["automatic hour pillar branch differing from automatic divination hour", (value) => {
        value.pillars.hour = { automatic: "庚午", effective: "庚午", source: "automatic" };
      }],
      ["automatic month general differing from the active Zhongqi", (value) => {
        value.monthGeneral = {
          automatic: { name: "登明", branch: "亥" },
          effective: { name: "登明", branch: "亥" },
          source: "automatic",
        };
      }],
      ["datetime carrying an offset", (value) => { value.civilDateTime = "2024-02-10T14:30:00+08:00"; }],
      ["wrong effective Ganzhi date", (value) => { value.effectiveGanzhiDate = "2024-02-11"; }],
      ["invalid effective Ganzhi ISO date", (value) => { value.effectiveGanzhiDate = "2024-02-30"; }],
      ["wrong boundary kind", (value) => { value.boundaries.previousJie.kind = "zhongqi"; }],
      ["boundary instant inconsistent with its Beijing datetime", (value) => { value.boundaries.nextJie.utcEpochMs += 1_000; }],
      ["unordered boundaries", (value) => { value.boundaries.nextJie = { ...value.boundaries.previousJie }; }],
      ["nonadjacent Jie names", (value) => { value.boundaries.nextJie.name = "清明"; }],
      ["duplicate Jie names", (value) => { value.boundaries.nextJie.name = value.boundaries.previousJie.name; }],
      ["nonadjacent Zhongqi names", (value) => { value.boundaries.nextZhongQi.name = "春分"; }],
      ["duplicate Zhongqi names", (value) => { value.boundaries.nextZhongQi.name = value.boundaries.previousZhongQi.name; }],
      ["empty evidence", (value) => { value.evidence = []; }],
      ["meaningless evidence input", (value) => { value.evidence = [{ ...value.evidence[0], input: "   " }, ...value.evidence.slice(1)]; }],
    ];

    for (const [name, mutate] of cases) {
      const value = structuredClone(validResult());
      mutate(value);
      expect(isCalendarResult(value), name).toBe(false);
    }
  });

  it("accepts a manual correction equal to the automatic value when its source is manual", () => {
    const result = computeCalendar(setCalendarCorrection(baseInput, "dayPillar", "甲辰"), adapter);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.pillars.day).toEqual({ automatic: "甲辰", effective: "甲辰", source: "manual" });
    expect(isCalendarResult(result.value)).toBe(true);
  });

  it("compares reviewed month-general fields explicitly rather than by object key order", () => {
    const value = structuredClone(validResult());
    value.monthGeneral.effective = {
      branch: value.monthGeneral.automatic.branch,
      name: value.monthGeneral.automatic.name,
    };

    expect(isCalendarResult(value)).toBe(true);
  });

  it("keeps independently corrected effective fields independent from automatic cross-field contracts", () => {
    let input = setCalendarCorrection(baseInput, "monthPillar", "丁卯");
    input = setCalendarCorrection(input, "hourPillar", "甲子");
    input = setCalendarCorrection(input, "divinationHour", "子");
    const result = computeCalendar(input, adapter);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.monthBuild).toBe("寅");
    expect(result.value.pillars.month.effective).toBe("丁卯");
    expect(result.value.pillars.hour.effective).toBe("甲子");
    expect(result.value.divinationHour.effective).toBe("子");
    expect(isCalendarResult(result.value)).toBe(true);
  });
});

describe("runCalendarStage", () => {
  it("invalidates the old calendar and every downstream snapshot before inserting the new snapshot", () => {
    const session = { ...referenceSession, input: baseInput };

    const result = runCalendarStage(session, adapter);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.session.snapshots)).toEqual(["calendar"]);
    expect(result.session.snapshots.calendar?.value).toBe(result.value);
    expect(result.session.input).toBe(baseInput);
    expect(referenceSession.snapshots.course).toBeDefined();
  });
});
