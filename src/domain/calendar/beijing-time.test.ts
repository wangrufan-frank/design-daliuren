import { describe, expect, it } from "vitest";
import { parseBeijingDateTime } from "./beijing-time";

describe("parseBeijingDateTime", () => {
  it("normalizes missing seconds without using the machine timezone", () => {
    expect(parseBeijingDateTime("2024-02-10T14:30")).toMatchObject({
      isoLocal: "2024-02-10T14:30:00",
      year: 2024,
      month: 2,
      day: 10,
      hour: 14,
      minute: 30,
      second: 0,
      utcEpochMs: Date.UTC(2024, 1, 10, 6, 30, 0),
    });
  });

  it.each(["1899-12-31T23:59:59", "2101-01-01T00:00:00", "2024-02-30T10:00:00"])(
    "rejects unsupported or impossible input %s",
    (value) => expect(() => parseBeijingDateTime(value)).toThrow(),
  );
});
