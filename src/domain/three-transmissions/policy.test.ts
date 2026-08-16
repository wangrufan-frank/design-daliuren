import { describe, expect, it } from "vitest";
import { STEM_RESIDENCES } from "../four-lessons/policy";
import { earthUnder, heavenAt } from "./foundations";
import { deriveThreeTransmissions, ThreeTransmissionsRuleUnresolvedError } from "./policy";
import { findVerticalCandidates } from "./selectors";
import {
  makePlate,
  makeRuleInput,
  makeSelectorInput,
  threeUniqueLessons as makeThreeUniqueInput,
} from "./test-helpers";
import {
  deriveEightSpecial,
  deriveMaoStar,
  deriveSeparateResponsibility,
  isFanYin,
  isFuYin,
} from "./special-methods";

function expectMiddleFinalDerivations(
  result: ReturnType<typeof deriveThreeTransmissions>,
  expected: readonly [
    { input: string; conclusion: string },
    { input: string; conclusion: string },
  ],
) {
  expect(result.transmissions.slice(1).map(({ derivation }) => derivation)).toEqual(
    expected.map(({ conclusion }) => conclusion),
  );
  expect(["middle", "final"].map((position) => {
    const step = result.evidence.find(({ phase, transmission }) => (
      phase === position && transmission === position
    ));
    return step && { input: step.input, conclusion: step.conclusion };
  })).toEqual(expected);
}

function completeLessons(uppers: { first: "亥"; third: "卯" }) {
  return makeSelectorInput({
    dayPillar: "戊酉",
    lessons: [
      ["first", uppers.first, { kind: "stem", value: "戊" }],
      ["second", "巳", { kind: "branch", value: uppers.first }],
      ["third", uppers.third, { kind: "branch", value: "酉" }],
      ["fourth", "酉", { kind: "branch", value: uppers.third }],
    ],
  });
}

function threeUniqueLessons() {
  return makeThreeUniqueInput().fourLessons;
}

function eightSpecialLessons(uppers: { first: "亥"; fourth: "申" }) {
  return makeSelectorInput({
    dayPillar: "庚申",
    lessons: [
      ["first", uppers.first, { kind: "stem", value: "庚" }],
      ["second", uppers.fourth, { kind: "branch", value: uppers.first }],
      ["third", uppers.first, { kind: "branch", value: "申" }],
      ["fourth", uppers.fourth, { kind: "branch", value: uppers.first }],
    ],
  });
}

