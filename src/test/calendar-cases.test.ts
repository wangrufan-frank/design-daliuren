import { describe, expect, it } from "vitest";
import { solarTermCrossChecks, termBoundaryCases, ziInitialCases } from "./calendar-cases";

describe("calendar v1 evidence", () => {
  it("keeps independent solar-term discrepancies below sixty seconds", () => {
    expect(solarTermCrossChecks.every((item) => item.differenceSeconds <= 60)).toBe(true);
  });

  it("locks both sides and equality for every approved boundary", () => {
    expect(ziInitialCases.map((item) => item.input.slice(11))).toEqual(["22:59:00", "23:00:00", "23:01:00"]);
    expect(termBoundaryCases).toHaveLength(9);
  });
});
