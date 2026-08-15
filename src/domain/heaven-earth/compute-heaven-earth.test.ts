import { describe, expect, it } from "vitest";
import { referenceSession } from "../../test/reference-session";
import { computeHeavenEarth, isHeavenEarthResult, runHeavenEarthStage } from "./compute-heaven-earth";
import type { HeavenEarthResult } from "./types";

function validResult(): HeavenEarthResult {
  const outcome = computeHeavenEarth(referenceSession.snapshots.calendar);
  if (!outcome.ok) throw new Error(`expected success, got ${outcome.error.code}`);
  return outcome.value;
}

describe("computeHeavenEarth", () => {
  it("creates a complete snapshot from calendar", () => {
    const outcome = computeHeavenEarth(referenceSession.snapshots.calendar);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.snapshot).toMatchObject({
      stage: "heaven-earth",
      dependsOn: ["calendar"],
      ruleId: "heaven-earth/month-general-over-hour-v1",
      source: "automatic",
    });
    expect(outcome.value.palaces).toHaveLength(12);
  });

  it("rejects a missing calendar snapshot", () => {
    expect(computeHeavenEarth(undefined)).toEqual({
      ok: false,
      error: { code: "INVALID_HEAVEN_EARTH_INPUT", message: "缺少有效的历法与月将快照" },
    });
  });

  it("derives a manual snapshot source from either reviewed input", () => {
    const calendar = structuredClone(referenceSession.snapshots.calendar!);
    calendar.value.monthGeneral.source = "manual";
    calendar.value.evidence = [
      ...calendar.value.evidence,
      {
        ruleId: "calendar/manual-correction-v1",
        field: "monthGeneral",
        input: "automatic",
        conclusion: "manual",
      },
    ];

    const outcome = computeHeavenEarth(calendar);

    expect(outcome).toMatchObject({ ok: true, snapshot: { source: "manual" } });
  });
});

describe("isHeavenEarthResult", () => {
  it.each([
    ["an out-of-range offset", (value: HeavenEarthResult) => { value.offset = 12; }],
    ["a duplicate heaven branch", (value: HeavenEarthResult) => { value.palaces = [{ ...value.palaces[0] }, { ...value.palaces[0] }, ...value.palaces.slice(2)]; }],
    ["an invalid earth branch", (value: HeavenEarthResult) => { value.palaces = [{ ...value.palaces[0], earth: "invalid" as never }, ...value.palaces.slice(1)]; }],
    ["a month general outside the divination-hour palace", (value: HeavenEarthResult) => {
      const hourIndex = value.palaces.findIndex(({ earth }) => earth === value.divinationHour.branch);
      value.palaces = value.palaces.map((palace, index) => index === hourIndex ? { ...palace, heaven: value.palaces[(index + 1) % 12].heaven } : palace);
    }],
    ["missing palace evidence", (value: HeavenEarthResult) => { value.evidence = value.evidence.filter(({ field }) => field !== `palace.${value.palaces[0].earth}`); }],
  ])("rejects %s", (_name, mutate) => {
    const value = structuredClone(validResult());
    mutate(value);

    expect(isHeavenEarthResult(value)).toBe(false);
  });
});

describe("runHeavenEarthStage", () => {
  it("replaces the stage and removes every downstream snapshot", () => {
    const outcome = runHeavenEarthStage(referenceSession);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(Object.keys(outcome.session.snapshots)).toEqual(["calendar", "heaven-earth"]);
    expect(outcome.session.snapshots["heaven-earth"]?.value).toBe(outcome.value);
    expect(referenceSession.snapshots.course).toBeDefined();
  });
});
