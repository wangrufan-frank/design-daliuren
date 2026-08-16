import { EARTHLY_BRANCHES, JIA_ZI } from "../calendar/constants";
import type { ValueSource } from "../chart/types";
import type { FourLessonsResult } from "../four-lessons/types";
import type { HeavenEarthResult } from "../heaven-earth/types";
import { deriveThreeTransmissions } from "./policy";
import type {
  ThreeTransmissionsResult,
  TransmissionMethod,
  TransmissionPosition,
  TransmissionSubtype,
  TransmissionVariant,
} from "./types";

export const THREE_TRANSMISSIONS_SNAPSHOT_RULE_ID = "three-transmissions/nine-gates-v1";

const METHODS = ["贼克", "比用", "涉害", "遥克", "昴星", "别责", "八专", "伏吟", "反吟"] as const satisfies readonly TransmissionMethod[];
const SUBTYPES = ["始入", "元首", "重审", "知一", "见机", "察微", "缀瑕", "蒿矢", "弹射", "虎视", "冬蛇掩目", "不虞", "自任", "自信", "井栏"] as const satisfies readonly TransmissionSubtype[];
const VARIANTS = ["复等", "杜传"] as const satisfies readonly TransmissionVariant[];
const POSITIONS = ["initial", "middle", "final"] as const satisfies readonly TransmissionPosition[];
const LABELS = ["初传", "中传", "末传"] as const;
const RELATIONS = ["父母", "子孙", "官鬼", "妻财", "兄弟"] as const;
const PHASES = ["plate", "lessons", "candidates", "selection", "initial", "middle", "final", "relation"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
  if (!value.transmissions.every((transmission, index) => isRecord(transmission)
    && transmission.position === POSITIONS[index]
    && transmission.label === LABELS[index]
    && (EARTHLY_BRANCHES as readonly unknown[]).includes(transmission.branch)
    && (RELATIONS as readonly unknown[]).includes(transmission.relation)
    && isNonEmptyString(transmission.derivation)
    && Array.isArray(transmission.evidenceIds)
    && transmission.evidenceIds.every(isNonEmptyString))) return false;

  if (!Array.isArray(value.evidence) || value.evidence.length === 0) return false;
  const ids = value.evidence.map((step) => isRecord(step) ? step.id : undefined);
  if (ids.some((id) => !isNonEmptyString(id)) || new Set(ids).size !== ids.length) return false;
  return value.evidence.every((step) => isRecord(step)
    && isNonEmptyString(step.ruleId)
    && (PHASES as readonly unknown[]).includes(step.phase)
    && (step.transmission === undefined || (POSITIONS as readonly unknown[]).includes(step.transmission))
    && isNonEmptyString(step.input)
    && isNonEmptyString(step.conclusion));
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
