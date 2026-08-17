import { EARTHLY_BRANCHES, HEAVENLY_STEMS, ZHONG_QI_TO_MONTH_GENERAL } from "../calendar/constants";
import type { CalendarResult } from "../calendar/types";
import type { EarthlyBranch, ValueSource } from "../chart/types";
import type { FourLessonsResult } from "../four-lessons/types";
import { GENERAL_ORDER } from "../heavenly-generals/policy";
import type { HeavenlyGeneralsResult } from "../heavenly-generals/types";
import type { SixRelation, TransmissionMethod, TransmissionSubtype, TransmissionVariant } from "../three-transmissions/types";
import type { StemBranch } from "../calendar/types";
import type { CourseResult } from "./types";
import { COURSE_LESSON_ORDER, COURSE_PALACE_ORDER, deriveCourse } from "./policy";

export const COURSE_SNAPSHOT_RULE_ID = "course/verified-projection-v1";

const methods = new Set<TransmissionMethod>(["贼克", "比用", "涉害", "遥克", "昴星", "别责", "八专", "伏吟", "反吟"]);
const subtypes = new Set<TransmissionSubtype>(["始入", "元首", "重审", "知一", "见机", "察微", "缀瑕", "蒿矢", "弹射", "虎视", "冬蛇掩目", "不虞", "自任", "自信", "井栏"]);
const variants = new Set<TransmissionVariant>(["复等", "杜传"]);
const relations = new Set<SixRelation>(["父母", "子孙", "官鬼", "妻财", "兄弟"]);
const monthGeneralNames = new Set(Object.values(ZHONG_QI_TO_MONTH_GENERAL).map(({ name }) => name));
const positions = ["initial", "middle", "final"] as const;
const transmissionLabels = ["初传", "中传", "末传"] as const;
const lessonLabels = ["四课", "三课", "二课", "一课"] as const;

export function isCourseResult(value: unknown): value is CourseResult {
  if (!isRecord(value) || !hasExactKeys(value, ["context", "method", "transmissions", "lessons", "palaces", "noble"])) return false;
  if (!isContext(value.context) || !isMethod(value.method) || !isNoble(value.noble)) return false;
  if (!Array.isArray(value.transmissions) || value.transmissions.length !== 3) return false;
  if (!Array.isArray(value.lessons) || value.lessons.length !== 4) return false;
  if (!Array.isArray(value.palaces) || value.palaces.length !== 12) return false;
  if (!transmissionsAreCanonical(value.transmissions)) return false;
  if (!lessonsAreCanonical(value.lessons)) return false;
  if (!palacesAreCanonical(value.palaces)) return false;
  return true;
}

export function matchesCourseInputs(
  value: CourseResult,
  locationName: string,
  calendar: CalendarResult,
  lessons: FourLessonsResult,
  transmissions: import("../three-transmissions/types").ThreeTransmissionsResult,
  generals: HeavenlyGeneralsResult,
): boolean {
  if (!isCourseResult(value)) return false;
  try {
    return sameValue(value, deriveCourse(locationName, calendar, lessons, transmissions, generals));
  } catch {
    return false;
  }
}

export function courseResultSource(sources: readonly ValueSource[]): ValueSource {
  return sources.includes("manual") ? "manual" : "automatic";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length && actual.every((key) => expected.includes(key));
}

function isBranch(value: unknown): value is EarthlyBranch {
  return typeof value === "string" && (EARTHLY_BRANCHES as readonly string[]).includes(value);
}

function isStemBranch(value: unknown): value is StemBranch {
  if (typeof value !== "string") return false;
  const [stem, branch] = [...value];
  return value.length === 2
    && (HEAVENLY_STEMS as readonly string[]).includes(stem)
    && (EARTHLY_BRANCHES as readonly string[]).includes(branch);
}

function isContext(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ["civilDateTime", "effectiveGanzhiDate", "locationName", "lunarDateDisplay", "pillars", "monthBuild", "monthGeneral", "divinationHour"])) return false;
  if (typeof value.civilDateTime !== "string" || typeof value.effectiveGanzhiDate !== "string" || typeof value.locationName !== "string" || typeof value.lunarDateDisplay !== "string") return false;
  if (!isRecord(value.pillars) || !hasExactKeys(value.pillars, ["year", "month", "day", "hour"]) || !Object.values(value.pillars).every(isStemBranch)) return false;
  if (!isRecord(value.monthGeneral) || !hasExactKeys(value.monthGeneral, ["name", "branch"]) || !monthGeneralNames.has(value.monthGeneral.name as never) || !isBranch(value.monthGeneral.branch)) return false;
  return isBranch(value.monthBuild) && isBranch(value.divinationHour);
}

function isMethod(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const expectedKeys = value.subtype === undefined ? ["method", "variants"] : ["method", "subtype", "variants"];
  return hasExactKeys(value, expectedKeys)
    && methods.has(value.method as TransmissionMethod)
    && (value.subtype === undefined || subtypes.has(value.subtype as TransmissionSubtype))
    && Array.isArray(value.variants)
    && value.variants.every((variant) => variants.has(variant as TransmissionVariant))
    && new Set(value.variants).size === value.variants.length;
}

function transmissionsAreCanonical(value: readonly unknown[]): boolean {
  return value.every((item, index) => isRecord(item)
    && hasExactKeys(item, ["position", "label", "branch", "relation", "general"])
    && item.position === positions[index]
    && item.label === transmissionLabels[index]
    && isBranch(item.branch)
    && relations.has(item.relation as SixRelation)
    && (GENERAL_ORDER as readonly string[]).includes(item.general as string));
}

function lessonsAreCanonical(value: readonly unknown[]): boolean {
  return value.every((item, index) => isRecord(item)
    && hasExactKeys(item, ["id", "label", "upper", "lower", "general"])
    && item.id === COURSE_LESSON_ORDER[index]
    && item.label === lessonLabels[index]
    && isBranch(item.upper)
    && isRecord(item.lower)
    && hasExactKeys(item.lower, ["kind", "value"])
    && ((item.lower.kind === "branch" && isBranch(item.lower.value))
      || (item.lower.kind === "stem" && typeof item.lower.value === "string" && (HEAVENLY_STEMS as readonly string[]).includes(item.lower.value)))
    && (GENERAL_ORDER as readonly string[]).includes(item.general as string));
}

function palacesAreCanonical(value: readonly unknown[]): boolean {
  return value.every((item, index) => isRecord(item)
    && hasExactKeys(item, ["earth", "heaven", "general", "noble"])
    && item.earth === COURSE_PALACE_ORDER[index]
    && isBranch(item.heaven)
    && (GENERAL_ORDER as readonly string[]).includes(item.general as string)
    && typeof item.noble === "boolean")
    && new Set(value.map((item) => (item as Record<string, unknown>).heaven)).size === 12
    && new Set(value.map((item) => (item as Record<string, unknown>).general)).size === 12
    && value.filter((item) => (item as Record<string, unknown>).noble).length === 1;
}

function isNoble(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["dayNight", "nobleHeaven", "nobleEarth", "direction"])
    && (value.dayNight === "day" || value.dayNight === "night")
    && isBranch(value.nobleHeaven)
    && isBranch(value.nobleEarth)
    && (value.direction === "forward" || value.direction === "reverse");
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, index) => sameValue(item, right[index]));
  if (!isRecord(left) || !isRecord(right)) return false;
  return hasExactKeys(right, Object.keys(left)) && Object.entries(left).every(([key, value]) => sameValue(value, right[key]));
}
