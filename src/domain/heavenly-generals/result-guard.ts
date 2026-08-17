import { EARTHLY_BRANCHES, HEAVENLY_STEMS } from "../calendar/constants";
import type { CalendarResult } from "../calendar/types";
import type { EarthlyBranch, HeavenlyStem, ValueSource } from "../chart/types";
import type { HeavenEarthResult } from "../heaven-earth/types";
import { GENERAL_ORDER, deriveHeavenlyGenerals } from "./policy";
import type { HeavenlyGeneralsResult } from "./types";

export const HEAVENLY_GENERALS_SNAPSHOT_RULE_ID = "heavenly-generals/lin-feng-noble-v1";

export function isHeavenlyGeneralsResult(value: unknown): value is HeavenlyGeneralsResult {
  if (!isRecord(value)
    || !isStem(value.dayStem)
    || !isBranch(value.divinationHour)
    || (value.dayNight !== "day" && value.dayNight !== "night")
    || !isBranch(value.nobleHeaven)
    || !isBranch(value.nobleEarth)
    || (value.direction !== "forward" && value.direction !== "reverse")
    || !Array.isArray(value.placements)
    || value.placements.length !== 12
    || !Array.isArray(value.evidence)
    || value.evidence.length !== 16) return false;

  if (!value.placements.every((placement, order) => isRecord(placement)
    && placement.order === order
    && GENERAL_ORDER[order] === placement.general
    && isBranch(placement.earth)
    && isBranch(placement.heaven)
    && typeof placement.evidenceId === "string")) return false;
  if (!value.evidence.every((step) => isRecord(step)
    && typeof step.id === "string"
    && typeof step.ruleId === "string"
    && typeof step.phase === "string"
    && typeof step.input === "string"
    && typeof step.conclusion === "string"
    && isRecord(step.details))) return false;
  const result = value as unknown as HeavenlyGeneralsResult;
  if (new Set(result.placements.map(({ earth }) => earth)).size !== 12
    || new Set(result.placements.map(({ heaven }) => heaven)).size !== 12
    || new Set(result.placements.map(({ general }) => general)).size !== 12
    || new Set(result.evidence.map(({ id }) => id)).size !== 16) return false;

  const syntheticPalaces = EARTHLY_BRANCHES.map((earth) => {
    const placement = result.placements.find((item) => item.earth === earth);
    if (!placement) throw new Error(`缺少地盘${earth}宫`);
    return { earth, heaven: placement.heaven };
  });
  const offset = EARTHLY_BRANCHES.indexOf(syntheticPalaces[0].heaven);
  const syntheticPlate: HeavenEarthResult = {
    monthGeneral: { branch: "子", name: "神后", source: "automatic" },
    divinationHour: { branch: result.divinationHour, source: "automatic" },
    offset,
    palaces: syntheticPalaces,
    evidence: [],
  };
  try {
    return sameValue(result, deriveHeavenlyGenerals(
      result.dayStem,
      result.divinationHour,
      syntheticPlate,
    ));
  } catch {
    return false;
  }
}

export function matchesHeavenlyGeneralsInputs(
  value: HeavenlyGeneralsResult,
  dayStem: HeavenlyStem,
  divinationHour: EarthlyBranch,
  plate: HeavenEarthResult,
): boolean {
  if (!isHeavenlyGeneralsResult(value)) return false;
  try {
    return sameValue(value, deriveHeavenlyGenerals(dayStem, divinationHour, plate));
  } catch {
    return false;
  }
}

export function heavenlyGeneralsResultSource(
  calendar: CalendarResult,
  plateSource: ValueSource,
): ValueSource {
  return calendar.pillars.day.source === "manual"
    || calendar.divinationHour.source === "manual"
    || plateSource === "manual"
    ? "manual"
    : "automatic";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStem(value: unknown): value is HeavenlyStem {
  return typeof value === "string" && (HEAVENLY_STEMS as readonly string[]).includes(value);
}

function isBranch(value: unknown): value is EarthlyBranch {
  return typeof value === "string" && (EARTHLY_BRANCHES as readonly string[]).includes(value);
}

function sameArray(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length && left.every((item, index) => sameValue(item, right[index]));
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
