import { describe, expect, it } from "vitest";
import type { CalendarSnapshot } from "../calendar/types";
import { validateSession } from "../chart/snapshots";
import type { CourseSession } from "../chart/types";
import type { FourLessonsSnapshot } from "../four-lessons/types";
import type { HeavenlyGeneralsSnapshot } from "../heavenly-generals/types";
import type { ThreeTransmissionsSnapshot } from "../three-transmissions/types";
import { referenceSession } from "../../test/reference-session";
import { computeCourse, runCourseStage } from "./compute-course";
import { isCourseResult, matchesCourseInputs } from "./result-guard";

const withoutCourse: CourseSession = {
  ...referenceSession,
  snapshots: Object.fromEntries(Object.entries(referenceSession.snapshots).filter(([stage]) => stage !== "course")),
};

describe("course computation", () => {
  it("composes a guarded canonical course snapshot", () => {
    const outcome = computeCourse(
      withoutCourse.input.locationName,
      withoutCourse.snapshots.calendar as CalendarSnapshot,
      withoutCourse.snapshots["four-lessons"] as FourLessonsSnapshot,
      withoutCourse.snapshots["three-transmissions"] as ThreeTransmissionsSnapshot,
      withoutCourse.snapshots["heavenly-generals"] as HeavenlyGeneralsSnapshot,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error(outcome.error.message);
    expect(outcome.snapshot).toMatchObject({
      stage: "course",
      dependsOn: ["four-lessons", "three-transmissions", "heavenly-generals"],
      ruleId: "course/verified-projection-v1",
    });
    expect(isCourseResult(outcome.value)).toBe(true);
  });

  it("rejects present-but-wrong semantic values", () => {
    const outcome = runCourseStage(withoutCourse);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error(outcome.error.message);
    const snapshot = outcome.session.snapshots.course!;
    const value = snapshot.value as any;
    const calendar = withoutCourse.snapshots.calendar as CalendarSnapshot;
    const lessons = withoutCourse.snapshots["four-lessons"] as FourLessonsSnapshot;
    const transmissions = withoutCourse.snapshots["three-transmissions"] as ThreeTransmissionsSnapshot;
    const generals = withoutCourse.snapshots["heavenly-generals"] as HeavenlyGeneralsSnapshot;
    const wrongRelation = { ...value, transmissions: value.transmissions.map((item: any, index: number) => index ? item : { ...item, relation: item.relation === "父母" ? "子孙" : "父母" }) };
    const wrongGeneral = { ...value, palaces: value.palaces.map((item: any, index: number) => index ? item : { ...item, general: item.general === "贵人" ? "螣蛇" : "贵人" }) };
    expect(isCourseResult(wrongRelation)).toBe(true);
    expect(matchesCourseInputs(wrongRelation, withoutCourse.input.locationName, calendar.value, lessons.value, transmissions.value, generals.value)).toBe(false);
    expect(matchesCourseInputs(wrongGeneral, withoutCourse.input.locationName, calendar.value, lessons.value, transmissions.value, generals.value)).toBe(false);
  });

  it.each([
    ["calendar", []],
    ["heaven-earth", ["calendar"]],
    ["four-lessons", ["calendar", "heaven-earth"]],
    ["three-transmissions", ["calendar", "heaven-earth", "four-lessons"]],
    ["heavenly-generals", ["calendar", "heaven-earth", "four-lessons", "three-transmissions"]],
  ] as const)("invalid %s preserves only its valid prefix", (stage, preserved) => {
    const broken: CourseSession = {
      ...withoutCourse,
      snapshots: { ...withoutCourse.snapshots, [stage]: undefined },
    };
    const outcome = runCourseStage(broken);
    expect(outcome.ok).toBe(false);
    expect(Object.keys(outcome.session.snapshots)).toEqual(preserved);
    expect(validateSession(outcome.session)).toEqual([]);
  });

  it("propagates a direct manual source into the composed snapshot", () => {
    const outcome = computeCourse(
      withoutCourse.input.locationName,
      withoutCourse.snapshots.calendar as CalendarSnapshot,
      withoutCourse.snapshots["four-lessons"] as FourLessonsSnapshot,
      withoutCourse.snapshots["three-transmissions"] as ThreeTransmissionsSnapshot,
      { ...(withoutCourse.snapshots["heavenly-generals"] as HeavenlyGeneralsSnapshot), source: "manual" },
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error(outcome.error.message);
    expect(outcome.snapshot.source).toBe("manual");
  });

  it("writes the automatic course into a session that remains valid", () => {
    const outcome = runCourseStage(withoutCourse);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error(outcome.error.message);
    expect(outcome.session.snapshots.course?.source).toBe("automatic");
    expect(validateSession(outcome.session)).toEqual([]);
  });
});
