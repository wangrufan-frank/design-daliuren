import { expect, it } from "vitest";
import type { CalendarResult } from "../../../domain/calendar/types";
import type { CourseResult } from "../../../domain/course/types";
import type { FourLessonsResult } from "../../../domain/four-lessons/types";
import type { HeavenlyGeneralsResult } from "../../../domain/heavenly-generals/types";
import type { HeavenEarthResult } from "../../../domain/heaven-earth/types";
import type { ThreeTransmissionsResult } from "../../../domain/three-transmissions/types";
import { referenceSession } from "../../../test/reference-session";
import { mapArtifactState } from "./map-artifact-state";
import type { ArtifactSourceResults } from "./types";

const referenceSourceResults: ArtifactSourceResults = {
  calendar: referenceSession.snapshots.calendar!.value as CalendarResult,
  plate: referenceSession.snapshots["heaven-earth"]!.value as HeavenEarthResult,
  lessons: referenceSession.snapshots["four-lessons"]!.value as FourLessonsResult,
  transmissions: referenceSession.snapshots["three-transmissions"]!.value as ThreeTransmissionsResult,
  generals: referenceSession.snapshots["heavenly-generals"]!.value as HeavenlyGeneralsResult,
  course: referenceSession.snapshots.course!.value as CourseResult,
};

it("copies every visible fact without recomputing", () => {
  const state = mapArtifactState(referenceSourceResults);

  expect(state.calendar).toEqual({
    pillars: ["丙午", "丙申", "辛酉", "戊子"],
    monthBuild: "申",
    monthGeneral: "胜光",
    monthGeneralBranch: "午",
    divinationHour: "子",
    manualFields: [],
  });
  expect(state.plate.offset).toBe(6);
  expect(state.plate.palaces).toEqual(referenceSourceResults.plate.palaces);
  expect(state.lessons.map(({ lookupEarth: _lookupEarth, ...lesson }) => lesson)).toEqual(
    referenceSourceResults.course.lessons,
  );
  expect(state.transmissions).toEqual(referenceSourceResults.course.transmissions);
  expect(state.methodLabel).toBe("反吟 · 重审");
  expect(state.generals).toEqual(referenceSourceResults.generals.placements);
  expect(state.noble).toEqual(referenceSourceResults.course.noble);
});

it("preserves the exact month-general branch, lesson lookup palaces, and noble day or night", () => {
  const state = mapArtifactState(referenceSourceResults);

  expect(state.calendar.monthGeneralBranch).toBe("午");
  expect(state.lessons.map((lesson) => [lesson.label, lesson.lookupEarth])).toEqual([
    ["四课", "卯"],
    ["三课", "酉"],
    ["二课", "辰"],
    ["一课", "戌"],
  ]);
  expect(state.noble.dayNight).toBe("night");
});

it("rejects inconsistent course facts instead of choosing one source", () => {
  const broken: ArtifactSourceResults = {
    ...referenceSourceResults,
    course: {
      ...referenceSourceResults.course,
      transmissions: referenceSourceResults.course.transmissions.map((item, index) =>
        index === 0 ? { ...item, branch: item.branch === "子" ? "丑" : "子" } : item,
      ),
    },
  };

  expect(() => mapArtifactState(broken)).toThrow(/course transmission initial does not match upstream/);
});

it("rejects calendar and plate facts that disagree with their represented upstream links", () => {
  expect(() => mapArtifactState({
    ...referenceSourceResults,
    plate: { ...referenceSourceResults.plate, offset: referenceSourceResults.plate.offset + 1 },
  })).toThrow(/plate offset does not match transmissions/);

  expect(() => mapArtifactState({
    ...referenceSourceResults,
    course: {
      ...referenceSourceResults.course,
      context: { ...referenceSourceResults.course.context, divinationHour: "丑" },
    },
    calendar: {
      ...referenceSourceResults.calendar,
      divinationHour: { ...referenceSourceResults.calendar.divinationHour, effective: "丑" },
    },
  })).toThrow(/calendar divination hour does not match plate/);
});

it.each([
  ["lesson IDs", {
    ...referenceSourceResults.course,
    lessons: [
      referenceSourceResults.course.lessons[0],
      referenceSourceResults.course.lessons[0],
      ...referenceSourceResults.course.lessons.slice(2),
    ],
  }, /course lesson IDs do not match upstream/],
  ["transmission positions", {
    ...referenceSourceResults.course,
    transmissions: [
      referenceSourceResults.course.transmissions[0],
      referenceSourceResults.course.transmissions[0],
      referenceSourceResults.course.transmissions[2],
    ],
  }, /course transmission positions do not match upstream/],
  ["palace earth branches", {
    ...referenceSourceResults.course,
    palaces: [
      referenceSourceResults.course.palaces[0],
      referenceSourceResults.course.palaces[0],
      ...referenceSourceResults.course.palaces.slice(2),
    ],
  }, /course palace earth branches do not match upstream/],
] as const)("rejects duplicate course %s", (_name, course, expectedError) => {
  expect(() => mapArtifactState({ ...referenceSourceResults, course })).toThrow(expectedError);
});

it("reports every manual calendar field and preserves all twelve palaces, four lessons, three transmissions, and generals", () => {
  const calendar: CalendarResult = {
    ...referenceSourceResults.calendar,
    pillars: Object.fromEntries(Object.entries(referenceSourceResults.calendar.pillars).map(([key, value]) => [
      key,
      { ...value, source: "manual" },
    ])) as CalendarResult["pillars"],
    monthGeneral: { ...referenceSourceResults.calendar.monthGeneral, source: "manual" },
    divinationHour: { ...referenceSourceResults.calendar.divinationHour, source: "manual" },
  };
  const state = mapArtifactState({ ...referenceSourceResults, calendar });

  expect(state.calendar.manualFields).toEqual([
    "yearPillar", "monthPillar", "dayPillar", "hourPillar", "monthGeneral", "divinationHour",
  ]);
  expect(state.plate.palaces).toHaveLength(12);
  expect(state.plate.palaces.map((palace) => palace.earth)).toEqual([
    "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥",
  ]);
  expect(state.lessons).toHaveLength(4);
  expect(state.transmissions).toHaveLength(3);
  expect(state.generals).toHaveLength(12);
  expect(state.generals).toEqual(referenceSourceResults.generals.placements);
  [
    state.calendar.pillars,
    state.calendar.manualFields,
    state.plate.palaces,
    state.lessons,
    state.transmissions,
    state.generals,
  ].forEach((value) => expect(Object.isFrozen(value)).toBe(true));
});
