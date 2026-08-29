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
  return deriveCourse({ reason: referenceSession.input.reason, locationName: referenceSession.input.locationName, natal: referenceSession.input.natal }, calendar.value, lessons.value, transmissions.value, generals.value);
}

describe("deriveCourse", () => {
  it("serializes reason and omits an empty location line", () => {
    const result = deriveCourse({ reason: "项目签约判断", natal: referenceSession.input.natal }, calendar.value, lessons.value, transmissions.value, generals.value);
    const copy = serializeCourseText(result);

    expect(result.context.reason).toBe("项目签约判断");
    expect(copy).toContain("事由：项目签约判断");
    expect(copy).not.toContain("地点：");
  });

  it("projects only verified upstream facts in approved visual order", () => {
    const result = derive();
    expect(result.context).toEqual({
      civilDateTime: calendar.value.civilDateTime,
      effectiveGanzhiDate: calendar.value.effectiveGanzhiDate,
      locationName: "参考课式",
      reason: "商务决策复盘",
      lunarDateDisplay: calendar.value.lunarDate.display,
      pillars: {
        year: calendar.value.pillars.year.effective,
        month: calendar.value.pillars.month.effective,
        day: calendar.value.pillars.day.effective,
        hour: calendar.value.pillars.hour.effective,
      },
      voidBranches: calendar.value.voidBranches,
      natal: referenceSession.input.natal,
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

  it("projects authoritative lesson, general, palace, and noble values field by field", () => {
    const result = derive();
    expect(result.lessons).toEqual(
      ["fourth", "third", "second", "first"].map((id) => {
        const source = lessons.value.lessons.find((lesson) => lesson.id === id)!;
        const general = generals.value.placements.find((placement) => placement.heaven === source.upper)!.general;
        return { id: source.id, label: source.label, upper: source.upper, lower: source.lower, general };
      }),
    );
    expect(result.transmissions).toEqual(
      transmissions.value.transmissions.map((source) => ({
        position: source.position,
        label: source.label,
        branch: source.branch,
        relation: source.relation,
        general: generals.value.placements.find((placement) => placement.heaven === source.branch)!.general,
      })),
    );
    expect(result.palaces).toEqual(
      COURSE_PALACE_ORDER.map((earth) => {
        const source = generals.value.placements.find((placement) => placement.earth === earth)!;
        return { earth, heaven: source.heaven, general: source.general, noble: earth === generals.value.nobleEarth };
      }),
    );
    expect(result.noble).toEqual({
      dayNight: generals.value.dayNight,
      nobleHeaven: generals.value.nobleHeaven,
      nobleEarth: generals.value.nobleEarth,
      direction: generals.value.direction,
    });
  });

  it("isolates mutable nested course values from upstream results", () => {
    const localCalendar = structuredClone(calendar.value);
    const localLessons = structuredClone(lessons.value);
    const localTransmissions = structuredClone(transmissions.value);
    const localGenerals = structuredClone(generals.value);
    const result = deriveCourse({ reason: referenceSession.input.reason, locationName: referenceSession.input.locationName, natal: referenceSession.input.natal }, localCalendar, localLessons, localTransmissions, localGenerals);
    const sourceLower = localLessons.lessons.find((lesson) => lesson.id === "fourth")!.lower;
    expect(result.context.monthGeneral).not.toBe(localCalendar.monthGeneral.effective);
    expect(result.lessons[0].lower).not.toBe(sourceLower);
    result.context.monthGeneral.name = "河魁";
    if (result.lessons[0].lower.kind === "branch") result.lessons[0].lower.value = "子";
    else result.lessons[0].lower.value = "甲";
    expect(localCalendar.monthGeneral.effective.name).toBe("胜光");
    expect(localLessons.lessons.find((lesson) => lesson.id === "fourth")!.lower).toEqual(sourceLower);
  });

  it("serializes stable segmented plain text with LF line endings", () => {
    const result = derive();
    const text = serializeCourseText(result);
    expect(text).not.toContain("\r");
    expect(text.split("\n").slice(0, 10)).toEqual([
      "大六壬标准课式",
      `时间：${result.context.civilDateTime}`,
      `事由：${result.context.reason}`,
      `地点：${result.context.locationName}`,
      `农历：${result.context.lunarDateDisplay}`,
      `四柱：${result.context.pillars.year}　${result.context.pillars.month}　${result.context.pillars.day}　${result.context.pillars.hour}`,
      `旬空：${result.context.voidBranches.join("　")}`,
      `本命：1990年　午命（自动换算）`,
      `月建：${result.context.monthBuild}`,
      `月将：${result.context.monthGeneral.name}（${result.context.monthGeneral.branch}）　占时：${result.context.divinationHour}`,
    ]);
    expect(text).toContain(`初传：${result.transmissions[0].general}　${result.transmissions[0].branch}　${result.transmissions[0].relation}`);
    expect(text.match(/宫：/g)).toHaveLength(12);
    expect(text).not.toMatch(/遁干|神煞|断语/);
  });

  it("marks every void branch occurrence in serialized palaces, lessons, and transmissions", () => {
    const result = derive();
    const annotated = {
      ...result,
      transmissions: result.transmissions.map((item, index) => index === 0 ? { ...item, branch: "子" as const } : item),
      lessons: result.lessons.map((item, index) => index === 0
        ? { ...item, upper: "丑" as const, lower: { kind: "branch" as const, value: "子" as const } }
        : item),
      palaces: result.palaces.map((item, index) => index === 0
        ? { ...item, earth: "子" as const, heaven: "丑" as const }
        : item),
    };

    const text = serializeCourseText(annotated);

    expect(text).toContain(`初传：${annotated.transmissions[0].general}　子（空）`);
    expect(text).toContain(`四课：${annotated.lessons[0].general}　上神丑（空）　下神子（空）`);
    expect(text).toContain(`子宫：${annotated.palaces[0].general}　天盘丑（空）　地盘子（空）`);
  });

  it("omits absent subtype and variants without empty separators", () => {
    const result = derive();
    const text = serializeCourseText({ ...result, method: { method: result.method.method, variants: [] } });
    expect(text).toContain(`三传取法：${result.method.method}\n`);
    expect(text).not.toContain("[]");
    expect(text).not.toContain("undefined");
  });
});
