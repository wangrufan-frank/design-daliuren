import { describe, expect, it } from "vitest";
import type { CalendarSnapshot } from "../calendar/types";
import type { FourLessonsSnapshot } from "../four-lessons/types";
import type { HeavenlyGeneralsSnapshot } from "../heavenly-generals/types";
import type { ThreeTransmissionsSnapshot } from "../three-transmissions/types";
import { referenceSession } from "../../test/reference-session";
import { COURSE_LESSON_ORDER, COURSE_PALACE_ORDER, deriveCourse, serializeCourseText } from "./policy";

const calendar = referenceSession.snapshots.calendar as CalendarSnapshot;
const lessons = referenceSession.snapshots["four-lessons"] as FourLessonsSnapshot;
const transmissions = referenceSession.snapshots["three-transmissions"] as ThreeTransmissionsSnapshot;
const generals = referenceSession.snapshots["heavenly-generals"] as HeavenlyGeneralsSnapshot;

function derive() {
  return deriveCourse(referenceSession.input.locationName, calendar.value, lessons.value, transmissions.value, generals.value);
}

describe("deriveCourse", () => {
  it("projects only verified upstream facts in approved visual order", () => {
    const result = derive();
    expect(result.context).toEqual({
      civilDateTime: calendar.value.civilDateTime,
      effectiveGanzhiDate: calendar.value.effectiveGanzhiDate,
      locationName: "参考课式",
      lunarDateDisplay: calendar.value.lunarDate.display,
      pillars: {
        year: calendar.value.pillars.year.effective,
        month: calendar.value.pillars.month.effective,
        day: calendar.value.pillars.day.effective,
        hour: calendar.value.pillars.hour.effective,
      },
      monthBuild: calendar.value.monthBuild,
      monthGeneral: calendar.value.monthGeneral.effective,
      divinationHour: calendar.value.divinationHour.effective,
    });
    expect(result.method).toEqual({
      method: transmissions.value.method,
      ...(transmissions.value.subtype ? { subtype: transmissions.value.subtype } : {}),
      variants: transmissions.value.variants,
    });
    expect(result.transmissions.map(({ position, branch, relation }) => ({ position, branch, relation })))
      .toEqual(transmissions.value.transmissions.map(({ position, branch, relation }) => ({ position, branch, relation })));
    expect(result.lessons.map(({ id }) => id)).toEqual(COURSE_LESSON_ORDER);
    expect(result.palaces.map(({ earth }) => earth)).toEqual(COURSE_PALACE_ORDER);
    expect(result.palaces).toHaveLength(12);
  });

  it("is byte-stable for identical inputs", () => {
    expect(JSON.stringify(derive())).toBe(JSON.stringify(derive()));
    expect(serializeCourseText(derive())).toBe(serializeCourseText(derive()));
  });

  it("keeps lesson projection keys limited to the public course contract", () => {
    const result = derive();
    expect(Object.keys(result.lessons[0]).sort()).toEqual(["general", "id", "label", "lower", "upper"]);
    expect(result.lessons.every((lesson) => !("lookupEarth" in lesson))).toBe(true);
  });

  it("serializes stable segmented plain text with LF line endings", () => {
    const result = derive();
    const text = serializeCourseText(result);
    expect(text).not.toContain("\r");
    expect(text.split("\n").slice(0, 8)).toEqual([
      "大六壬标准课式",
      `时间：${result.context.civilDateTime}`,
      `地点：${result.context.locationName}`,
      `农历：${result.context.lunarDateDisplay}`,
      `四柱：${result.context.pillars.year}　${result.context.pillars.month}　${result.context.pillars.day}　${result.context.pillars.hour}`,
      `月建：${result.context.monthBuild}`,
      `月将：${result.context.monthGeneral.name}（${result.context.monthGeneral.branch}）　占时：${result.context.divinationHour}`,
      "",
    ]);
    expect(text).toContain(`初传：${result.transmissions[0].general}　${result.transmissions[0].branch}　${result.transmissions[0].relation}`);
    expect(text.match(/宫：/g)).toHaveLength(12);
    expect(text).not.toMatch(/遁干|神煞|断语/);
  });

  it("omits absent subtype and variants without empty separators", () => {
    const result = derive();
    const text = serializeCourseText({ ...result, method: { method: result.method.method, variants: [] } });
    expect(text).toContain(`三传取法：${result.method.method}\n`);
    expect(text).not.toContain("[]");
    expect(text).not.toContain("undefined");
  });
});
