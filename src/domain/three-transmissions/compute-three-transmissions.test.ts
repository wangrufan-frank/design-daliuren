import { describe, expect, it } from "vitest";
import { referenceSession } from "../../test/reference-session";
import type { FourLessonsSnapshot } from "../four-lessons/types";
import type { HeavenEarthSnapshot } from "../heaven-earth/types";
import { computeThreeTransmissions, runThreeTransmissionsStage } from "./compute-three-transmissions";
import { deriveThreeTransmissions } from "./policy";
import {
  matchesThreeTransmissionsInputs,
  threeTransmissionsResultSource,
} from "./result-guard";
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
  });

  it("keeps upstream and removes the failed stage plus all downstream snapshots", () => {
    const sessionWithInvalidFourLessons = structuredClone(referenceSession);
    sessionWithInvalidFourLessons.snapshots["four-lessons"] = forgedFourLessonsSnapshot;
    const outcome = runThreeTransmissionsStage(sessionWithInvalidFourLessons);
    expect(outcome.ok).toBe(false);
    expect(Object.keys(outcome.session.snapshots)).toEqual(["calendar", "heaven-earth", "four-lessons"]);
  });
});
