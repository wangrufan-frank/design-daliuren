import { describe, expect, it } from "vitest";
import { referenceSession } from "../../test/reference-session";
import { validateSession } from "../chart/snapshots";
import type { FourLessonsSnapshot } from "../four-lessons/types";
import { deriveHeavenEarth } from "../heaven-earth/policy";
import type { HeavenEarthSnapshot } from "../heaven-earth/types";
import { computeThreeTransmissions, runThreeTransmissionsStage } from "./compute-three-transmissions";
import { deriveThreeTransmissions } from "./policy";
import {
  isThreeTransmissionsResult,
  matchesThreeTransmissionsInputs,
  threeTransmissionsResultSource,
} from "./result-guard";
import { makeRuleInput } from "./test-helpers";
import type {
  SixRelation,
  ThreeTransmissionsEvidenceStep,
  ThreeTransmissionsResult,
  Transmission,
  TransmissionVariant,
} from "./types";

const validPlateSnapshot = referenceSession.snapshots["heaven-earth"] as HeavenEarthSnapshot;
const validFourLessonsSnapshot = referenceSession.snapshots["four-lessons"] as FourLessonsSnapshot;
const validPlate = validPlateSnapshot.value;
const validFourLessons = validFourLessonsSnapshot.value;
const validThreeTransmissions = deriveThreeTransmissions(validPlate, validFourLessons);
const forgedFourLessonsSnapshot = {
  ...structuredClone(validFourLessonsSnapshot),
  value: { ...structuredClone(validFourLessonsSnapshot.value), dayPillar: "甲子" as const },
};

type MutableTransmission = Omit<Transmission, "relation" | "evidenceIds"> & {
  relation: SixRelation;
  evidenceIds: string[];
};
type MutableThreeTransmissionsResult = Omit<ThreeTransmissionsResult, "variants" | "transmissions" | "evidence"> & {
  variants: TransmissionVariant[];
  transmissions: [MutableTransmission, MutableTransmission, MutableTransmission];
  evidence: ThreeTransmissionsEvidenceStep[];
};

describe("computeThreeTransmissions", () => {
  it("creates an automatic snapshot with both direct dependencies", () => {
    const outcome = computeThreeTransmissions(validPlateSnapshot, validFourLessonsSnapshot);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.snapshot).toEqual(expect.objectContaining({
      stage: "three-transmissions",
      dependsOn: ["heaven-earth", "four-lessons"],
      ruleId: "three-transmissions/nine-gates-v1",
      source: "automatic",
    }));
  });

  it("rejects missing, forged, or mutually inconsistent upstream snapshots", () => {
    expect(computeThreeTransmissions(undefined, validFourLessonsSnapshot)).toEqual(expect.objectContaining({ ok: false }));
    expect(computeThreeTransmissions(validPlateSnapshot, forgedFourLessonsSnapshot)).toEqual(expect.objectContaining({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_THREE_TRANSMISSIONS_INPUT" }),
    }));
  });

  it("propagates a manual source from either direct dependency", () => {
    expect(threeTransmissionsResultSource("manual", "automatic")).toBe("manual");
    expect(threeTransmissionsResultSource("automatic", "manual")).toBe("manual");
  });

  it.each([
    ["plate dependencies", (plate: HeavenEarthSnapshot, _fourLessons: FourLessonsSnapshot) => {
      plate.dependsOn = [];
    }],
    ["plate rule", (plate: HeavenEarthSnapshot, _fourLessons: FourLessonsSnapshot) => {
      plate.ruleId = "forged";
    }],
    ["four-lessons dependencies", (_plate: HeavenEarthSnapshot, fourLessons: FourLessonsSnapshot) => {
      fourLessons.dependsOn = ["heaven-earth"];
    }],
    ["four-lessons rule", (_plate: HeavenEarthSnapshot, fourLessons: FourLessonsSnapshot) => {
      fourLessons.ruleId = "forged";
    }],
  ] as const)("rejects invalid %s metadata", (_name, mutate) => {
    const plate = structuredClone(validPlateSnapshot);
    const fourLessons = structuredClone(validFourLessonsSnapshot);
    mutate(plate, fourLessons);
    expect(computeThreeTransmissions(plate, fourLessons)).toMatchObject({
      ok: false,
      error: { code: "INVALID_THREE_TRANSMISSIONS_INPUT" },
    });
  });
});

