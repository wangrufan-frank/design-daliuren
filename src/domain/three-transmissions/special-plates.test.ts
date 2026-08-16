import { describe, expect, it } from "vitest";
import type { StemBranch } from "../calendar/types";
import type { EarthlyBranch } from "../chart/types";
import type { FourLessonsResult } from "../four-lessons/types";
import type { HeavenEarthResult } from "../heaven-earth/types";
import { clashOf, heavenAt, postHorseOf, punishmentOf } from "./foundations";
import { deriveThreeTransmissions, ThreeTransmissionsRuleUnresolvedError } from "./policy";
import { isFanYin, isFuYin, selectVerticalInitial } from "./special-methods";
import { makePlate, makeRuleInput, makeSelectorInput } from "./test-helpers";

function fuYinInput(dayPillar: StemBranch): [HeavenEarthResult, FourLessonsResult] {
  const { plate, fourLessons } = makeRuleInput(dayPillar, "子", "子");
  return [plate, fourLessons];
}

function fuYinWithOvercoming(dayPillar: StemBranch): [HeavenEarthResult, FourLessonsResult] {
  return fuYinInput(dayPillar);
}

function fuYinWithoutOvercoming(dayPillar: StemBranch): [HeavenEarthResult, FourLessonsResult] {
  return fuYinInput(dayPillar);
}

function fuYinSelfPunishmentCase(dayPillar: "壬辰"): [HeavenEarthResult, FourLessonsResult] {
  return fuYinInput(dayPillar);
}

function fanYinWithOvercoming(): [HeavenEarthResult, FourLessonsResult] {
  const { plate, fourLessons } = makeRuleInput("甲子", "午", "子");
  return [plate, fourLessons];
}

function fanYinWithoutOvercoming(dayPillar: StemBranch): [HeavenEarthResult, FourLessonsResult] {
  const { plate, fourLessons } = makeRuleInput(dayPillar, "午", "子");
  return [plate, fourLessons];
}

function noncanonicalFanYinNoOvercoming(): [HeavenEarthResult, FourLessonsResult] {
  return [makePlate("午", "子"), makeSelectorInput({
    dayPillar: "丁卯",
    lessons: [
      ["first", "丑", { kind: "stem", value: "丁" }],
      ["second", "未", { kind: "branch", value: "丑" }],
      ["third", "巳", { kind: "branch", value: "卯" }],
      ["fourth", "午", { kind: "branch", value: "巳" }],
    ],
  })];
}

function expectMethodEvidenceBound(
  result: ReturnType<typeof deriveThreeTransmissions>,
  ruleId: "three-transmissions/fuyin-v1" | "three-transmissions/fanyin-v1",
): void {
  for (const transmission of result.transmissions) {
    const evidence = result.evidence.find(({ phase, transmission: owner, ruleId: actualRuleId }) => (
      phase === transmission.position && owner === transmission.position && actualRuleId === ruleId
    ));
    expect(evidence).toBeDefined();
    expect(transmission.evidenceIds).toContain(evidence!.id);
  }
}

describe("special plate classification and dispatch", () => {
  it("classifies only all-twelve same-position plates as Fu Yin", () => {
    expect(isFuYin(makePlate("子", "子"))).toBe(true);
    expect(isFuYin(makePlate("丑", "子"))).toBe(false);

    const tampered = makePlate("子", "子");
    expect(isFuYin({
      ...tampered,
      palaces: tampered.palaces.map((palace) => (
        palace.earth === "亥" ? { ...palace, heaven: "子" as const } : palace
      )),
    })).toBe(false);
  });

  it("classifies only six-palace opposition as Fan Yin", () => {
    expect(isFanYin(makePlate("午", "子"))).toBe(true);
    expect(isFanYin(makePlate("巳", "子"))).toBe(false);
    expect(isFanYin({ ...makePlate("午", "子"), offset: 5 })).toBe(false);

    const tampered = makePlate("午", "子");
    expect(isFanYin({
      ...tampered,
      palaces: tampered.palaces.map((palace) => (
        palace.earth === "亥" ? { ...palace, heaven: "午" as const } : palace
      )),
    })).toBe(false);
  });

  it("dispatches a same-position plate to Fu Yin before ordinary methods", () => {
    const input = makeRuleInput("甲寅", "子", "子");
    expect(deriveThreeTransmissions(input.plate, input.fourLessons).method).toBe("伏吟");
  });

  it("dispatches a six-palace opposition plate to Fan Yin before ordinary methods", () => {
    const input = makeRuleInput("甲子", "午", "子");
    expect(deriveThreeTransmissions(input.plate, input.fourLessons).method).toBe("反吟");
  });
});

