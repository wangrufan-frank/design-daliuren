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
    expect(result.evidence[0]).toMatchObject({
      ruleId: "four-lessons/stem-residence-v1",
      lesson: "first",
      lookupEarth: "戌",
    });
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
