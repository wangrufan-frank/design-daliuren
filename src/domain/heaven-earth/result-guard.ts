import { EARTHLY_BRANCHES } from "../calendar/constants";
import type { EarthlyBranch, ValueSource } from "../chart/types";
import { HEAVEN_EARTH_RULE_ID } from "./policy";
import type { HeavenEarthResult } from "./types";

export const HEAVEN_EARTH_SNAPSHOT_RULE_ID = HEAVEN_EARTH_RULE_ID;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBranch(value: unknown): value is EarthlyBranch {
  return typeof value === "string" && (EARTHLY_BRANCHES as readonly string[]).includes(value);
}

function isValueSource(value: unknown): value is ValueSource {
  return value === "automatic" || value === "manual";
}

function isInputValue(value: unknown): value is { branch: EarthlyBranch; source: ValueSource } {
  return isRecord(value) && isBranch(value.branch) && isValueSource(value.source);
}

function isMonthGeneral(value: unknown): value is { name: string; branch: EarthlyBranch; source: ValueSource } {
  if (!isRecord(value)) return false;
  const name = value.name;
  return isInputValue(value) && typeof name === "string" && name.trim().length > 0;
}

function hasCompleteEvidence(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const expectedFields = ["plate", ...EARTHLY_BRANCHES.map((branch) => `palace.${branch}`)];
  return value.every((step) => isRecord(step)
    && step.ruleId === HEAVEN_EARTH_RULE_ID
    && typeof step.field === "string"
    && typeof step.input === "string"
    && step.input.trim().length > 0
    && typeof step.conclusion === "string"
    && step.conclusion.trim().length > 0)
    && expectedFields.every((field) => value.some((step) => isRecord(step) && step.field === field));
}

export function isHeavenEarthResult(value: unknown): value is HeavenEarthResult {
  if (!isRecord(value)) return false;
  const monthGeneral = value.monthGeneral;
  const divinationHour = value.divinationHour;
  const offset = value.offset;
  const palaces = value.palaces;
  if (!isMonthGeneral(monthGeneral) || !isInputValue(divinationHour)) return false;
  if (typeof offset !== "number" || !Number.isInteger(offset) || offset < 0 || offset > 11) return false;
  if (!Array.isArray(palaces) || palaces.length !== 12) return false;
  if (!palaces.every((palace) => isRecord(palace) && isBranch(palace.earth) && isBranch(palace.heaven))) return false;

  const earthBranches = palaces.map((palace) => palace.earth);
  const heavenBranches = palaces.map((palace) => palace.heaven);
  if (new Set(earthBranches).size !== 12 || new Set(heavenBranches).size !== 12) return false;
  if (!palaces.some(({ earth, heaven }) => (
    earth === divinationHour.branch && heaven === monthGeneral.branch
  ))) return false;

  return hasCompleteEvidence(value.evidence);
}

export function heavenEarthResultSource(value: HeavenEarthResult): ValueSource {
  return value.monthGeneral.source === "manual" || value.divinationHour.source === "manual"
    ? "manual"
    : "automatic";
}
