import { describe, expect, it } from "vitest";
import { referenceSession } from "../test/reference-session";
import { computeMiniToolCourse } from "./compute-course";

describe("computeMiniToolCourse", () => {
  it("builds the complete course through the domain pipeline", () => {
    const outcome = computeMiniToolCourse(referenceSession.input);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.source.course.lessons).toHaveLength(4);
    expect(outcome.source.course.transmissions).toHaveLength(3);
    expect(outcome.source.generals.placements).toHaveLength(12);
    expect(outcome.source.course.palaces).toHaveLength(12);
  });

  it("returns an error instead of throwing for invalid input", () => {
    expect(computeMiniToolCourse({ ...referenceSession.input, civilDateTime: "bad" })).toMatchObject({ ok: false });
  });

  it("builds a valid course when Chrome 61 does not provide Object.hasOwn", () => {
    const descriptor = Object.getOwnPropertyDescriptor(Object, "hasOwn");
    Object.defineProperty(Object, "hasOwn", { configurable: true, value: undefined });
    try {
      expect(computeMiniToolCourse(referenceSession.input).ok).toBe(true);
    } finally {
      if (descriptor) Object.defineProperty(Object, "hasOwn", descriptor);
      else delete (Object as { hasOwn?: unknown }).hasOwn;
    }
  });
});
