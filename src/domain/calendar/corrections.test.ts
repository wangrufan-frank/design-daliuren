import { describe, expect, it } from "vitest";
import type { CourseInput } from "../chart/types";
import { CalendarDomainError, type CalendarCorrectionField } from "./types";
import { resetCalendarCorrection, setCalendarCorrection } from "./corrections";

const baseInput: CourseInput = {
  civilDateTime: "2024-02-10T14:30:00",
  timeZone: "Asia/Shanghai",
  locationName: "北京",
  reason: "商务决策复盘",
  natal: { birthYear: 1990, branch: "午", source: "automatic" },
  corrections: {},
};

describe("calendar corrections", () => {
  it.each([
    ["yearPillar", "乙巳"],
    ["monthPillar", "丁卯"],
    ["dayPillar", "乙巳"],
    ["hourPillar", "甲子"],
    ["monthGeneral", "亥"],
    ["divinationHour", "子"],
  ] as const)("sets and resets %s without changing the prior input", (field, rawValue) => {
    const corrected = setCalendarCorrection(baseInput, field, rawValue);
    const reset = resetCalendarCorrection(corrected, field);

    expect(corrected).not.toBe(baseInput);
    expect(corrected.corrections).not.toBe(baseInput.corrections);
    expect(corrected.corrections[field]).toBe(rawValue);
    expect(baseInput.corrections[field]).toBeUndefined();
    expect(reset.corrections[field]).toBeUndefined();
    expect(corrected.corrections[field]).toBe(rawValue);
  });

  it.each([
    ["yearPillar", "甲丑"],
    ["monthPillar", ""],
    ["dayPillar", "甲"],
    ["hourPillar", "甲子 "],
    ["monthGeneral", "甲"],
    ["divinationHour", ""],
  ] as const)("rejects invalid non-reset %s value %j without mutating the input", (field, rawValue) => {
    const prior = {
      ...baseInput,
      corrections: { dayPillar: "乙巳" as const },
    };
    const before = structuredClone(prior);

    let thrown: unknown;
    try {
      setCalendarCorrection(prior, field as CalendarCorrectionField, rawValue);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CalendarDomainError);
    expect((thrown as CalendarDomainError).detail).toMatchObject({
      code: "INVALID_CALENDAR_CORRECTION",
      field,
    });
    expect(prior).toEqual(before);
  });
});