describe("deriveThreeTransmissions", () => {
  it.each([
    {
      name: "始入",
      input: makeRuleInput("戊戌", "子", "戌"),
      method: "贼克",
      subtype: "始入",
      branches: ["子", "寅", "辰"],
    },
    {
      name: "元首",
      input: makeRuleInput("戊申", "卯", "辰"),
      method: "贼克",
      subtype: "元首",
      branches: ["卯", "寅", "丑"],
    },
    {
      name: "涉害克数胜出",
      input: makeRuleInput("庚子", "申", "戌"),
      method: "涉害",
      subtype: undefined,
      branches: ["午", "辰", "寅"],
    },
  ] as const)("derives the Lin Feng $name case", ({ input, method, subtype, branches }) => {
    const result = deriveThreeTransmissions(input.plate, input.fourLessons);
    expect(result.method).toBe(method);
    if (subtype) expect(result.subtype).toBe(subtype);
    expect(result.transmissions.map(({ branch }) => branch)).toEqual(branches);
  });

  it("records why the sole vertical candidate is selected for use", () => {
    const input = makeRuleInput("戊戌", "子", "戌");
    const result = deriveThreeTransmissions(input.plate, input.fourLessons);

    expect(result.evidence).toEqual(expect.arrayContaining([expect.objectContaining({
      ruleId: "three-transmissions/thief-overcoming-v1",
      phase: "selection",
      input: "上下克候选仅三课上神子",
      conclusion: "唯一上下克候选为三课上神子，取子发用",
    })]));
  });

  it("derives Chong Shen when lower-overcomes-upper wins over existing upper-overcomes-lower lessons", () => {
    const input = makeRuleInput("甲子", "丑", "子");

    const result = deriveThreeTransmissions(input.plate, input.fourLessons);

    expect(result.method).toBe("贼克");
    expect(result.subtype).toBe("重审");
    expect(result.transmissions.map(({ branch }) => branch)).toEqual(["辰", "巳", "午"]);
    expect(result.evidence).toEqual(expect.arrayContaining([expect.objectContaining({
      ruleId: "three-transmissions/vertical-relations-v1",
      conclusion: "下克上候选：二课上神辰；上克下候选：三课上神丑、四课上神寅；按下克上优先",
    })]));
  });

  it("uses comparison without Zhi Yi when a later lower-overcomes-upper candidate matches", () => {
    const fourLessons = makeSelectorInput({
      dayPillar: "丙辰",
      lessons: [
        ["first", "酉", { kind: "stem", value: "丙" }],
        ["second", "寅", { kind: "branch", value: "酉" }],
        ["third", "辰", { kind: "branch", value: "辰" }],
        ["fourth", "辰", { kind: "branch", value: "辰" }],
      ],
    });

    const result = deriveThreeTransmissions(makePlate("巳", "子"), fourLessons);

    expect(result.method).toBe("比用");
    expect(result).not.toHaveProperty("subtype");
    expect(result.transmissions[0].branch).toBe("寅");
    expect(result.evidence).toEqual(expect.arrayContaining([expect.objectContaining({
      ruleId: "three-transmissions/comparison-v1",
      input: "日干丙为yang，候选上神酉、寅",
      conclusion: "唯一比用上神为寅",
    })]));
  });

  it("routes two co-resident lessons to Eight Special before remote overcoming", () => {
    const fourLessons = makeSelectorInput({
      dayPillar: "庚申",
      lessons: [
        ["first", "丑", { kind: "stem", value: "庚" }],
        ["second", "午", { kind: "branch", value: "丑" }],
        ["third", "丑", { kind: "branch", value: "申" }],
        ["fourth", "午", { kind: "branch", value: "丑" }],
      ],
    });

    const plate = makePlate("巳", "子");
    expect(isFuYin(plate)).toBe(false);
    expect(isFanYin(plate)).toBe(false);
    const result = deriveThreeTransmissions(plate, fourLessons);

    expect(result.method).toBe("八专");
    expect(result.transmissions.map(({ branch }) => branch)).toEqual(["卯", "丑", "丑"]);
    expectMiddleFinalDerivations(result, [
      { input: "八专固定取一课日上神丑", conclusion: "八专中传固定取一课日上神丑" },
      { input: "八专固定取一课日上神丑", conclusion: "八专末传固定取一课日上神丑" },
    ]);
  });

  it("derives the Lin Feng Eight Special book case through full policy", () => {
    const input = makeRuleInput("甲寅", "丑", "辰");

    expect(isFuYin(input.plate)).toBe(false);
    expect(isFanYin(input.plate)).toBe(false);
    expect(findVerticalCandidates(input.fourLessons).candidates).toEqual([]);

    const result = deriveThreeTransmissions(input.plate, input.fourLessons);

    expect(result.method).toBe("八专");
    expect(result.transmissions.map(({ branch }) => branch)).toEqual(["丑", "亥", "亥"]);
    expect(result.evidence.find(({ ruleId }) => ruleId === "three-transmissions/vertical-relations-v1"))
      .toEqual(expect.objectContaining({ conclusion: "四课上下无贼克" }));
    expect(result.evidence.some(({ ruleId }) => ruleId === "three-transmissions/remote-overcoming-v1")).toBe(false);
    expect(result.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "three-transmissions/eight-special-v1" }),
    ]));
  });

  it("uses selected remote overcoming before lesson-count methods", () => {
    const fourLessons = makeSelectorInput({
      dayPillar: "甲午",
      lessons: [
        ["first", "卯", { kind: "stem", value: "甲" }],
        ["second", "巳", { kind: "branch", value: "卯" }],
        ["third", "丑", { kind: "branch", value: "午" }],
        ["fourth", "酉", { kind: "branch", value: "丑" }],
      ],
    });

    const plate = makePlate("巳", "子");
    expect(isFuYin(plate)).toBe(false);
    expect(isFanYin(plate)).toBe(false);
    const result = deriveThreeTransmissions(plate, fourLessons);

    expect(result.method).toBe("遥克");
    expect(result.subtype).toBe("蒿矢");
    expect(result.transmissions.map(({ branch }) => branch)).toEqual(["酉", "寅", "未"]);
    expect(result.evidence).toEqual(expect.arrayContaining([expect.objectContaining({
      ruleId: "three-transmissions/remote-overcoming-v1",
      phase: "selection",
      input: "遥克候选仅四课上神酉",
      conclusion: "唯一遥克候选为四课上神酉，取酉发用",
    })]));
  });

  it("throws structured evidence when remote overcoming remains unresolved", () => {
    const fourLessons = makeSelectorInput({
      dayPillar: "壬午",
      lessons: [
        ["first", "寅", { kind: "stem", value: "壬" }],
        ["second", "午", { kind: "branch", value: "寅" }],
        ["third", "辰", { kind: "branch", value: "午" }],
        ["fourth", "戌", { kind: "branch", value: "辰" }],
      ],
    });

    const plate = makePlate("巳", "子");
    expect(isFuYin(plate)).toBe(false);
    expect(isFanYin(plate)).toBe(false);
    expect(() => deriveThreeTransmissions(plate, fourLessons)).toThrow(
      ThreeTransmissionsRuleUnresolvedError,
    );
    try {
      deriveThreeTransmissions(plate, fourLessons);
    } catch (error) {
      expect(error).toBeInstanceOf(ThreeTransmissionsRuleUnresolvedError);
      expect((error as ThreeTransmissionsRuleUnresolvedError).evidence).toEqual(expect.arrayContaining([
        expect.objectContaining({ ruleId: "three-transmissions/remote-overcoming-v1" }),
        expect.objectContaining({ ruleId: "three-transmissions/comparison-v1" }),
      ]));
    }
  });

  it.each([
    {
      name: "four unique lessons to Mao Star",
      fourLessons: makeSelectorInput({
        dayPillar: "甲子",
        lessons: [
          ["first", "卯", { kind: "stem", value: "甲" }],
          ["second", "巳", { kind: "branch", value: "卯" }],
          ["third", "亥", { kind: "branch", value: "子" }],
          ["fourth", "寅", { kind: "branch", value: "亥" }],
        ],
      }),
      method: "昴星",
      branches: ["寅", "亥", "卯"],
      derivations: [
        { input: "阳日虎视取三课上神亥", conclusion: "阳日虎视取三课上神亥为中传" },
        { input: "阳日虎视取一课日上神卯", conclusion: "阳日虎视取一课日上神卯为末传" },
      ],
    },
    {
      name: "three unique lessons to Separate Responsibility",
      fourLessons: makeSelectorInput({
        dayPillar: "甲子",
        lessons: [
          ["first", "卯", { kind: "stem", value: "甲" }],
          ["second", "巳", { kind: "branch", value: "卯" }],
          ["third", "卯", { kind: "branch", value: "子" }],
          ["fourth", "巳", { kind: "branch", value: "卯" }],
        ],
      }),
      method: "别责",
      branches: ["子", "卯", "卯"],
      derivations: [
        { input: "别责固定取一课日上神卯", conclusion: "别责中传固定取一课日上神卯" },
        { input: "别责固定取一课日上神卯", conclusion: "别责末传固定取一课日上神卯" },
      ],
    },
  ] as const)("routes $name", ({ fourLessons, method, branches, derivations }) => {
    const plate = makePlate("巳", "子");
    expect(isFuYin(plate)).toBe(false);
    expect(isFanYin(plate)).toBe(false);
    const result = deriveThreeTransmissions(plate, fourLessons);

    expect(result.method).toBe(method);
    expect(result.transmissions.map(({ branch }) => branch)).toEqual(branches);
    expectMiddleFinalDerivations(result, derivations);
  });

  it("records ordinary middle and final transmissions as heaven-at lookups", () => {
    const input = makeRuleInput("戊戌", "子", "戌");
    const result = deriveThreeTransmissions(input.plate, input.fourLessons);

    expectMiddleFinalDerivations(result, [
      { input: "初传子落地盘子宫", conclusion: "从地盘子宫查得天盘上神寅，取为中传" },
      { input: "中传寅落地盘寅宫", conclusion: "从地盘寅宫查得天盘上神辰，取为末传" },
    ]);
  });

  it("attaches transmission labels, six relations, and complete evidence", () => {
    const input = makeRuleInput("甲子", "丑", "子");
    const result = deriveThreeTransmissions(input.plate, input.fourLessons);
    const repeated = deriveThreeTransmissions(input.plate, input.fourLessons);
    const details = result.evidence.flatMap(({ details = [] }) => details) as unknown as Array<Record<string, unknown>>;
    expect(result.transmissions.map(({ position, label }) => [position, label])).toEqual([
      ["initial", "初传"], ["middle", "中传"], ["final", "末传"],
    ]);
    expect(result.transmissions.every(({ relation }) => ["父母", "子孙", "官鬼", "妻财", "兄弟"].includes(relation))).toBe(true);
    expect(new Set(result.evidence.map(({ phase }) => phase))).toEqual(new Set([
      "plate", "lessons", "candidates", "selection", "initial", "middle", "final", "relation",
    ]));
    expect(details.filter(({ kind }) => kind === "lesson-identity")).toHaveLength(4);
    expect(details.filter(({ kind }) => kind === "lesson-relation")).toEqual([
      expect.objectContaining({
        lesson: "first", lowerKind: "stem", lowerValue: "甲", lowerElement: "木",
        upper: "卯", upperElement: "木", lowerOvercomesUpper: false,
        upperOvercomesLower: false, conclusion: "not-a-candidate",
      }),
      expect.objectContaining({
        lesson: "second", lowerKind: "branch", lowerValue: "卯", lowerElement: "木",
        upper: "辰", upperElement: "土", lowerOvercomesUpper: true,
        upperOvercomesLower: false, conclusion: "selected-lower-overcomes-upper",
      }),
      expect.objectContaining({
        lesson: "third", lowerKind: "branch", lowerValue: "子", lowerElement: "水",
        upper: "丑", upperElement: "土", lowerOvercomesUpper: false,
        upperOvercomesLower: true, conclusion: "excluded-by-lower-overcomes-upper-priority",
      }),
      expect.objectContaining({
        lesson: "fourth", lowerKind: "branch", lowerValue: "丑", lowerElement: "土",
        upper: "寅", upperElement: "木", lowerOvercomesUpper: false,
        upperOvercomesLower: true, conclusion: "excluded-by-lower-overcomes-upper-priority",
      }),
    ]);
    expect(result.evidence.filter(({ phase }) => phase === "relation")).toHaveLength(3);
    expect(details.filter(({ kind }) => kind === "six-relation")).toEqual([
      expect.objectContaining({
        dayStem: "甲", dayElement: "木", transmissionBranch: "辰", transmissionElement: "土",
        direction: "day-overcomes-transmission", relation: "妻财",
      }),
      expect.objectContaining({
        dayStem: "甲", dayElement: "木", transmissionBranch: "巳", transmissionElement: "火",
        direction: "day-generates-transmission", relation: "子孙",
      }),
      expect.objectContaining({
        dayStem: "甲", dayElement: "木", transmissionBranch: "午", transmissionElement: "火",
        direction: "day-generates-transmission", relation: "子孙",
      }),
    ]);

    const evidenceIds = result.evidence.map(({ id }) => id);
    expect(new Set(evidenceIds).size).toBe(evidenceIds.length);
    expect(result.transmissions.every(({ evidenceIds: references }) => (
      references.length > 0 && references.every((id) => evidenceIds.includes(id))
    ))).toBe(true);
    expect(result.evidence.findIndex(({ ruleId }) => ruleId === "three-transmissions/lesson-deduplication-v1"))
      .toBeLessThan(result.evidence.findIndex(({ ruleId }) => ruleId === "three-transmissions/vertical-relations-v1"));
    expect(JSON.stringify(result.evidence)).toBe(JSON.stringify(repeated.evidence));
  });
});

