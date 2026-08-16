import { EARTHLY_BRANCHES, HEAVENLY_STEMS, JIA_ZI } from "../calendar/constants";
import type { EarthlyBranch, HeavenlyStem, ValueSource } from "../chart/types";
import { STEM_RESIDENCES } from "../four-lessons/policy";
import type { FourLessonsResult } from "../four-lessons/types";
import type { HeavenEarthResult } from "../heaven-earth/types";
import { elementOfBranch, elementOfStem, elementOvercomes, relationFor } from "./foundations";
import { deriveThreeTransmissions } from "./policy";
import type {
  FiveElement,
  LessonIdentityEvidence,
  LessonRelationEvidence,
  SheHaiPalaceEvidence,
  SixRelation,
  SixRelationEvidence,
  ThreeTransmissionsResult,
  TransmissionMethod,
  TransmissionPosition,
  TransmissionSubtype,
  TransmissionVariant,
  ThreeTransmissionsRuleId,
} from "./types";

export const THREE_TRANSMISSIONS_SNAPSHOT_RULE_ID = "three-transmissions/nine-gates-v1";

const METHODS = ["贼克", "比用", "涉害", "遥克", "昴星", "别责", "八专", "伏吟", "反吟"] as const satisfies readonly TransmissionMethod[];
const SUBTYPES = ["始入", "元首", "重审", "知一", "见机", "察微", "缀瑕", "蒿矢", "弹射", "虎视", "冬蛇掩目", "不虞", "自任", "自信", "井栏"] as const satisfies readonly TransmissionSubtype[];
const VARIANTS = ["复等", "杜传"] as const satisfies readonly TransmissionVariant[];
const POSITIONS = ["initial", "middle", "final"] as const satisfies readonly TransmissionPosition[];
const LABELS = ["初传", "中传", "末传"] as const;
const RELATIONS = ["父母", "子孙", "官鬼", "妻财", "兄弟"] as const;
const PHASES = ["plate", "lessons", "candidates", "selection", "initial", "middle", "final", "relation"] as const;
const RULE_IDS = [
  "three-transmissions/plate-classification-v1",
  "three-transmissions/lesson-deduplication-v1",
  "three-transmissions/vertical-relations-v1",
  "three-transmissions/thief-overcoming-v1",
  "three-transmissions/comparison-v1",
  "three-transmissions/shehai-path-v1",
  "three-transmissions/remote-overcoming-v1",
  "three-transmissions/mao-star-v1",
  "three-transmissions/separate-responsibility-v1",
  "three-transmissions/eight-special-v1",
  "three-transmissions/fuyin-v1",
  "three-transmissions/fanyin-v1",
  "three-transmissions/initial-v1",
  "three-transmissions/middle-v1",
  "three-transmissions/final-v1",
  "three-transmissions/six-relation-v1",
] as const satisfies readonly ThreeTransmissionsRuleId[];
const LESSON_IDS = ["first", "second", "third", "fourth"] as const;
const ELEMENTS = ["木", "火", "土", "金", "水"] as const satisfies readonly FiveElement[];
const VERTICAL_DIRECTIONS = ["lower-overcomes-upper", "upper-overcomes-lower"] as const;
const RELATION_DIRECTIONS = [
  "day-generates-transmission",
  "transmission-generates-day",
  "day-overcomes-transmission",
  "transmission-overcomes-day",
  "same-element",
] as const;
const LESSON_RELATION_CONCLUSIONS = [
  "selected-lower-overcomes-upper",
  "selected-upper-overcomes-lower",
  "excluded-by-lower-overcomes-upper-priority",
  "not-a-candidate",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStem(value: unknown): value is HeavenlyStem {
  return typeof value === "string" && (HEAVENLY_STEMS as readonly string[]).includes(value);
}

function isBranch(value: unknown): value is EarthlyBranch {
  return typeof value === "string" && (EARTHLY_BRANCHES as readonly string[]).includes(value);
}

function isElement(value: unknown): value is FiveElement {
  return (ELEMENTS as readonly unknown[]).includes(value);
}

function isLessonId(value: unknown): value is typeof LESSON_IDS[number] {
  return (LESSON_IDS as readonly unknown[]).includes(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isLessonIdentityDetail(value: unknown): value is LessonIdentityEvidence {
  if (!isRecord(value)
    || value.kind !== "lesson-identity"
    || !isLessonId(value.lesson)
    || !isBranch(value.lookupEarth)
    || !isBranch(value.upper)
    || value.canonicalIdentity !== `${value.lookupEarth}:${value.upper}`) return false;
  return value.duplicateOf === undefined || isLessonId(value.duplicateOf);
}

function isLessonRelationDetail(value: unknown): value is LessonRelationEvidence {
  if (!isRecord(value)
    || value.kind !== "lesson-relation"
    || !isLessonId(value.lesson)
    || (value.lowerKind !== "stem" && value.lowerKind !== "branch")
    || !isElement(value.lowerElement)
    || !isBranch(value.upper)
    || !isElement(value.upperElement)
    || typeof value.lowerOvercomesUpper !== "boolean"
    || typeof value.upperOvercomesLower !== "boolean"
    || !(LESSON_RELATION_CONCLUSIONS as readonly unknown[]).includes(value.conclusion)) return false;
  if (value.lowerKind === "stem") {
    if (!isStem(value.lowerValue) || value.lowerElement !== elementOfStem(value.lowerValue)) return false;
  } else if (!isBranch(value.lowerValue) || value.lowerElement !== elementOfBranch(value.lowerValue)) {
    return false;
  }
  return value.upperElement === elementOfBranch(value.upper)
    && value.lowerOvercomesUpper === elementOvercomes(value.lowerElement, value.upperElement)
    && value.upperOvercomesLower === elementOvercomes(value.upperElement, value.lowerElement);
}

function isSheHaiPalaceDetail(value: unknown): value is SheHaiPalaceEvidence {
  if (!isRecord(value)
    || value.kind !== "shehai-palace"
    || !isLessonId(value.candidateLesson)
    || !isBranch(value.candidateUpper)
    || !(VERTICAL_DIRECTIONS as readonly unknown[]).includes(value.direction)
    || !isBranch(value.earth)
    || !isElement(value.branchElement)
    || value.branchElement !== elementOfBranch(value.earth)
    || typeof value.branchContributes !== "boolean"
    || !Array.isArray(value.residentStems)
    || !isNonNegativeInteger(value.increment)
    || !isNonNegativeInteger(value.total)) return false;
  if (!value.residentStems.every((resident) => isRecord(resident)
    && isStem(resident.stem)
    && isElement(resident.element)
    && resident.element === elementOfStem(resident.stem)
    && typeof resident.contributes === "boolean")) return false;
  const expectedResidentStems = HEAVENLY_STEMS.filter((stem) => STEM_RESIDENCES[stem] === value.earth);
  if (value.residentStems.length !== expectedResidentStems.length
    || value.residentStems.some(({ stem }, index) => stem !== expectedResidentStems[index])) return false;
  const targetElement = elementOfBranch(value.candidateUpper);
  const contributes = (element: FiveElement) => value.direction === "lower-overcomes-upper"
    ? elementOvercomes(element, targetElement)
    : elementOvercomes(targetElement, element);
  if (value.branchContributes !== contributes(value.branchElement)
    || value.residentStems.some(({ element, contributes: actual }) => actual !== contributes(element))) return false;
  const expectedIncrement = Number(value.branchContributes)
    + value.residentStems.filter((resident) => resident.contributes).length;
  return value.increment === expectedIncrement;
}

function directionForRelation(relation: SixRelation): typeof RELATION_DIRECTIONS[number] {
  return relation === "父母"
    ? "transmission-generates-day"
    : relation === "子孙"
      ? "day-generates-transmission"
      : relation === "官鬼"
        ? "transmission-overcomes-day"
        : relation === "妻财"
          ? "day-overcomes-transmission"
          : "same-element";
}

function isSixRelationDetail(value: unknown): value is SixRelationEvidence {
  if (!isRecord(value)
    || value.kind !== "six-relation"
    || !isStem(value.dayStem)
    || !isElement(value.dayElement)
    || value.dayElement !== elementOfStem(value.dayStem)
    || !isBranch(value.transmissionBranch)
    || !isElement(value.transmissionElement)
    || value.transmissionElement !== elementOfBranch(value.transmissionBranch)
    || !(RELATION_DIRECTIONS as readonly unknown[]).includes(value.direction)
    || !(RELATIONS as readonly unknown[]).includes(value.relation)) return false;
  const relation = value.relation as SixRelation;
  return relation === relationFor(value.dayStem, value.transmissionBranch)
    && value.direction === directionForRelation(relation);
}

function hasCanonicalLessonIdentities(details: unknown[]): boolean {
  if (details.length !== 4 || !details.every(isLessonIdentityDetail)) return false;
  const seen = new Map<string, typeof LESSON_IDS[number]>();
  return details.every((detail, index) => {
    if (detail.lesson !== LESSON_IDS[index]) return false;
    const duplicateOf = seen.get(detail.canonicalIdentity);
    if (!duplicateOf) seen.set(detail.canonicalIdentity, detail.lesson);
    return detail.duplicateOf === duplicateOf;
  });
}

function hasCanonicalLessonRelations(details: unknown[]): boolean {
  if (details.length !== 4 || !details.every(isLessonRelationDetail)) return false;
  const lowerOvercomesUpperExists = details.some(({ lowerOvercomesUpper }) => lowerOvercomesUpper);
  return details.every((detail, index) => {
    const expectedConclusion = detail.lowerOvercomesUpper
      ? "selected-lower-overcomes-upper"
      : detail.upperOvercomesLower
        ? lowerOvercomesUpperExists
          ? "excluded-by-lower-overcomes-upper-priority"
          : "selected-upper-overcomes-lower"
        : "not-a-candidate";
    return detail.lesson === LESSON_IDS[index] && detail.conclusion === expectedConclusion;
  });
}

function hasCanonicalSheHaiPath(details: unknown[]): boolean {
  if (details.length === 0 || !details.every(isSheHaiPalaceDetail)) return false;
  const totals = new Map<string, number>();
  return details.every((detail) => {
    const key = `${detail.candidateLesson}:${detail.candidateUpper}:${detail.direction}`;
    const expectedTotal = (totals.get(key) ?? 0) + detail.increment;
    totals.set(key, expectedTotal);
    return detail.total === expectedTotal;
  });
}

function hasValidDetails(step: Record<string, unknown>): boolean {
  if (step.ruleId === "three-transmissions/lesson-deduplication-v1") {
    return Array.isArray(step.details) && hasCanonicalLessonIdentities(step.details);
  }
  if (step.ruleId === "three-transmissions/vertical-relations-v1") {
    return Array.isArray(step.details) && hasCanonicalLessonRelations(step.details);
  }
  if (step.ruleId === "three-transmissions/shehai-path-v1") {
    return Array.isArray(step.details) && hasCanonicalSheHaiPath(step.details);
  }
  if (step.ruleId === "three-transmissions/six-relation-v1") {
    return Array.isArray(step.details)
      && step.details.length === 1
      && step.details.every(isSixRelationDetail);
  }
  return step.details === undefined;
}

function hasValidRulePlacement(step: Record<string, unknown>): boolean {
  const hasNoTransmission = step.transmission === undefined;
  switch (step.ruleId) {
    case "three-transmissions/plate-classification-v1":
      return step.phase === "plate" && hasNoTransmission;
    case "three-transmissions/lesson-deduplication-v1":
      return step.phase === "lessons" && hasNoTransmission;
    case "three-transmissions/vertical-relations-v1":
    case "three-transmissions/remote-overcoming-v1":
      return (step.phase === "candidates" || (
        step.ruleId === "three-transmissions/remote-overcoming-v1" && step.phase === "selection"
      )) && hasNoTransmission;
    case "three-transmissions/thief-overcoming-v1":
    case "three-transmissions/comparison-v1":
    case "three-transmissions/shehai-path-v1":
    case "three-transmissions/mao-star-v1":
    case "three-transmissions/separate-responsibility-v1":
    case "three-transmissions/eight-special-v1":
      return step.phase === "selection" && hasNoTransmission;
    case "three-transmissions/fuyin-v1":
    case "three-transmissions/fanyin-v1":
      return step.phase === "selection"
        ? hasNoTransmission
        : (POSITIONS as readonly unknown[]).includes(step.phase) && step.transmission === step.phase;
    case "three-transmissions/initial-v1":
      return step.phase === "initial" && step.transmission === "initial";
    case "three-transmissions/middle-v1":
      return step.phase === "middle" && step.transmission === "middle";
    case "three-transmissions/final-v1":
      return step.phase === "final" && step.transmission === "final";
    case "three-transmissions/six-relation-v1":
      return step.phase === "relation" && (POSITIONS as readonly unknown[]).includes(step.transmission);
    default:
      return false;
  }
}

export function isThreeTransmissionsResult(value: unknown): value is ThreeTransmissionsResult {
  if (!isRecord(value)
    || typeof value.dayPillar !== "string"
    || !(JIA_ZI as readonly string[]).includes(value.dayPillar)
    || typeof value.plateOffset !== "number"
    || !Number.isInteger(value.plateOffset)
    || value.plateOffset < 0
    || value.plateOffset > 11
    || !(METHODS as readonly unknown[]).includes(value.method)
    || (value.subtype !== undefined && !(SUBTYPES as readonly unknown[]).includes(value.subtype))) return false;

  if (!Array.isArray(value.variants)
    || !value.variants.every((variant) => (VARIANTS as readonly unknown[]).includes(variant))) return false;
  if (!Array.isArray(value.transmissions) || value.transmissions.length !== 3) return false;
  const transmissions = value.transmissions;
  if (!transmissions.every((transmission, index) => isRecord(transmission)
    && transmission.position === POSITIONS[index]
    && transmission.label === LABELS[index]
    && (EARTHLY_BRANCHES as readonly unknown[]).includes(transmission.branch)
    && (RELATIONS as readonly unknown[]).includes(transmission.relation)
    && isNonEmptyString(transmission.derivation)
    && Array.isArray(transmission.evidenceIds)
    && transmission.evidenceIds.every(isNonEmptyString))) return false;

  if (!Array.isArray(value.evidence) || value.evidence.length === 0) return false;
  const evidence = value.evidence;
  const ids = evidence.map((step) => isRecord(step) ? step.id : undefined);
  if (ids.some((id) => !isNonEmptyString(id)) || new Set(ids).size !== ids.length) return false;
  if (!evidence.every((step) => isRecord(step)
    && (RULE_IDS as readonly unknown[]).includes(step.ruleId)
    && (PHASES as readonly unknown[]).includes(step.phase)
    && (step.transmission === undefined || (POSITIONS as readonly unknown[]).includes(step.transmission))
    && isNonEmptyString(step.input)
    && isNonEmptyString(step.conclusion)
    && hasValidRulePlacement(step)
    && hasValidDetails(step))) return false;

  const evidenceIds = new Set(ids as string[]);
  if (!(PHASES as readonly string[]).every((phase) => evidence.some((step) => step.phase === phase))) {
    return false;
  }
  return transmissions.every((transmission) => (
    transmission.evidenceIds.length > 0
    && transmission.evidenceIds.every((id: string) => evidenceIds.has(id))
  ));
}

export function matchesThreeTransmissionsInputs(
  value: ThreeTransmissionsResult,
  plate: HeavenEarthResult,
  fourLessons: FourLessonsResult,
): boolean {
  if (!isThreeTransmissionsResult(value)) return false;
  try {
    const canonical = deriveThreeTransmissions(plate, fourLessons);
    return value.dayPillar === canonical.dayPillar
      && value.plateOffset === canonical.plateOffset
      && value.method === canonical.method
      && value.subtype === canonical.subtype
      && sameArray(value.variants, canonical.variants)
      && sameArray(value.transmissions, canonical.transmissions)
      && sameArray(value.evidence, canonical.evidence);
  } catch {
    return false;
  }
}

function sameArray(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length && left.every((value, index) => sameValue(value, right[index]));
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && sameArray(left, right);
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => Object.hasOwn(right, key) && sameValue(left[key], right[key]));
}

export function threeTransmissionsResultSource(
  plateSource: ValueSource,
  fourLessonsSource: ValueSource,
): ValueSource {
  return plateSource === "manual" || fourLessonsSource === "manual" ? "manual" : "automatic";
}
