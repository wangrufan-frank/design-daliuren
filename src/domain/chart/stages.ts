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
  "four-lessons": ["heaven-earth"],
  "three-transmissions": ["four-lessons"],
  "heavenly-generals": ["calendar", "heaven-earth"],
  course: ["four-lessons", "three-transmissions", "heavenly-generals"],
};
