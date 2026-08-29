import { expect, it } from "vitest";
import { referenceSession } from "../../test/reference-session";
import type { CalendarSnapshot } from "./types";
import { isCalendarResult, isCalendarSnapshot } from "./result-guard";

it("exposes the calendar result guard without importing snapshot orchestration", () => {
  expect(isCalendarResult(referenceSession.snapshots.calendar?.value)).toBe(true);
});

it.each(["lunarDate", "monthBuild"])("rejects a calendar result missing %s evidence", (field) => {
  const value = structuredClone(referenceSession.snapshots.calendar!.value);
  value.evidence = value.evidence.filter((step) => step.field !== field);

  expect(isCalendarResult(value)).toBe(false);
});

it("rejects void branches that do not match the effective day pillar", () => {
  const value = structuredClone(referenceSession.snapshots.calendar!.value);
  value.voidBranches = ["戌", "亥"];

  expect(isCalendarResult(value)).toBe(false);
});

it.each<[string, (snapshot: CalendarSnapshot) => void]>([
  ["value", (snapshot) => { snapshot.value.pillars.day.effective = "甲丑" as never; }],
  ["stage", (snapshot) => { snapshot.stage = "heaven-earth" as never; }],
  ["dependencies", (snapshot) => { snapshot.dependsOn = ["calendar"]; }],
  ["rule ID", (snapshot) => { snapshot.ruleId = "calendar/forged-v1"; }],
  ["derived source", (snapshot) => { snapshot.source = "manual"; }],
])("rejects a calendar snapshot with forged %s metadata", (_name, mutate) => {
  const snapshot = structuredClone(referenceSession.snapshots.calendar!);
  mutate(snapshot);

  expect(isCalendarSnapshot(snapshot)).toBe(false);
});