describe("special ordinary methods", () => {
  it("derives both yin and yang Mao Star order", () => {
    const plate = makePlate("午", "子");
    const lessons = completeLessons({ first: "亥", third: "卯" });
    const yang = deriveMaoStar("甲", lessons, plate);
    expect(yang.subtype).toBe("虎视");
    expect(yang.branches).toEqual([heavenAt(plate, "酉"), lessons.lessons[2].upper, lessons.lessons[0].upper]);

    const yin = deriveMaoStar("乙", lessons, plate);
    expect(yin.subtype).toBe("冬蛇掩目");
    expect(yin.branches).toEqual([earthUnder(plate, "酉"), lessons.lessons[0].upper, lessons.lessons[2].upper]);
  });

  it("uses the combined stem residence for yang Separate Responsibility", () => {
    const plate = makePlate("午", "子");
    const lessons = threeUniqueLessons();
    const result = deriveSeparateResponsibility("甲", "辰", lessons, plate);
    expect(result.branches).toEqual([heavenAt(plate, STEM_RESIDENCES.己), lessons.lessons[0].upper, lessons.lessons[0].upper]);
  });

  it("uses the next trine branch for yin Separate Responsibility", () => {
    const plate = makePlate("午", "子");
    const lessons = threeUniqueLessons();
    const result = deriveSeparateResponsibility("乙", "酉", lessons, plate);
    expect(result.branches).toEqual(["丑", lessons.lessons[0].upper, lessons.lessons[0].upper]);
  });

  it("counts the starting god as one in Eight Special", () => {
    expect(deriveEightSpecial("甲", eightSpecialLessons({ first: "亥", fourth: "申" })).branches).toEqual(["丑", "亥", "亥"]);
    expect(deriveEightSpecial("乙", eightSpecialLessons({ first: "亥", fourth: "申" })).branches).toEqual(["午", "亥", "亥"]);
  });
});
