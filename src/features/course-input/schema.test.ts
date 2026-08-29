import { describe, expect, it } from "vitest";
import { parseCourseInput } from "./schema";

function formData(values: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set("civilDateTime", "2026-08-15T00:30");
  form.set("birthYear", "1990");
  form.set("reason", "起课测试");
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

describe("parseCourseInput", () => {
  it("derives the natal branch from the Gregorian birth year", () => {
    expect(parseCourseInput(formData({ birthYear: "1990" }))).toMatchObject({
      natal: { birthYear: 1990, branch: "午", source: "automatic" },
    });
  });

  it("keeps an explicit manual natal branch override", () => {
    expect(parseCourseInput(formData({ birthYear: "1990", natalBranch: "子" }))).toMatchObject({
      natal: { birthYear: 1990, branch: "子", source: "manual" },
    });
  });

  it("rejects an invalid birth year or manual natal branch", () => {
    expect(parseCourseInput(formData({ birthYear: "1899" }))).toEqual({
      birthYear: "请输入 1900 年至今年之间的出生年份",
    });
    expect(parseCourseInput(formData({ natalBranch: "甲" }))).toEqual({
      natalBranch: "本命必须是十二地支之一",
    });
  });

  it("normalizes minute-only input and preserves second-level input", () => {
    const minuteOnly = formData({ civilDateTime: "2024-02-10T14:30", locationName: "北京" });
    const secondLevel = formData({ civilDateTime: "2024-02-10T14:30:45", locationName: "北京" });

    expect(parseCourseInput(minuteOnly)).toMatchObject({ civilDateTime: "2024-02-10T14:30:00" });
    expect(parseCourseInput(secondLevel)).toMatchObject({ civilDateTime: "2024-02-10T14:30:45" });
  });

  it.each(["1899-12-31T23:59:59", "2101-01-01T00:00:00"])(
    "returns a civil datetime error for out-of-range input %s",
    (civilDateTime) => {
      const form = formData({ civilDateTime, locationName: "北京" });

      expect(parseCourseInput(form)).toEqual({ civilDateTime: "仅支持 1900–2100 年的北京时间" });
    },
  );

  it("requires a trimmed reason and omits coordinates", () => {
    expect(parseCourseInput(formData({ reason: "   " }))).toEqual({ reason: "请输入起课事由" });
    expect(parseCourseInput(formData({ reason: "甲".repeat(121) }))).toEqual({ reason: "起课事由不能超过 120 字" });
    const parsed = parseCourseInput(formData({ locationName: "", reason: "  商务决策复盘  " }));
    expect(parsed).toMatchObject({ reason: "商务决策复盘" });
    expect(parsed).not.toHaveProperty("locationName");
  });

  it("keeps manual month-general and hour corrections explicit", () => {
    const form = formData({ locationName: "北京", monthGeneral: "午", divinationHour: "子" });

    const result = parseCourseInput(form);

    expect("corrections" in result && result.corrections).toEqual({
      monthGeneral: "午",
      divinationHour: "子",
    });
  });

  it.each([
    "2026/08/15 00:30",
    "0000-01-01T00:00",
    "2026-02-30T00:30",
    "2026-08-15T24:00",
  ])("rejects invalid datetime-local value %s", (civilDateTime) => {
    const form = formData({ civilDateTime, locationName: "北京" });

    expect(parseCourseInput(form)).toEqual({ civilDateTime: "请输入 1900–2100 年内的有效北京时间" });
  });

  it("rejects non-branch manual corrections", () => {
    const form = formData({ locationName: "北京", monthGeneral: "甲", divinationHour: "午时" });

    expect(parseCourseInput(form)).toEqual({
      monthGeneral: "月将必须是十二地支之一",
      divinationHour: "占时必须是十二地支之一",
    });
  });

  it("keeps empty manual corrections automatic", () => {
    const form = formData({ locationName: "北京", monthGeneral: "", divinationHour: "" });

    const result = parseCourseInput(form);

    expect("corrections" in result && result.corrections).toEqual({});
  });
});
