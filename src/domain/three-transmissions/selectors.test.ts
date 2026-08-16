import { describe, expect, it } from "vitest";
import {
  candidate,
  candidateOver,
  equalDepthPlate,
  makePlate,
  makeRemoteLessons,
  makeRuleInput,
  makeSelectorInput,
} from "./test-helpers";
import { findRemoteCandidates, findVerticalCandidates, selectByComparison, selectBySheHai } from "./selectors";

describe("findVerticalCandidates", () => {
  it("prefers lower-overcomes-upper and ignores upper-overcomes-lower", () => {
    const input = makeSelectorInput({
      dayPillar: "戊戌",
      lessons: [
        ["first", "未", { kind: "stem", value: "戊" }],
        ["second", "酉", { kind: "branch", value: "未" }],
        ["third", "子", { kind: "branch", value: "戌" }],
        ["fourth", "寅", { kind: "branch", value: "子" }],
      ],
    });

    const result = findVerticalCandidates(input);

    expect(result.preferredDirection).toBe("lower-overcomes-upper");
    expect(result.candidates.map(({ lesson }) => lesson.id)).toEqual(["third"]);
  });

  it("uses the actual day stem for the first lesson even when fixture lower data disagrees", () => {
    const input = makeSelectorInput({
      dayPillar: "戊戌",
      lessons: [
        ["first", "子", { kind: "stem", value: "甲" }],
        ["second", "丑", { kind: "branch", value: "丑" }],
        ["third", "寅", { kind: "branch", value: "寅" }],
        ["fourth", "卯", { kind: "branch", value: "卯" }],
      ],
    });

    expect(findVerticalCandidates(input).candidates.map(({ lesson }) => lesson.id)).toEqual(["first"]);
  });
});

describe("selectByComparison", () => {
  it("keeps the only candidate whose polarity matches the day stem", () => {
    const selected = selectByComparison([
      candidate("second", "子"),
      candidate("third", "未"),
      candidate("fourth", "酉"),
    ], "丙");

    expect(selected.kind).toBe("selected");
    if (selected.kind === "selected") expect(selected.candidate.upper).toBe("子");
  });

  it("preserves every candidate when all polarities match", () => {
    const candidates = [candidate("second", "子"), candidate("third", "午")];

    expect(selectByComparison(candidates, "丙")).toEqual(expect.objectContaining({
      kind: "tied",
      candidates,
    }));
  });

  it("preserves every candidate when no polarity matches", () => {
    const candidates = [candidate("second", "丑"), candidate("third", "未")];

    expect(selectByComparison(candidates, "丙")).toEqual(expect.objectContaining({
      kind: "tied",
      candidates,
    }));
  });
});

