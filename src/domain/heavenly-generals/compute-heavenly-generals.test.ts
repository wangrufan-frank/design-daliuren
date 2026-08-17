import { describe, expect, it, vi } from "vitest";
import { referenceSession } from "../../test/reference-session";
import type { CalendarSnapshot } from "../calendar/types";
import type { CourseSession } from "../chart/types";
import type { FourLessonsSnapshot } from "../four-lessons/types";
import type { HeavenEarthSnapshot } from "../heaven-earth/types";
import * as policy from "./policy";
import * as resultGuard from "./result-guard";
import {
  computeHeavenlyGenerals,
  runHeavenlyGeneralsStage,
} from "./compute-heavenly-generals";
import type {
  GeneralPlacement,
  HeavenlyGeneral,
  HeavenlyGeneralsEvidenceStep,
  HeavenlyGeneralsResult,
} from "./types";

const calendar = referenceSession.snapshots.calendar as CalendarSnapshot;
const plate = referenceSession.snapshots["heaven-earth"] as HeavenEarthSnapshot;
const fourLessons = referenceSession.snapshots["four-lessons"] as FourLessonsSnapshot;
const transmissions = referenceSession.snapshots["three-transmissions"] as never;
const validValue = policy.deriveHeavenlyGenerals("辛", "子", plate.value);

type MutableResult = Omit<HeavenlyGeneralsResult, "placements" | "evidence"> & {
  placements: GeneralPlacement[];
  evidence: HeavenlyGeneralsEvidenceStep[];
};

describe("isHeavenlyGeneralsResult", () => {
  it.each([
    ["direction", (value: MutableResult) => { value.direction = value.direction === "forward" ? "reverse" : "forward"; }],
    ["noble palace", (value: MutableResult) => { value.nobleEarth = "午"; }],
    ["general order", (value: MutableResult) => {
      (value.placements[1] as { general: HeavenlyGeneral }).general = "朱雀";
    }],
    ["placement evidence", (value: MutableResult) => {
      const step = value.evidence.find((item) => item.phase === "placement");
      if (step?.phase === "placement") step.details.earth = "戌";
    }],
  ] as const)("rejects present-but-wrong %s", (_name, mutate) => {
    const forged = structuredClone(validValue) as MutableResult;
    mutate(forged);
    expect(resultGuard.isHeavenlyGeneralsResult(forged)).toBe(false);
  });

  it.each([
    ["duplicate evidence IDs", (value: MutableResult) => { value.evidence[1].id = value.evidence[0].id; }],
    ["dangling placement evidence", (value: MutableResult) => { value.placements[0].evidenceId = "missing"; }],
    ["eleven placements", (value: MutableResult) => { value.placements = value.placements.slice(0, 11); }],
    ["thirteen placements", (value: MutableResult) => { value.placements = [...value.placements, { ...value.placements[0], order: 12 }]; }],
    ["duplicate earth", (value: MutableResult) => { value.placements[1].earth = value.placements[0].earth; }],
    ["duplicate heaven", (value: MutableResult) => { value.placements[1].heaven = value.placements[0].heaven; }],
    ["a legal rule ID in the wrong phase", (value: MutableResult) => {
      value.evidence[0] = { ...value.evidence[0], phase: "noble-branch", ruleId: "heavenly-generals/noble-branch-v1" } as HeavenlyGeneralsEvidenceStep;
    }],
  ] as const)("rejects %s", (_name, mutate) => {
    const forged = structuredClone(validValue) as MutableResult;
    mutate(forged);
    expect(resultGuard.isHeavenlyGeneralsResult(forged)).toBe(false);
  });

  it("rejects a structurally valid result for different plate inputs", () => {
    const shiftedPlate = {
      ...structuredClone(plate.value),
      offset: (plate.value.offset + 1) % 12,
      palaces: plate.value.palaces.map((palace, index) => ({
        ...palace,
        heaven: plate.value.palaces[(index + 1) % 12].heaven,
      })),
    };
    const noncanonical = policy.deriveHeavenlyGenerals("辛", "子", shiftedPlate);

    expect(resultGuard.isHeavenlyGeneralsResult(noncanonical)).toBe(true);
    expect(resultGuard.matchesHeavenlyGeneralsInputs(noncanonical, "辛", "子", plate.value)).toBe(false);
  });
});

