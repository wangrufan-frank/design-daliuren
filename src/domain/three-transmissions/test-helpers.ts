import { EARTHLY_BRANCHES } from "../calendar/constants";
import type { MonthGeneralName, StemBranch } from "../calendar/types";
import type { EarthlyBranch, HeavenlyStem } from "../chart/types";
import { STEM_RESIDENCES } from "../four-lessons/policy";
import type { FourLesson, FourLessonId, FourLessonLower, FourLessonsResult } from "../four-lessons/types";
import type { HeavenEarthResult } from "../heaven-earth/types";
import { polarityOfBranch } from "./foundations";
import type { LessonCandidate } from "./selectors";

const MONTH_GENERAL_NAMES: Readonly<Record<EarthlyBranch, MonthGeneralName>> = {
  子: "神后", 丑: "大吉", 寅: "功曹", 卯: "太冲", 辰: "天罡", 巳: "太乙",
  午: "胜光", 未: "小吉", 申: "传送", 酉: "从魁", 戌: "河魁", 亥: "登明",
};

const LESSON_LABELS = {
  first: "一课", second: "二课", third: "三课", fourth: "四课",
} as const;

export type LessonTuple = readonly [FourLessonId, EarthlyBranch, FourLessonLower];

export function makePlate(
  monthGeneral: EarthlyBranch,
  divinationHour: EarthlyBranch,
): HeavenEarthResult {
  const offset = (
    EARTHLY_BRANCHES.indexOf(monthGeneral)
    - EARTHLY_BRANCHES.indexOf(divinationHour)
    + EARTHLY_BRANCHES.length
  ) % EARTHLY_BRANCHES.length;
  const palaces = EARTHLY_BRANCHES.map((earth, index) => ({
    earth,
    heaven: EARTHLY_BRANCHES[(index + offset) % EARTHLY_BRANCHES.length],
  }));

  return {
    monthGeneral: { branch: monthGeneral, name: MONTH_GENERAL_NAMES[monthGeneral], source: "automatic" },
    divinationHour: { branch: divinationHour, source: "automatic" },
    offset,
    palaces,
    evidence: [],
  };
}

export function makeSelectorInput(input: {
  dayPillar: StemBranch;
  lessons: readonly LessonTuple[];
}): FourLessonsResult {
  if (input.lessons.length !== 4) throw new Error("四课测试夹具必须包含四课");
  const stem = input.dayPillar[0] as HeavenlyStem;
  const lessons = input.lessons.map(([id, upper, lower]) => ({
    id,
    label: LESSON_LABELS[id],
    upper,
    lower,
    lookupEarth: id === "first"
      ? STEM_RESIDENCES[stem]
      : lower.kind === "branch" ? lower.value : STEM_RESIDENCES[lower.value],
  })) as unknown as FourLessonsResult["lessons"];

  return {
    dayPillar: input.dayPillar,
    stemResidence: { stem, earth: STEM_RESIDENCES[stem] },
    lessons,
    evidence: [],
  };
}

export function makeRuleInput(
  dayPillar: StemBranch,
  monthGeneral: EarthlyBranch,
  divinationHour: EarthlyBranch,
): { plate: HeavenEarthResult; fourLessons: FourLessonsResult } {
  const plate = makePlate(monthGeneral, divinationHour);
  const stem = dayPillar[0] as HeavenlyStem;
  const branch = dayPillar[1] as EarthlyBranch;
  const stemEarth = STEM_RESIDENCES[stem];
  const upperAt = (earth: EarthlyBranch): EarthlyBranch => {
    const palace = plate.palaces.find((item) => item.earth === earth);
    if (!palace) throw new Error(`测试天地盘缺少地盘${earth}宫`);
    return palace.heaven;
  };
  const firstUpper = upperAt(stemEarth);
  const thirdUpper = upperAt(branch);
  return {
    plate,
    fourLessons: makeSelectorInput({
      dayPillar,
      lessons: [
        ["first", firstUpper, { kind: "stem", value: stem }],
        ["second", upperAt(firstUpper), { kind: "branch", value: firstUpper }],
        ["third", thirdUpper, { kind: "branch", value: branch }],
        ["fourth", upperAt(thirdUpper), { kind: "branch", value: thirdUpper }],
      ],
    }),
  };
}

export function candidate(lesson: FourLessonId, upper: EarthlyBranch): LessonCandidate {
  const lower: FourLessonLower = lesson === "first"
    ? { kind: "stem", value: "庚" }
    : { kind: "branch", value: upper };
  const lessonValue: FourLesson = {
    id: lesson,
    label: LESSON_LABELS[lesson],
    upper,
    lower,
    lookupEarth: upper,
  };
  return {
    lesson: lessonValue,
    direction: "upper-overcomes-lower",
    upper,
    upperPolarity: polarityOfBranch(upper),
  };
}

export function candidateOver(
  lesson: FourLessonId,
  upper: EarthlyBranch,
  currentEarth: EarthlyBranch,
): LessonCandidate {
  const value = candidate(lesson, upper);
  return {
    ...value,
    lesson: {
      ...value.lesson,
      lower: lesson === "first"
        ? value.lesson.lower
        : { kind: "branch", value: currentEarth },
      lookupEarth: currentEarth,
    },
  };
}

export function makeRemoteLessons(
  uppers: Record<"first" | "second" | "third" | "fourth", EarthlyBranch>,
): FourLessonsResult {
  return makeSelectorInput({
    dayPillar: "甲子",
    lessons: [
      ["first", uppers.first, { kind: "stem", value: "甲" }],
      ["second", uppers.second, { kind: "branch", value: uppers.first }],
      ["third", uppers.third, { kind: "branch", value: "子" }],
      ["fourth", uppers.fourth, { kind: "branch", value: uppers.third }],
    ],
  });
}

function assertUniqueLessonCount(
  name: string,
  result: { plate: HeavenEarthResult; fourLessons: FourLessonsResult },
  expected: number,
): typeof result {
  const identities = result.fourLessons.lessons.map(({ lookupEarth, upper }) => `${lookupEarth}:${upper}`);
  const actual = new Set(identities).size;
  if (actual !== expected) throw new Error(`${name}应有${expected}个唯一课体，实际为${actual}`);
  return result;
}

export function equalDepthPlate(): HeavenEarthResult {
  return makePlate("卯", "子");
}

export function completeLessons(): { plate: HeavenEarthResult; fourLessons: FourLessonsResult } {
  return assertUniqueLessonCount("completeLessons", makeRuleInput("戊戌", "申", "戌"), 4);
}

export function threeUniqueLessons(): { plate: HeavenEarthResult; fourLessons: FourLessonsResult } {
  return assertUniqueLessonCount("threeUniqueLessons", makeRuleInput("庚戌", "寅", "子"), 3);
}

export function eightSpecialLessons(): { plate: HeavenEarthResult; fourLessons: FourLessonsResult } {
  return assertUniqueLessonCount("eightSpecialLessons", makeRuleInput("庚申", "丑", "子"), 2);
}
