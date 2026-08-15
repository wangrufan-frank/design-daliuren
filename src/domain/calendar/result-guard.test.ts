import { expect, it } from "vitest";
import { referenceSession } from "../../test/reference-session";
import { isCalendarResult } from "./result-guard";

it("exposes the calendar result guard without importing snapshot orchestration", () => {
  expect(isCalendarResult(referenceSession.snapshots.calendar?.value)).toBe(true);
});

it.each(["lunarDate", "monthBuild"])("rejects a calendar result missing %s evidence", (field) => {
  const value = structuredClone(referenceSession.snapshots.calendar!.value);
  value.evidence = value.evidence.filter((step) => step.field !== field);

  expect(isCalendarResult(value)).toBe(false);
});
