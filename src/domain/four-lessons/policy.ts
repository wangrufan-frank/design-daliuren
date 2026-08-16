import type { CalendarResult } from "../calendar/types";
import type { EarthlyBranch, HeavenlyStem } from "../chart/types";
import type { HeavenEarthResult } from "../heaven-earth/types";
import type { FourLesson, FourLessonsResult } from "./types";

export const FOUR_LESSONS_STEM_RESIDENCE_RULE_ID = "four-lessons/stem-residence-v1" as const;
export const FOUR_LESSONS_RULE_ID = "four-lessons/derive-v1" as const;

export const STEM_RESIDENCES: Readonly<Record<HeavenlyStem, EarthlyBranch>> = {
  甲: "寅", 乙: "辰", 丙: "巳", 丁: "未", 戊: "巳",
  己: "未", 庚: "申", 辛: "戌", 壬: "亥", 癸: "丑",
};

export function deriveFourLessons(calendar: CalendarResult, plate: HeavenEarthResult): FourLessonsResult {
  const dayPillar = calendar.pillars.day.effective;
  const stem = dayPillar[0] as HeavenlyStem;
  const branch = dayPillar[1] as EarthlyBranch;
  const residence = STEM_RESIDENCES[stem];
  const heavenAt = (earth: EarthlyBranch) => {
    const palace = plate.palaces.find((item) => item.earth === earth);
    if (!palace) throw new Error(`天地盘缺少地盘${earth}宫`);
    return palace.heaven;
  };
  const firstUpper = heavenAt(residence);
  const secondUpper = heavenAt(firstUpper);
  const thirdUpper = heavenAt(branch);
  const fourthUpper = heavenAt(thirdUpper);
  const lessons: [FourLesson, FourLesson, FourLesson, FourLesson] = [
    { id: "first", label: "一课", upper: firstUpper, lower: { kind: "stem", value: stem }, lookupEarth: residence },
    { id: "second", label: "二课", upper: secondUpper, lower: { kind: "branch", value: firstUpper }, lookupEarth: firstUpper },
    { id: "third", label: "三课", upper: thirdUpper, lower: { kind: "branch", value: branch }, lookupEarth: branch },
    { id: "fourth", label: "四课", upper: fourthUpper, lower: { kind: "branch", value: thirdUpper }, lookupEarth: thirdUpper },
  ];
  return {
    dayPillar,
    stemResidence: { stem, earth: residence },
    lessons,
    evidence: [
      { ruleId: FOUR_LESSONS_STEM_RESIDENCE_RULE_ID, lesson: "first", input: `生效日干 ${stem}`, lookupEarth: residence, conclusion: `${stem}寄${residence}` },
      ...lessons.map((lesson) => ({
        ruleId: FOUR_LESSONS_RULE_ID,
        lesson: lesson.id,
        input: `${lesson.label}查地盘${lesson.lookupEarth}宫`,
        lookupEarth: lesson.lookupEarth,
        conclusion: `地盘${lesson.lookupEarth}宫所临天盘为${lesson.upper}`,
      })),
    ],
  };
}