describe("matchesThreeTransmissionsInputs", () => {
  it.each([
    ["method", (value: MutableThreeTransmissionsResult) => {
      value.method = value.method === "昴星" ? "贼克" : "昴星";
    }],
    ["subtype", (value: MutableThreeTransmissionsResult) => {
      value.subtype = value.subtype === "知一" ? "元首" : "知一";
    }],
    ["variant", (value: MutableThreeTransmissionsResult) => {
      value.variants = value.variants.includes("复等") ? [] : ["复等"];
    }],
    ["order", (value: MutableThreeTransmissionsResult) => {
      value.transmissions = [value.transmissions[1], value.transmissions[0], value.transmissions[2]];
    }],
    ["relation", (value: MutableThreeTransmissionsResult) => {
      value.transmissions[0].relation = value.transmissions[0].relation === "兄弟" ? "父母" : "兄弟";
    }],
    ["evidence", (value: MutableThreeTransmissionsResult) => {
      value.evidence = value.evidence.slice(1);
    }],
  ] as const)("rejects a forged %s", (_name, mutate) => {
    const value = structuredClone(validThreeTransmissions) as MutableThreeTransmissionsResult;
    mutate(value);
    expect(matchesThreeTransmissionsInputs(value, validPlate, validFourLessons)).toBe(false);
  });

  it("rejects a forged evidence rule ID before canonical recomputation", () => {
    const value = structuredClone(validThreeTransmissions) as MutableThreeTransmissionsResult;
    value.evidence[0].ruleId = "three-transmissions/forged-v1" as never;

    expect(isThreeTransmissionsResult(value)).toBe(false);
  });

  it.each([
    ["lesson identity", makeRuleInput("甲子", "丑", "子"), "lesson-identity", "canonicalIdentity"],
    ["lesson relation", makeRuleInput("甲子", "丑", "子"), "lesson-relation", "lowerElement"],
    ["She Hai palace", makeRuleInput("庚子", "申", "戌"), "shehai-palace", "branchContributes"],
    ["six relation", makeRuleInput("甲子", "丑", "子"), "six-relation", "direction"],
  ] as const)("rejects malformed nested %s evidence", (_name, input, kind, field) => {
    const value = structuredClone(deriveThreeTransmissions(input.plate, input.fourLessons));
    const detail = value.evidence
      .flatMap(({ details = [] }) => details)
      .find((candidate) => candidate.kind === kind) as unknown as Record<string, unknown>;
    delete detail[field];

    expect(isThreeTransmissionsResult(value)).toBe(false);
  });

  it("rejects a lesson relation whose overcoming result is present but wrong", () => {
    const value = structuredClone(validThreeTransmissions) as MutableThreeTransmissionsResult;
    const detail = value.evidence
      .flatMap(({ details = [] }) => details)
      .find(({ kind }) => kind === "lesson-relation");
    if (!detail || detail.kind !== "lesson-relation") throw new Error("missing lesson relation fixture");
    detail.lowerOvercomesUpper = !detail.lowerOvercomesUpper;

    expect(isThreeTransmissionsResult(value)).toBe(false);
  });

  it("rejects a She Hai path whose cumulative total is present but wrong", () => {
    const input = makeRuleInput("庚子", "申", "戌");
    const value = structuredClone(deriveThreeTransmissions(input.plate, input.fourLessons));
    const detail = value.evidence
      .flatMap(({ details = [] }) => details)
      .find(({ kind }) => kind === "shehai-palace");
    if (!detail || detail.kind !== "shehai-palace") throw new Error("missing She Hai fixture");
    detail.total = 999;

    expect(isThreeTransmissionsResult(value)).toBe(false);
  });

  it("rejects a known rule ID used in the wrong evidence phase", () => {
    const value = structuredClone(validThreeTransmissions) as MutableThreeTransmissionsResult;
    value.evidence[0].ruleId = "three-transmissions/mao-star-v1";

    expect(value.evidence[0].phase).toBe("plate");
    expect(isThreeTransmissionsResult(value)).toBe(false);
  });
});