describe("computeHeavenlyGenerals", () => {
  it("composes a guarded snapshot with exact dependencies", () => {
    const outcome = computeHeavenlyGenerals(calendar, plate, fourLessons, transmissions);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.snapshot).toMatchObject({
      stage: "heavenly-generals",
      dependsOn: ["calendar", "heaven-earth", "three-transmissions"],
      ruleId: resultGuard.HEAVENLY_GENERALS_SNAPSHOT_RULE_ID,
    });
  });

  function capturePolicyError(run: () => unknown): Error {
    try {
      run();
    } catch (error) {
      if (error instanceof Error) return error;
      throw error;
    }
    throw new Error("expected policy error");
  }

  it.each([
    {
      name: "noble branch lookup failure",
      code: "NOBLE_BRANCH_LOOKUP_FAILED",
      cause: () => capturePolicyError(() => policy.deriveHeavenlyGenerals("invalid" as never, "子", plate.value)),
    },
    {
      name: "non-unique noble palace",
      code: "NOBLE_PALACE_NOT_UNIQUE",
      cause: () => {
        const broken = structuredClone(plate.value);
        const nobleHeaven = validValue.nobleHeaven;
        const other = broken.palaces.find(({ heaven }) => heaven !== nobleHeaven)! as { heaven: string };
        other.heaven = nobleHeaven;
        return capturePolicyError(() => policy.deriveHeavenlyGenerals("辛", "子", broken));
      },
    },
    {
      name: "invalid direction",
      code: "INVALID_HEAVENLY_GENERALS_DIRECTION",
      cause: () => {
        const broken = structuredClone(plate.value);
        const noblePalace = broken.palaces.find(({ heaven }) => heaven === validValue.nobleHeaven)! as { earth: string };
        noblePalace.earth = "invalid";
        return capturePolicyError(() => policy.deriveHeavenlyGenerals("辛", "子", broken));
      },
    },
    {
      name: "incomplete placement",
      code: "HEAVENLY_GENERALS_PLACEMENT_INCOMPLETE",
      cause: () => {
        const broken = structuredClone(plate.value);
        const palaces = broken.palaces as Array<{ earth: string; heaven: string }>;
        [palaces[2], palaces[3]] = [palaces[3], palaces[2]];
        return capturePolicyError(() => policy.deriveHeavenlyGenerals("辛", "子", broken));
      },
    },
  ] as const)("maps $name to $code", ({ code, cause: makeCause }) => {
    const cause = makeCause();
    vi.spyOn(policy, "deriveHeavenlyGenerals").mockImplementationOnce(() => { throw cause; });

    const outcome = computeHeavenlyGenerals(calendar, plate, fourLessons, transmissions);

    expect(outcome).toMatchObject({ ok: false, error: { code, cause } });
  });

  it("keeps an unexpected thrown cause on the stable fallback", () => {
    const cause = new Error("unexpected policy failure");
    vi.spyOn(policy, "deriveHeavenlyGenerals").mockImplementationOnce(() => { throw cause; });

    const outcome = computeHeavenlyGenerals(calendar, plate, fourLessons, transmissions);

    expect(outcome).toMatchObject({
      ok: false,
      error: { code: "HEAVENLY_GENERALS_RESULT_INCOMPLETE", cause },
    });
  });
});

const upstreamCases = [
  {
    name: "calendar",
    mutate(session: CourseSession) {
      delete session.snapshots.calendar;
    },
    expectedKeys: [],
  },
  {
    name: "heaven-earth",
    mutate(session: CourseSession) {
      const snapshot = session.snapshots["heaven-earth"] as HeavenEarthSnapshot;
      snapshot.value.monthGeneral.source = "manual";
      snapshot.source = "manual";
    },
    expectedKeys: ["calendar"],
  },
  {
    name: "four-lessons",
    mutate(session: CourseSession) {
      const snapshot = session.snapshots["four-lessons"] as FourLessonsSnapshot;
      snapshot.value.dayPillar = snapshot.value.dayPillar === "甲子" ? "乙丑" : "甲子";
    },
    expectedKeys: ["calendar", "heaven-earth"],
  },
  {
    name: "three-transmissions",
    mutate(session: CourseSession) {
      const snapshot = session.snapshots["three-transmissions"] as { value: { dayPillar: string } };
      snapshot.value.dayPillar = snapshot.value.dayPillar === "甲子" ? "乙丑" : "甲子";
    },
    expectedKeys: ["calendar", "heaven-earth", "four-lessons"],
  },
] as const;

describe("runHeavenlyGeneralsStage", () => {
  it.each(upstreamCases)("invalidates from the earliest invalid $name stage", ({ mutate, expectedKeys }) => {
    const broken = structuredClone(referenceSession);
    mutate(broken);

    const outcome = runHeavenlyGeneralsStage(broken);

    expect(outcome.ok).toBe(false);
    expect(outcome).toMatchObject({ error: { code: "INVALID_HEAVENLY_GENERALS_INPUT" } });
    expect(Object.keys(outcome.session.snapshots)).toEqual(expectedKeys);
  });

  it("keeps valid upstream when the derived result fails its guard", () => {
    vi.spyOn(resultGuard, "isHeavenlyGeneralsResult").mockReturnValueOnce(false);

    const outcome = runHeavenlyGeneralsStage(referenceSession);

    expect(outcome).toMatchObject({
      ok: false,
      error: { code: "HEAVENLY_GENERALS_RESULT_GUARD_FAILED" },
    });
    expect(Object.keys(outcome.session.snapshots)).toEqual([
      "calendar", "heaven-earth", "four-lessons", "three-transmissions",
    ]);
  });
});
