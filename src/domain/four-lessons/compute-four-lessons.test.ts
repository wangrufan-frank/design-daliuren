import { describe, expect, it } from "vitest";
import { referenceSession } from "../../test/reference-session";
import { computeFourLessons, runFourLessonsStage } from "./compute-four-lessons";
import { isFourLessonsResult } from "./result-guard";
import type { HeavenEarthSnapshot } from "../heaven-earth/types";
import type { FourLesson, FourLessonsResult } from "./types";

function validResult(): FourLessonsResult {
  const outcome = computeFourLessons(
    referenceSession.snapshots.calendar,
    referenceSession.snapshots["heaven-earth"] as HeavenEarthSnapshot,
  );
  if (!outcome.ok) throw new Error(outcome.error.code);
  return outcome.value;
}

describe("computeFourLessons", () => {
  it("creates the guarded snapshot with both direct dependencies", () => {
    const outcome = computeFourLessons(
      referenceSession.snapshots.calendar,
      referenceSession.snapshots["heaven-earth"] as HeavenEarthSnapshot,
    );
    expect(outcome).toMatchObject({
      ok: true,
      snapshot: {
        stage: "four-lessons",
        dependsOn: ["calendar", "heaven-earth"],
        ruleId: "four-lessons/derive-v1",
        source: "automatic",
      },
    });
  });

  it.each([
    ["calendar", undefined, referenceSession.snapshots["heaven-earth"]],
    ["plate", referenceSession.snapshots.calendar, undefined],
  ])("rejects a missing %s snapshot", (_name, calendar, plate) => {
    expect(computeFourLessons(calendar, plate as HeavenEarthSnapshot | undefined)).toMatchObject({
      ok: false,
      error: { code: "INVALID_FOUR_LESSONS_INPUT" },
    });
  });

  it("derives manual source from a manual day pillar", () => {
    const calendar = structuredClone(referenceSession.snapshots.calendar!);
    calendar.value.pillars.day.source = "manual";
    calendar.value.evidence = [...calendar.value.evidence, {
      ruleId: "calendar/manual-correction-v1", field: "dayPillar", input: "automatic 辛酉，manual 辛酉", conclusion: "dayPillar 采用人工有效值 辛酉",
    }];
    calendar.source = "manual";
    expect(computeFourLessons(calendar, referenceSession.snapshots["heaven-earth"] as HeavenEarthSnapshot)).toMatchObject({
      ok: true,
      snapshot: { source: "manual" },
    });
  });

  it.each([
    ["dependsOn", (plate: HeavenEarthSnapshot) => { plate.dependsOn = []; }],
    ["ruleId", (plate: HeavenEarthSnapshot) => { plate.ruleId = "wrong"; }],
    ["source", (plate: HeavenEarthSnapshot) => { plate.source = "manual"; }],
    ["month general", (plate: HeavenEarthSnapshot) => { plate.value.monthGeneral.branch = "子"; }],
    ["divination hour", (plate: HeavenEarthSnapshot) => { plate.value.divinationHour.branch = "丑"; }],
  ])("rejects a plate with invalid %s provenance", (_name, mutate) => {
    const plate = structuredClone(referenceSession.snapshots["heaven-earth"] as HeavenEarthSnapshot);
    mutate(plate);
    expect(computeFourLessons(referenceSession.snapshots.calendar, plate)).toMatchObject({
      ok: false,
      error: { code: "INVALID_FOUR_LESSONS_INPUT" },
    });
  });

  it("rejects an array-shaped plate dependency declaration", () => {
    const plate = structuredClone(referenceSession.snapshots["heaven-earth"] as HeavenEarthSnapshot);
    (plate as unknown as { dependsOn: unknown }).dependsOn = { length: 1, 0: "calendar" };
    expect(computeFourLessons(referenceSession.snapshots.calendar, plate)).toMatchObject({
      ok: false,
      error: { code: "INVALID_FOUR_LESSONS_INPUT" },
    });
  });
});

describe("isFourLessonsResult", () => {
  it.each([
    ["wrong order", (value: FourLessonsResult) => {
      const lessons = value.lessons as unknown as FourLesson[];
      [lessons[0], lessons[1]] = [lessons[1], lessons[0]];
    }],
    ["broken second link", (value: FourLessonsResult) => { value.lessons[1].lower = { kind: "branch", value: "子" }; }],
    ["broken fourth link", (value: FourLessonsResult) => { value.lessons[3].lookupEarth = "子"; }],
    ["missing evidence", (value: FourLessonsResult) => { value.evidence = value.evidence.slice(1); }],
  ])("rejects %s", (_name, mutate) => {
    const value = structuredClone(validResult());
    mutate(value);
    expect(isFourLessonsResult(value)).toBe(false);
  });
});

describe("runFourLessonsStage", () => {
  it("replaces four-lessons and removes every direct and transitive descendant", () => {
    const outcome = runFourLessonsStage(referenceSession);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(Object.keys(outcome.session.snapshots)).toEqual(["calendar", "heaven-earth", "four-lessons"]);
    expect(outcome.session.snapshots["three-transmissions"]).toBeUndefined();
    expect(outcome.session.snapshots["heavenly-generals"]).toBeUndefined();
    expect(outcome.session.snapshots.course).toBeUndefined();
  });

  it("returns an invalidated session when either upstream snapshot is invalid", () => {
    const broken = structuredClone(referenceSession);
    delete broken.snapshots["heaven-earth"];
    const outcome = runFourLessonsStage(broken);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.session.snapshots["four-lessons"]).toBeUndefined();
    expect(outcome.session.snapshots["three-transmissions"]).toBeUndefined();
    expect(outcome.session.snapshots["heavenly-generals"]).toBeUndefined();
    expect(outcome.session.snapshots.course).toBeUndefined();
  });

  it("invalidates descendants when the plate dependency declaration is malformed", () => {
    const broken = structuredClone(referenceSession);
    (broken.snapshots["heaven-earth"] as unknown as { dependsOn: unknown }).dependsOn = undefined;
    const outcome = runFourLessonsStage(broken);
    expect(outcome).toMatchObject({ ok: false, error: { code: "INVALID_FOUR_LESSONS_INPUT" } });
    if (outcome.ok) return;
    expect(outcome.session.snapshots["four-lessons"]).toBeUndefined();
    expect(outcome.session.snapshots["three-transmissions"]).toBeUndefined();
    expect(outcome.session.snapshots["heavenly-generals"]).toBeUndefined();
    expect(outcome.session.snapshots.course).toBeUndefined();
  });
});