describe("runThreeTransmissionsStage", () => {
  it("replaces the stage and removes every direct and transitive descendant", () => {
    const outcome = runThreeTransmissionsStage(referenceSession);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(Object.keys(outcome.session.snapshots)).toEqual([
      "calendar",
      "heaven-earth",
      "four-lessons",
      "three-transmissions",
    ]);
    expect(outcome.session.snapshots["heavenly-generals"]).toBeUndefined();
    expect(outcome.session.snapshots.course).toBeUndefined();
    expect(validateSession(outcome.session)).toEqual([]);
  });

  it("keeps only the valid calendar and plate when four lessons are invalid", () => {
    const sessionWithInvalidFourLessons = structuredClone(referenceSession);
    sessionWithInvalidFourLessons.snapshots["four-lessons"] = forgedFourLessonsSnapshot;
    const outcome = runThreeTransmissionsStage(sessionWithInvalidFourLessons);
    expect(outcome.ok).toBe(false);
    expect(Object.keys(outcome.session.snapshots)).toEqual(["calendar", "heaven-earth"]);
    expect(outcome.session.snapshots["three-transmissions"]).toBeUndefined();
    expect(validateSession(outcome.session)).toEqual([]);
  });

  it("removes every transitive dependent when calendar is missing", () => {
    const missingCalendar = structuredClone(referenceSession);
    delete missingCalendar.snapshots.calendar;

    const outcome = runThreeTransmissionsStage(missingCalendar);

    expect(outcome).toMatchObject({ ok: false, error: { code: "INVALID_THREE_TRANSMISSIONS_INPUT" } });
    expect(Object.keys(outcome.session.snapshots)).toEqual([]);
    expect(validateSession(outcome.session)).toEqual([]);
  });

  it("removes every transitive dependent when the current calendar is forged", () => {
    const forgedCalendar = structuredClone(referenceSession);
    forgedCalendar.snapshots.calendar!.ruleId = "calendar/forged-v1";

    const outcome = runThreeTransmissionsStage(forgedCalendar);

    expect(outcome).toMatchObject({ ok: false, error: { code: "INVALID_THREE_TRANSMISSIONS_INPUT" } });
    expect(Object.keys(outcome.session.snapshots)).toEqual([]);
    expect(validateSession(outcome.session)).toEqual([]);
  });

  it("keeps only calendar when the plate belongs to different calendar inputs", () => {
    const mismatchedPlate = structuredClone(referenceSession);
    const otherCalendar = structuredClone(referenceSession.snapshots.calendar!.value);
    otherCalendar.monthGeneral.effective = { name: "登明", branch: "亥" };
    otherCalendar.monthGeneral.source = "manual";
    otherCalendar.divinationHour.effective = "丑";
    otherCalendar.divinationHour.source = "manual";
    mismatchedPlate.snapshots["heaven-earth"] = {
      ...structuredClone(validPlateSnapshot),
      source: "manual",
      value: deriveHeavenEarth(otherCalendar),
    };

    const outcome = runThreeTransmissionsStage(mismatchedPlate);

    expect(outcome).toMatchObject({ ok: false, error: { code: "INVALID_THREE_TRANSMISSIONS_INPUT" } });
    expect(Object.keys(outcome.session.snapshots)).toEqual(["calendar"]);
    expect(outcome.session.snapshots["three-transmissions"]).toBeUndefined();
    expect(validateSession(outcome.session)).toEqual([]);
  });
});