describe("selectBySheHai", () => {
  it("counts branches and resident stems while returning each traversed palace", () => {
    const plate = makePlate("申", "戌");

    const result = selectBySheHai([
      candidate("first", "午"),
      candidate("third", "戌"),
    ], "庚", plate);

    expect(result.kind).toBe("selected");
    if (result.kind !== "selected") return;
    expect(result.candidate.upper).toBe("午");
    expect(result.counts).toEqual(expect.objectContaining({ 午: 4, 戌: 2 }));
    expect(result.paths.午).toHaveLength(11);
    expect(result.paths.午?.flatMap(({ residentStems }) => residentStems)).toEqual(expect.arrayContaining(["庚", "辛"]));
    expect(result.paths.午?.at(-1)).toEqual(expect.objectContaining({ earth: "午", total: 4 }));
  });

  it("resolves a real equal depth through the sole Meng palace", () => {
    const result = selectBySheHai([
      candidateOver("second", "寅", "子"),
      candidateOver("third", "卯", "亥"),
    ], "庚", equalDepthPlate());

    expect(result.counts).toEqual(expect.objectContaining({ 寅: 1, 卯: 1 }));
    expect(result).toEqual(expect.objectContaining({
      kind: "selected",
      subtype: "见机",
      candidate: expect.objectContaining({ upper: "寅" }),
    }));
  });

  it("resolves a real equal depth through the sole Zhong palace when there is no Meng", () => {
    const result = selectBySheHai([
      candidateOver("second", "寅", "丑"),
      candidateOver("third", "卯", "子"),
    ], "庚", makePlate("寅", "子"));

    expect(result.counts).toEqual(expect.objectContaining({ 寅: 1, 卯: 1 }));
    expect(result).toEqual(expect.objectContaining({
      kind: "selected",
      subtype: "察微",
      candidate: expect.objectContaining({ upper: "寅" }),
    }));
  });

  it("returns the 戊辰 day-upper 子 exact tie as 缀瑕复等", () => {
    const { plate, fourLessons } = makeRuleInput("戊辰", "未", "子");
    const vertical = findVerticalCandidates(fourLessons);
    const comparison = selectByComparison(vertical.candidates, "戊");
    expect(comparison.kind).toBe("tied");
    if (comparison.kind !== "tied") return;

    const result = selectBySheHai(comparison.candidates, "戊", plate);

    expect(result.counts).toEqual(expect.objectContaining({ 子: 4, 午: 4 }));
    expect(result).toEqual(expect.objectContaining({
      kind: "selected",
      subtype: "缀瑕",
      variant: "复等",
      candidate: expect.objectContaining({ lesson: expect.objectContaining({ id: "first" }), upper: "子" }),
    }));
  });

  it("does not invent a winner for a noncanonical complete tie", () => {
    const result = selectBySheHai([
      { ...candidate("second", "子"), direction: "lower-overcomes-upper" },
      { ...candidate("fourth", "午"), direction: "lower-overcomes-upper" },
    ], "戊", makePlate("未", "子"));

    expect(result.counts).toEqual(expect.objectContaining({ 子: 4, 午: 4 }));
    expect(result.kind).toBe("unresolved");
  });
});

describe("findRemoteCandidates", () => {
  it("checks only unique upper gods from lessons two through four", () => {
    const lessons = makeRemoteLessons({ first: "辰", second: "戌", third: "戌", fourth: "午" });
    const result = findRemoteCandidates(lessons, "壬");

    expect(result.scans.godOvercomesDay.map(({ upper }) => upper)).toEqual(["戌"]);
    expect(result).toEqual(expect.objectContaining({
      kind: "selected",
      subtype: "蒿矢",
      candidates: [expect.objectContaining({ upper: "戌" })],
    }));
  });

  it("uses day-overcomes-god only when no god overcomes the day", () => {
    const lessons = makeRemoteLessons({ first: "子", second: "寅", third: "卯", fourth: "子" });
    const result = findRemoteCandidates(lessons, "庚");

    expect(result.scans.godOvercomesDay).toEqual([]);
    expect(result.scans.dayOvercomesGod.map(({ upper }) => upper)).toEqual(["寅", "卯"]);
    expect(result.subtype).toBe("弹射");
    expect(result).toEqual(expect.objectContaining({
      kind: "selected",
      candidate: expect.objectContaining({ upper: "寅" }),
    }));
    expect(result.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "three-transmissions/comparison-v1" }),
    ]));
  });

  it("uses comparison instead of the first entry for multiple 弹射 candidates", () => {
    const lessons = makeRemoteLessons({ first: "子", second: "卯", third: "寅", fourth: "子" });
    const result = findRemoteCandidates(lessons, "庚");

    expect(result).toEqual(expect.objectContaining({
      kind: "selected",
      subtype: "弹射",
      candidate: expect.objectContaining({ upper: "寅" }),
    }));
    expect(result.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ ruleId: "three-transmissions/comparison-v1" }),
    ]));
  });

  it("returns unresolved when remote comparison remains tied", () => {
    const lessons = makeRemoteLessons({ first: "寅", second: "辰", third: "戌", fourth: "子" });

    expect(findRemoteCandidates(lessons, "壬")).toEqual(expect.objectContaining({
      kind: "unresolved",
      subtype: "蒿矢",
      candidates: [
        expect.objectContaining({ upper: "辰" }),
        expect.objectContaining({ upper: "戌" }),
      ],
    }));
  });
});
