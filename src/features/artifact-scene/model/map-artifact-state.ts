import type { CourseResult } from "../../../domain/course/types";
import type { FourLesson } from "../../../domain/four-lessons/types";
import type { GeneralPlacement } from "../../../domain/heavenly-generals/types";
import type { Transmission } from "../../../domain/three-transmissions/types";
import type { ArtifactDisplayState, ArtifactSourceResults } from "./types";

const calendarFields = [
  "yearPillar", "monthPillar", "dayPillar", "hourPillar", "monthGeneral", "divinationHour",
] as const;

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) throw new Error(message);
}

function assertKeysMatch(actual: readonly string[], expected: readonly string[], message: string): void {
  const actualKeys = new Set(actual);
  const expectedKeys = new Set(expected);
  if (actual.length !== expected.length
    || actualKeys.size !== actual.length
    || expectedKeys.size !== expected.length
    || actual.some((key) => !expectedKeys.has(key))) throw new Error(message);
}

function generalForHeaven(placements: readonly GeneralPlacement[], heaven: string): GeneralPlacement {
  const placement = placements.find((item) => item.heaven === heaven);
  if (!placement) throw new Error(`upstream general placement missing heaven ${heaven}`);
  return placement;
}

function assertCourseLessonMatches(
  courseLesson: CourseResult["lessons"][number],
  lesson: FourLesson | undefined,
  placements: readonly GeneralPlacement[],
): void {
  if (!lesson
    || courseLesson.label !== lesson.label
    || courseLesson.upper !== lesson.upper
    || courseLesson.lower.kind !== lesson.lower.kind
    || courseLesson.lower.value !== lesson.lower.value) {
    throw new Error(`course lesson ${courseLesson.id} does not match upstream`);
  }
  assertEqual(courseLesson.general, generalForHeaven(placements, lesson.upper).general, `course lesson ${courseLesson.id} general does not match upstream`);
}

function assertCourseTransmissionMatches(
  courseTransmission: CourseResult["transmissions"][number],
  transmission: Transmission | undefined,
  placements: readonly GeneralPlacement[],
): void {
  if (!transmission
    || courseTransmission.label !== transmission.label
    || courseTransmission.branch !== transmission.branch
    || courseTransmission.relation !== transmission.relation) {
    throw new Error(`course transmission ${courseTransmission.position} does not match upstream`);
  }
  assertEqual(courseTransmission.general, generalForHeaven(placements, transmission.branch).general, `course transmission ${courseTransmission.position} general does not match upstream`);
}

function assertCourseMatchesUpstream(source: ArtifactSourceResults): void {
  const lessonsById = new Map(source.lessons.lessons.map((lesson) => [lesson.id, lesson]));
  const transmissionsByPosition = new Map(source.transmissions.transmissions.map((item) => [item.position, item]));
  const placementsByEarth = new Map(source.generals.placements.map((item) => [item.earth, item]));

  if (source.course.method.method !== source.transmissions.method
    || source.course.method.subtype !== source.transmissions.subtype
    || source.course.method.variants.length !== source.transmissions.variants.length
    || source.course.method.variants.some((item, index) => item !== source.transmissions.variants[index])) {
    throw new Error("course method does not match upstream");
  }

  assertKeysMatch(
    source.course.lessons.map((item) => item.id),
    source.lessons.lessons.map((item) => item.id),
    "course lesson IDs do not match upstream",
  );
  source.course.lessons.forEach((item) => assertCourseLessonMatches(item, lessonsById.get(item.id), source.generals.placements));
  assertKeysMatch(
    source.course.transmissions.map((item) => item.position),
    source.transmissions.transmissions.map((item) => item.position),
    "course transmission positions do not match upstream",
  );
  source.course.transmissions.forEach((item) => assertCourseTransmissionMatches(item, transmissionsByPosition.get(item.position), source.generals.placements));

  assertKeysMatch(
    source.course.palaces.map((item) => item.earth),
    source.generals.placements.map((item) => item.earth),
    "course palace earth branches do not match upstream",
  );
  source.course.palaces.forEach((palace) => {
    const placement = placementsByEarth.get(palace.earth);
    if (!placement || palace.heaven !== placement.heaven || palace.general !== placement.general || palace.noble !== (palace.earth === source.generals.nobleEarth)) {
      throw new Error(`course palace ${palace.earth} does not match upstream`);
    }
  });
  if (source.course.noble.dayNight !== source.generals.dayNight
    || source.course.noble.nobleHeaven !== source.generals.nobleHeaven
    || source.course.noble.nobleEarth !== source.generals.nobleEarth
    || source.course.noble.direction !== source.generals.direction) {
    throw new Error("course noble does not match upstream");
  }
}

