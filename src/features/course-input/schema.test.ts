import { describe, expect, it } from "vitest";
import { parseCourseInput } from "./schema";

describe("parseCourseInput", () => {
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

    expect(parseCourseInput(form)).toEqual({ civilDateTime: "请输入有效的日期与时间" });
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
