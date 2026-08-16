import { EARTHLY_BRANCHES } from "../calendar/constants";
import type { EarthlyBranch, HeavenlyStem } from "../chart/types";
import { STEM_RESIDENCES } from "../four-lessons/policy";
import type { FourLessonsResult } from "../four-lessons/types";
import type { HeavenEarthResult } from "../heaven-earth/types";
import {
  STEM_COMBINATIONS,
  earthUnder,
  heavenAt,
  nextTrineBranch,
  polarityOfStem,
} from "./foundations";
import type {
  EvidenceDraft,
  TransmissionMethod,
  TransmissionSubtype,
  TransmissionVariant,
} from "./types";

export interface TransmissionDraft {
  method: TransmissionMethod;
  subtype?: TransmissionSubtype;
  variants: readonly TransmissionVariant[];
  branches: readonly [EarthlyBranch, EarthlyBranch, EarthlyBranch];
  evidence: readonly EvidenceDraft[];
}

export function deriveMaoStar(
  dayStem: HeavenlyStem,
  fourLessons: FourLessonsResult,
  plate: HeavenEarthResult,
): TransmissionDraft {
  const firstUpper = fourLessons.lessons[0].upper;
  const thirdUpper = fourLessons.lessons[2].upper;
  const isYang = polarityOfStem(dayStem) === "yang";
  const initial = isYang ? heavenAt(plate, "酉") : earthUnder(plate, "酉");
  return {
    method: "昴星",
    subtype: isYang ? "虎视" : "冬蛇掩目",
    variants: [],
    branches: isYang
      ? [initial, thirdUpper, firstUpper]
      : [initial, firstUpper, thirdUpper],
    evidence: [{
      ruleId: "three-transmissions/mao-star-v1",
      phase: "selection",
      input: `日干${dayStem}，酉位与一三课上神定三传`,
      conclusion: `${isYang ? "阳日虎视" : "阴日冬蛇掩目"}，初传${initial}`,
    }],
  };
}

export function deriveSeparateResponsibility(
  dayStem: HeavenlyStem,
  dayBranch: EarthlyBranch,
  fourLessons: FourLessonsResult,
  plate: HeavenEarthResult,
): TransmissionDraft {
  const isYang = polarityOfStem(dayStem) === "yang";
  const combinedStem = STEM_COMBINATIONS[dayStem];
  const initial = isYang
    ? heavenAt(plate, STEM_RESIDENCES[combinedStem])
    : nextTrineBranch(dayBranch);
  const firstUpper = fourLessons.lessons[0].upper;
  return {
    method: "别责",
    variants: [],
    branches: [initial, firstUpper, firstUpper],
    evidence: [{
      ruleId: "three-transmissions/separate-responsibility-v1",
      phase: "selection",
      input: isYang
        ? `日干${dayStem}取五合${combinedStem}寄宫上神`
        : `日支${dayBranch}取三合下一支`,
      conclusion: `别责初传${initial}，中末皆取日上神${firstUpper}`,
    }],
  };
}

export function deriveEightSpecial(
  dayStem: HeavenlyStem,
  fourLessons: FourLessonsResult,
): TransmissionDraft {
  const isYang = polarityOfStem(dayStem) === "yang";
  const startingGod = isYang
    ? fourLessons.lessons[0].upper
    : fourLessons.lessons[3].upper;
  const startIndex = EARTHLY_BRANCHES.indexOf(startingGod);
  const initial = EARTHLY_BRANCHES[
    (startIndex + (isYang ? 2 : -2) + EARTHLY_BRANCHES.length) % EARTHLY_BRANCHES.length
  ];
  const firstUpper = fourLessons.lessons[0].upper;
  return {
    method: "八专",
    variants: [],
    branches: [initial, firstUpper, firstUpper],
    evidence: [{
      ruleId: "three-transmissions/eight-special-v1",
      phase: "selection",
      input: `${isYang ? "阳日从日上神顺数三位" : "阴日从四课上神逆数三位"}`,
      conclusion: `起点计一，八专初传${initial}，中末皆取日上神${firstUpper}`,
    }],
  };
}
