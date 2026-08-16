import { EARTHLY_BRANCHES, HEAVENLY_STEMS, JIA_ZI } from "../calendar/constants";
import type { CalendarResult } from "../calendar/types";
import type { EarthlyBranch, HeavenlyStem, ValueSource } from "../chart/types";
import type { HeavenEarthResult } from "../heaven-earth/types";
import { FOUR_LESSONS_RULE_ID, FOUR_LESSONS_STEM_RESIDENCE_RULE_ID, STEM_RESIDENCES } from "./policy";
import type { FourLesson, FourLessonId, FourLessonsResult } from "./types";

export const FOUR_LESSONS_SNAPSHOT_RULE_ID = FOUR_LESSONS_RULE_ID;

const LESSON_IDS = ["first", "second", "third", "fourth"] as const satisfies readonly FourLessonId[];
const LESSON_LABELS = ["一课", "二课", "三课", "四课"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStem(value: unknown): value is HeavenlyStem {
  return typeof value === "string" && (HEAVENLY_STEMS as readonly string[]).includes(value);
}

function isBranch(value: unknown): value is EarthlyBranch {
  return typeof value === "string" && (EARTHLY_BRANCHES as readonly string[]).includes(value);
}

function isLesson(value: unknown, index: number, stem: HeavenlyStem, branch: EarthlyBranch): value is FourLesson {
  if (!isRecord(value)
    || value.id !== LESSON_IDS[index]
    || value.label !== LESSON_LABELS[index]
    || !isBranch(value.upper)
    || !isBranch(value.lookupEarth)
    || !isRecord(value.lower)) return false;
  if (index === 0) return value.lower.kind === "stem" && value.lower.value === stem;
  return value.lower.kind === "branch" && isBranch(value.lower.value)
    && (index === 2 ? value.lower.value === branch : true);
}

function hasCompleteEvidence(value: unknown, lessons: readonly FourLesson[], residence: EarthlyBranch): boolean {
  if (!Array.isArray(value) || value.length !== 5) return false;
  if (!value.every((step) => isRecord(step)
    && typeof step.lesson === "string"
    && LESSON_IDS.includes(step.lesson as FourLessonId)
    && isBranch(step.lookupEarth)
    && typeof step.input === "string"
    && step.input.trim().length > 0
    && typeof step.conclusion === "string"
    && step.conclusion.trim().length > 0)) return false;

  const residenceSteps = value.filter((step) => (
    step.ruleId === FOUR_LESSONS_STEM_RESIDENCE_RULE_ID
    && step.lesson === "first"
    && step.lookupEarth === residence
  ));
  if (residenceSteps.length !== 1) return false;
  return lessons.every((lesson) => value.filter((step) => (
    step.ruleId === FOUR_LESSONS_RULE_ID
    && step.lesson === lesson.id
    && step.lookupEarth === lesson.lookupEarth
  )).length === 1);
}

export function isFourLessonsResult(value: unknown): value is FourLessonsResult {
  if (!isRecord(value) || typeof value.dayPillar !== "string" || !(JIA_ZI as readonly string[]).includes(value.dayPillar)) {
    return false;
  }
  const stem = value.dayPillar[0] as HeavenlyStem;
  const branch = value.dayPillar[1] as EarthlyBranch;
  if (!isStem(stem) || !isBranch(branch) || !isRecord(value.stemResidence)
    || value.stemResidence.stem !== stem || value.stemResidence.earth !== STEM_RESIDENCES[stem]) return false;

  const lessons = value.lessons;
  if (!Array.isArray(lessons) || lessons.length !== 4 || !lessons.every((lesson, index) => isLesson(lesson, index, stem, branch))) {
    return false;
  }
  const typedLessons = lessons as FourLesson[];
  if (typedLessons[0].lookupEarth !== value.stemResidence.earth
    || typedLessons[1].lower.value !== typedLessons[0].upper
    || typedLessons[1].lookupEarth !== typedLessons[0].upper
    || typedLessons[2].lookupEarth !== branch
    || typedLessons[3].lower.value !== typedLessons[2].upper
    || typedLessons[3].lookupEarth !== typedLessons[2].upper) return false;

  return hasCompleteEvidence(value.evidence, typedLessons, value.stemResidence.earth as EarthlyBranch);
}

export function matchesFourLessonsInputs(
  value: FourLessonsResult,
  calendar: CalendarResult,
  plate: HeavenEarthResult,
): boolean {
  if (value.dayPillar !== calendar.pillars.day.effective
    || plate.monthGeneral.name !== calendar.monthGeneral.effective.name
    || plate.monthGeneral.branch !== calendar.monthGeneral.effective.branch
    || plate.divinationHour.branch !== calendar.divinationHour.effective) return false;
  return value.lessons.every((lesson) => (
    plate.palaces.find((palace) => palace.earth === lesson.lookupEarth)?.heaven === lesson.upper
  ));
}

export function fourLessonsResultSource(
  calendar: CalendarResult,
  plateSnapshotSource: ValueSource,
): ValueSource {
  return calendar.pillars.day.source === "manual" || plateSnapshotSource === "manual"
    ? "manual"
    : "automatic";
}
