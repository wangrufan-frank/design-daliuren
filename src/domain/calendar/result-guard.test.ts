import { expect, it } from "vitest";
import { referenceSession } from "../../test/reference-session";
import { isCalendarResult } from "./result-guard";

it("exposes the calendar result guard without importing snapshot orchestration", () => {
  expect(isCalendarResult(referenceSession.snapshots.calendar?.value)).toBe(true);
});
