import { describe, expect, it } from "vitest";
import { parseCourseInput } from "./schema";

describe("parseCourseInput", () => {
  it("normalizes minute-only input and preserves second-level input", () => {
    const minuteOnly = new FormData();
    minuteOnly.set("civilDateTime", "2024-02-10T14:30");
    minuteOnly.set("locationName", "北京");
    minuteOnly.set("longitude", "116.4074");
    minuteOnly.set("latitude", "39.9042");

    const secondLevel = new FormData();
    secondLevel.set("civilDateTime", "2024-02-10T14:30:45");
    secondLevel.set("locationName", "北京");
    secondLevel.set("longitude", "116.4074");
    secondLevel.set("latitude", "39.9042");

    expect(parseCourseInput(minuteOnly)).toMatchObject({ civilDateTime: "2024-02-10T14:30:00" });
    expect(parseCourseInput(secondLevel)).toMatchObject({ civilDateTime: "2024-02-10T14:30:45" });
  });

  it.each(["1899-12-31T23:59:59", "2101-01-01T00:00:00"])(
    "returns a civil datetime error for out-of-range input %s",
    (civilDateTime) => {
      const form = new FormData();
      form.set("civilDateTime", civilDateTime);
      form.set("locationName", "北京");
      form.set("longitude", "116.4074");
      form.set("latitude", "39.9042");

      expect(parseCourseInput(form)).toEqual({ civilDateTime: "仅支持 1900–2100 年的北京时间" });
    },
  );

  it("rejects missing location and invalid coordinates", () => {
    const form = new FormData();
    form.set("civilDateTime", "2026-08-15T00:30");
    form.set("locationName", "");
    form.set("longitude", "181");
    form.set("latitude", "91");

    const result = parseCourseInput(form);

    expect(result).toEqual({
      locationName: "请输入地点",
      longitude: "经度必须在 -180 到 180 之间",
      latitude: "纬度必须在 -90 到 90 之间",
    });
  });

  it("rejects empty coordinates with field-specific errors", () => {
    const form = new FormData();
    form.set("civilDateTime", "2026-08-15T00:30");
    form.set("locationName", "北京");
    form.set("longitude", "");
    form.set("latitude", "");

    const result = parseCourseInput(form);

    expect(result).toEqual({
      longitude: "请输入经度",
      latitude: "请输入纬度",
    });
  });

  it("keeps manual month-general and hour corrections explicit", () => {
    const form = new FormData();
    form.set("civilDateTime", "2026-08-15T00:30");
    form.set("locationName", "北京");
    form.set("longitude", "116.4074");
    form.set("latitude", "39.9042");
    form.set("monthGeneral", "午");
    form.set("divinationHour", "子");

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
    const form = new FormData();
    form.set("civilDateTime", civilDateTime);
    form.set("locationName", "北京");
    form.set("longitude", "116.4074");
    form.set("latitude", "39.9042");

    expect(parseCourseInput(form)).toEqual({ civilDateTime: "请输入 1900–2100 年内的有效北京时间" });
  });

  it("rejects non-branch manual corrections", () => {
    const form = new FormData();
    form.set("civilDateTime", "2026-08-15T00:30");
    form.set("locationName", "北京");
    form.set("longitude", "116.4074");
    form.set("latitude", "39.9042");
    form.set("monthGeneral", "甲");
    form.set("divinationHour", "午时");

    expect(parseCourseInput(form)).toEqual({
      monthGeneral: "月将必须是十二地支之一",
      divinationHour: "占时必须是十二地支之一",
    });
  });

  it("keeps empty manual corrections automatic", () => {
    const form = new FormData();
    form.set("civilDateTime", "2026-08-15T00:30");
    form.set("locationName", "北京");
    form.set("longitude", "116.4074");
    form.set("latitude", "39.9042");
    form.set("monthGeneral", "");
    form.set("divinationHour", "");

    const result = parseCourseInput(form);

    expect("corrections" in result && result.corrections).toEqual({});
  });
});
