import { describe, expect, it } from "vitest";
import { deriveHeavenEarth } from "../heaven-earth/policy";
import { referenceSession } from "../../test/reference-session";
import { deriveFourLessons, STEM_RESIDENCES } from "./policy";

describe("STEM_RESIDENCES", () => {
  it("maps all ten stems to the fixed traditional palaces", () => {
    expect(STEM_RESIDENCES).toEqual({
      甲: "寅", 乙: "辰", 丙: "巳", 丁: "未", 戊: "巳",
      己: "未", 庚: "申", 辛: "戌", 壬: "亥", 癸: "丑",
    });
  });
});

describe("deriveFourLessons", () => {
  it("derives the 辛酉 reference chain in canonical order", () => {
    const calendar = referenceSession.snapshots.calendar!.value;
    const result = deriveFourLessons(calendar, deriveHeavenEarth(calendar));

    expect(result.dayPillar).toBe("辛酉");
    expect(result.stemResidence).toEqual({ stem: "辛", earth: "戌" });
    expect(result.lessons).toEqual([
      { id: "first", label: "一课", upper: "辰", lower: { kind: "stem", value: "辛" }, lookupEarth: "戌" },
      { id: "second", label: "二课", upper: "戌", lower: { kind: "branch", value: "辰" }, lookupEarth: "辰" },
      { id: "third", label: "三课", upper: "卯", lower: { kind: "branch", value: "酉" }, lookupEarth: "酉" },
      { id: "fourth", label: "四课", upper: "酉", lower: { kind: "branch", value: "卯" }, lookupEarth: "卯" },
    ]);
    expect(result.evidence).toHaveLength(5);
    expect(result.evidence).toEqual([
      {
        ruleId: "four-lessons/stem-residence-v1",
        lesson: "first",
        input: "生效日干 辛",
        lookupEarth: "戌",
        conclusion: "辛寄戌",
      },
      {
        ruleId: "four-lessons/derive-v1",
        lesson: "first",
        input: "一课：生效日干辛，固定寄宫戌，查地盘戌宫",
        lookupEarth: "戌",
        conclusion: "地盘戌宫所临天盘为辰",
      },
      {
        ruleId: "four-lessons/derive-v1",
        lesson: "second",
        input: "二课：下神来自一课上神辰，查地盘辰宫",
        lookupEarth: "辰",
        conclusion: "地盘辰宫所临天盘为戌",
      },
      {
        ruleId: "four-lessons/derive-v1",
        lesson: "third",
        input: "三课：下神为生效日支酉，查地盘酉宫",
        lookupEarth: "酉",
        conclusion: "地盘酉宫所临天盘为卯",
      },
      {
        ruleId: "four-lessons/derive-v1",
        lesson: "fourth",
        input: "四课：下神来自三课上神卯，查地盘卯宫",
        lookupEarth: "卯",
        conclusion: "地盘卯宫所临天盘为酉",
      },
    ]);
  });

  it("keeps four positions when the plate makes lesson bodies repeat", () => {
    const calendar = referenceSession.snapshots.calendar!.value;
    const identityPlate = deriveHeavenEarth({
      ...calendar,
      monthGeneral: { automatic: { name: "神后", branch: "子" }, effective: { name: "神后", branch: "子" }, source: "automatic" },
      divinationHour: { automatic: "子", effective: "子", source: "automatic" },
    });

    const result = deriveFourLessons(calendar, identityPlate);

    expect(result.lessons).toHaveLength(4);
    expect(result.lessons.map(({ id }) => id)).toEqual(["first", "second", "third", "fourth"]);
    expect(result.lessons[0].upper).toBe(result.lessons[1].upper);
    expect(result.lessons[2].upper).toBe(result.lessons[3].upper);
  });
});