describe("Fu Yin transmissions", () => {
  it("uses punishment transmissions for Fu Yin with vertical overcoming", () => {
    const result = deriveThreeTransmissions(...fuYinWithOvercoming("乙卯"));
    expect(result).toEqual(expect.objectContaining({ method: "伏吟", subtype: "不虞" }));
    expect(result.transmissions[1].branch).toBe(punishmentOf(result.transmissions[0].branch));
    expect(result.evidence).toEqual(expect.arrayContaining([expect.objectContaining({
      ruleId: "three-transmissions/fuyin-v1",
      phase: "middle",
      transmission: "middle",
    })]));
    expectMethodEvidenceBound(result, "three-transmissions/fuyin-v1");
  });

  it("uses Self-Reliance and Self-Confidence when Fu Yin has no overcoming", () => {
    const yang = deriveThreeTransmissions(...fuYinWithoutOvercoming("甲辰"));
    const yin = deriveThreeTransmissions(...fuYinWithoutOvercoming("丁辰"));
    expect(yang.subtype).toBe("自任");
    expect(yang.transmissions.map(({ branch }) => branch)).toEqual(["寅", "巳", "申"]);
    expect(yin.subtype).toBe("自信");
    expect(yin.transmissions.map(({ branch }) => branch)).toEqual(["辰", "未", "丑"]);
  });

  it("switches the middle source and clashes the final after repeated self-punishment", () => {
    const result = deriveThreeTransmissions(...fuYinSelfPunishmentCase("壬辰"));
    expect(result.variants).toContain("杜传");
    expect(result.transmissions[2].branch).toBe(clashOf(result.transmissions[1].branch));
    expect(result.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ruleId: "three-transmissions/fuyin-v1",
        phase: "middle",
        transmission: "middle",
        input: expect.stringContaining("自刑"),
      }),
      expect.objectContaining({
        ruleId: "three-transmissions/fuyin-v1",
        phase: "final",
        transmission: "final",
        input: expect.stringContaining("再次自刑"),
      }),
    ]));
  });

  it("uses the shared lower-overcomes-upper comparison without Zhi Yi", () => {
    const lessons = makeSelectorInput({
      dayPillar: "丙辰",
      lessons: [
        ["first", "酉", { kind: "stem", value: "丙" }],
        ["second", "寅", { kind: "branch", value: "酉" }],
        ["third", "辰", { kind: "branch", value: "辰" }],
        ["fourth", "辰", { kind: "branch", value: "辰" }],
      ],
    });
    const plate = makePlate("子", "子");

    const vertical = selectVerticalInitial("丙", lessons, plate);
    expect(vertical).toEqual(expect.objectContaining({
      method: "比用",
      candidate: expect.objectContaining({ upper: "寅" }),
    }));
    expect(vertical).not.toHaveProperty("subtype");

    const result = deriveThreeTransmissions(plate, lessons);

    expect(result).toEqual(expect.objectContaining({ method: "伏吟", subtype: "不虞" }));
    expect(result.transmissions[0].branch).toBe("寅");
    expect(result.evidence).toEqual(expect.arrayContaining([expect.objectContaining({
      ruleId: "three-transmissions/comparison-v1",
      conclusion: "唯一比用上神为寅",
    })]));
  });
});

describe("Fan Yin transmissions", () => {
  it("does not apply Repeated Equality when the first lesson upper is not Zi", () => {
    const input = makeRuleInput("戊辰", "午", "子");

    expect(input.fourLessons.lessons[0].upper).toBe("亥");
    expect(() => deriveThreeTransmissions(input.plate, input.fourLessons)).toThrow(
      ThreeTransmissionsRuleUnresolvedError,
    );
  });

  it("uses vertical selection and ordinary heaven lookup when Fan Yin has overcoming", () => {
    const [plate, lessons] = fanYinWithOvercoming();
    const result = deriveThreeTransmissions(plate, lessons);
    expect(result.method).toBe("反吟");
    expect(result.transmissions[1].branch).toBe(heavenAt(plate, result.transmissions[0].branch));
    expect(result.transmissions[2].branch).toBe(heavenAt(plate, result.transmissions[1].branch));
    expect(result.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "three-transmissions/vertical-relations-v1" }),
      expect.objectContaining({
        ruleId: "three-transmissions/fanyin-v1",
        phase: "middle",
        transmission: "middle",
      }),
    ]));
    expectMethodEvidenceBound(result, "three-transmissions/fanyin-v1");
  });

  it("does not label a lower-overcomes-upper comparison as Zhi Yi", () => {
    const lessons = makeSelectorInput({
      dayPillar: "丙辰",
      lessons: [
        ["first", "酉", { kind: "stem", value: "丙" }],
        ["second", "寅", { kind: "branch", value: "酉" }],
        ["third", "辰", { kind: "branch", value: "辰" }],
        ["fourth", "辰", { kind: "branch", value: "辰" }],
      ],
    });

    const result = deriveThreeTransmissions(makePlate("午", "子"), lessons);

    expect(result.method).toBe("反吟");
    expect(result).not.toHaveProperty("subtype");
    expect(result.transmissions[0].branch).toBe("寅");
    expect(result.evidence).toEqual(expect.arrayContaining([expect.objectContaining({
      ruleId: "three-transmissions/comparison-v1",
      conclusion: "唯一比用上神为寅",
    })]));
  });

  it.each(["丁丑", "丁未", "己丑", "己未", "辛丑", "辛未"] as const)(
    "uses Well-Railing for the no-overcoming Fan Yin day %s",
    (dayPillar) => {
      const [plate, lessons] = fanYinWithoutOvercoming(dayPillar);
      const result = deriveThreeTransmissions(plate, lessons);
      expect(result.subtype).toBe("井栏");
      expect(result.transmissions.map(({ branch }) => branch)).toEqual([
        postHorseOf(dayPillar[1] as EarthlyBranch),
        lessons.lessons[2].upper,
        lessons.lessons[0].upper,
      ]);
      expect(result.evidence).toEqual(expect.arrayContaining([
        expect.objectContaining({
          ruleId: "three-transmissions/fanyin-v1",
          phase: "initial",
          transmission: "initial",
        }),
        expect.objectContaining({
          ruleId: "three-transmissions/fanyin-v1",
          phase: "middle",
          transmission: "middle",
        }),
        expect.objectContaining({
          ruleId: "three-transmissions/fanyin-v1",
          phase: "final",
          transmission: "final",
        }),
      ]));
      expectMethodEvidenceBound(result, "three-transmissions/fanyin-v1");
    },
  );

  it("rejects a noncanonical no-overcoming Fan Yin day", () => {
    expect(() => deriveThreeTransmissions(...noncanonicalFanYinNoOvercoming())).toThrowError(
      ThreeTransmissionsRuleUnresolvedError,
    );
  });
});