function assertCalendarAndPlateMatch(source: ArtifactSourceResults): void {
  const { calendar, course, generals, lessons, plate, transmissions } = source;
  const context = course.context;
  const pillars = calendar.pillars;
  if (context.civilDateTime !== calendar.civilDateTime
    || context.effectiveGanzhiDate !== calendar.effectiveGanzhiDate
    || context.pillars.year !== pillars.year.effective
    || context.pillars.month !== pillars.month.effective
    || context.pillars.day !== pillars.day.effective
    || context.pillars.hour !== pillars.hour.effective
    || context.monthBuild !== calendar.monthBuild
    || context.monthGeneral.name !== calendar.monthGeneral.effective.name
    || context.monthGeneral.branch !== calendar.monthGeneral.effective.branch
    || context.divinationHour !== calendar.divinationHour.effective
    || context.voidBranches.some((branch, index) => branch !== calendar.voidBranches[index])) {
    throw new Error("course calendar context does not match upstream");
  }
  assertEqual(calendar.pillars.day.effective, lessons.dayPillar, "calendar day pillar does not match lessons");
  assertEqual(calendar.pillars.day.effective, transmissions.dayPillar, "calendar day pillar does not match transmissions");
  assertEqual(calendar.pillars.day.effective[0], generals.dayStem, "calendar day stem does not match generals");
  assertEqual(calendar.monthGeneral.effective.name, plate.monthGeneral.name, "calendar month general does not match plate");
  assertEqual(calendar.monthGeneral.effective.branch, plate.monthGeneral.branch, "calendar month general does not match plate");
  assertEqual(calendar.divinationHour.effective, plate.divinationHour.branch, "calendar divination hour does not match plate");
  assertEqual(calendar.divinationHour.effective, generals.divinationHour, "calendar divination hour does not match generals");
  assertEqual(plate.offset, transmissions.plateOffset, "plate offset does not match transmissions");

  const palacesByEarth = new Map(plate.palaces.map((item) => [item.earth, item]));
  lessons.lessons.forEach((lesson) => {
    assertEqual(palacesByEarth.get(lesson.lookupEarth)?.heaven, lesson.upper, `plate palace ${lesson.lookupEarth} does not match lesson ${lesson.id}`);
  });
  assertKeysMatch(
    generals.placements.map((item) => item.earth),
    plate.palaces.map((item) => item.earth),
    "general placement earth branches do not match plate",
  );
  generals.placements.forEach((placement) => {
    assertEqual(palacesByEarth.get(placement.earth)?.heaven, placement.heaven, `general placement ${placement.earth} does not match plate`);
  });
}

export function mapArtifactState(source: ArtifactSourceResults): ArtifactDisplayState {
  assertCalendarAndPlateMatch(source);
  assertCourseMatchesUpstream(source);
  const { calendar, plate, course, generals, transmissions } = source;
  const manualFields = calendarFields.filter((field) => {
    if (field === "monthGeneral" || field === "divinationHour") return calendar[field].source === "manual";
    return calendar.pillars[field.replace("Pillar", "") as keyof typeof calendar.pillars].source === "manual";
  });

  return {
    calendar: {
      pillars: Object.freeze([
        calendar.pillars.year.effective,
        calendar.pillars.month.effective,
        calendar.pillars.day.effective,
        calendar.pillars.hour.effective,
      ]) as ArtifactDisplayState["calendar"]["pillars"],
      monthBuild: calendar.monthBuild,
      monthGeneral: calendar.monthGeneral.effective.name,
      monthGeneralBranch: calendar.monthGeneral.effective.branch,
      divinationHour: calendar.divinationHour.effective,
      voidBranches: Object.freeze([...calendar.voidBranches]) as ArtifactDisplayState["calendar"]["voidBranches"],
      manualFields: Object.freeze([...manualFields]),
    },
    plate: { offset: plate.offset, palaces: Object.freeze(plate.palaces.map((palace) => ({ ...palace }))) },
    lessons: Object.freeze(course.lessons.map((lesson) => ({
      ...lesson,
      lower: { ...lesson.lower },
      lookupEarth: source.lessons.lessons.find((upstream) => upstream.id === lesson.id)!.lookupEarth,
    }))),
    transmissions: Object.freeze(course.transmissions.map((item) => ({ ...item }))) as CourseResult["transmissions"],
    methodLabel: [transmissions.method, transmissions.subtype, transmissions.variants.length ? transmissions.variants.join("/") : undefined]
      .filter((value): value is string => Boolean(value)).join(" · "),
    generals: Object.freeze(generals.placements.map((placement) => ({ ...placement }))) as ArtifactDisplayState["generals"],
    noble: { ...course.noble },
  };
}
