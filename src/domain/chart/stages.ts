import type { RuleStageId } from "./types";

export const RULE_STAGE_ORDER = [
  "calendar",
  "heaven-earth",
  "four-lessons",
  "three-transmissions",
  "heavenly-generals",
  "course",
] as const satisfies readonly RuleStageId[];

export const stageDependencies: Record<RuleStageId, readonly RuleStageId[]> = {
  calendar: [],
  "heaven-earth": ["calendar"],
  "four-lessons": ["calendar", "heaven-earth"],
  "three-transmissions": ["heaven-earth", "four-lessons"],
  "heavenly-generals": ["calendar", "heaven-earth", "three-transmissions"],
  course: ["four-lessons", "three-transmissions", "heavenly-generals"],
};
