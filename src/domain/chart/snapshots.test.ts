import { describe, expect, it } from "vitest";
import { invalidateFrom, validateSession } from "./snapshots";
import { RULE_STAGE_ORDER, stageDependencies } from "./stages";
import { referenceSession } from "../../test/reference-session";

describe("rule stage metadata", () => {
  it("orders every calculation dependency before its consumer", () => {
    for (const [index, stage] of RULE_STAGE_ORDER.entries()) {
      for (const dependency of stageDependencies[stage]) {
        expect(RULE_STAGE_ORDER.indexOf(dependency)).toBeLessThan(index);
      }
    }
  });
});

it("rejects a snapshot whose declared dependencies are absent", () => {
  const broken = {
    ...referenceSession,
    snapshots: { "four-lessons": referenceSession.snapshots["four-lessons"] },
  };

  expect(validateSession(broken)).toContain("four-lessons 缺少依赖 heaven-earth");
});

it("rejects a snapshot whose stage does not match its key", () => {
  const broken = {
    ...referenceSession,
    snapshots: {
      ...referenceSession.snapshots,
      calendar: { ...referenceSession.snapshots.calendar, stage: "course" },
    },
  } as unknown as typeof referenceSession;

  expect(validateSession(broken)).toContain("calendar 快照阶段与键不一致: course");
});

it.each([
  { name: "missing", dependsOn: [] },
  { name: "forged", dependsOn: ["calendar"] },
  { name: "extra", dependsOn: ["heaven-earth", "calendar"] },
])("rejects $name declared dependencies", ({ dependsOn }) => {
  const broken = {
    ...referenceSession,
    snapshots: {
      ...referenceSession.snapshots,
      "four-lessons": { ...referenceSession.snapshots["four-lessons"], dependsOn },
    },
  } as unknown as typeof referenceSession;

  expect(validateSession(broken)).toContain("four-lessons 依赖声明无效，应为 heaven-earth");
});

it("removes the changed stage and every downstream stage", () => {
  const next = invalidateFrom(referenceSession, "four-lessons");

  expect(next.snapshots.calendar).toBeDefined();
  expect(next.snapshots["heaven-earth"]).toBeDefined();
  expect(next.snapshots["four-lessons"]).toBeUndefined();
  expect(next.snapshots["three-transmissions"]).toBeUndefined();
  expect(next.snapshots["heavenly-generals"]).toBeDefined();
  expect(next.snapshots.course).toBeUndefined();
});
