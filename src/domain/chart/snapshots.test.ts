import { describe, expect, it } from "vitest";
import type { CalendarSnapshot } from "../calendar/types";
import type { HeavenEarthSnapshot } from "../heaven-earth/types";
import type { HeavenlyGeneralsSnapshot } from "../heavenly-generals/types";
import {
  invalidateFrom,
  isHeavenlyGeneralsSnapshotForCurrentInputs,
  validateSession,
} from "./snapshots";
import { RULE_STAGE_ORDER, stageDependencies } from "./stages";
import { referenceSession } from "../../test/reference-session";
import { deriveHeavenEarth } from "../heaven-earth/policy";
import { isHeavenEarthResult } from "../heaven-earth/result-guard";
import { deriveFourLessons } from "../four-lessons/policy";
import type { ThreeTransmissionsSnapshot } from "../three-transmissions/types";
import { deriveThreeTransmissions } from "../three-transmissions/policy";
import { deriveHeavenlyGenerals } from "../heavenly-generals/policy";

describe("rule stage metadata", () => {
  it("requires both direct four-lessons dependencies", () => {
    expect(stageDependencies["four-lessons"]).toEqual(["calendar", "heaven-earth"]);
  });

  it("requires three-transmissions before heavenly-generals", () => {
    expect(stageDependencies["three-transmissions"]).toEqual(["heaven-earth", "four-lessons"]);
    expect(stageDependencies["heavenly-generals"]).toEqual(["calendar", "heaven-earth", "three-transmissions"]);
  });

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

  expect(validateSession(broken)).toEqual(expect.arrayContaining([
    "four-lessons 缺少依赖 calendar",
    "four-lessons 缺少依赖 heaven-earth",
  ]));
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

it("accepts the complete real reference session", () => {
  expect(validateSession(referenceSession)).toEqual([]);
});

it("rejects forged heavenly-generals metadata", () => {
  const broken = structuredClone(referenceSession);
  broken.snapshots["heavenly-generals"]!.ruleId = "heavenly-generals/forged-v1";
  expect(validateSession(broken)).toContain("heavenly-generals 快照规则编号无效");
});

it("rejects heavenly generals copied from another plate", () => {
  const broken = structuredClone(referenceSession);
  const otherCalendar = structuredClone(referenceSession.snapshots.calendar!.value);
  otherCalendar.divinationHour.effective = "丑";
  otherCalendar.divinationHour.source = "manual";
  const otherPlate = deriveHeavenEarth(otherCalendar);
  broken.snapshots["heavenly-generals"]!.value = deriveHeavenlyGenerals(
    "辛",
    otherCalendar.divinationHour.effective,
    otherPlate,
  );
  expect(validateSession(broken)).toContain("heavenly-generals 与生效日干、占时或天地盘不一致");
});

it("guards a heavenly-generals snapshot against its actual current upstream inputs", () => {
  const calendar = referenceSession.snapshots.calendar as CalendarSnapshot;
  const plate = referenceSession.snapshots["heaven-earth"] as HeavenEarthSnapshot;
  const snapshot = referenceSession.snapshots["heavenly-generals"] as HeavenlyGeneralsSnapshot;

  expect(isHeavenlyGeneralsSnapshotForCurrentInputs(snapshot, calendar, plate)).toBe(true);
  expect(isHeavenlyGeneralsSnapshotForCurrentInputs({ ...snapshot, stage: "course" } as never, calendar, plate)).toBe(false);
  expect(isHeavenlyGeneralsSnapshotForCurrentInputs({ ...snapshot, dependsOn: ["calendar", "heaven-earth"] }, calendar, plate)).toBe(false);
  expect(isHeavenlyGeneralsSnapshotForCurrentInputs({ ...snapshot, ruleId: "heavenly-generals/forged-v1" }, calendar, plate)).toBe(false);
  expect(isHeavenlyGeneralsSnapshotForCurrentInputs({ ...snapshot, source: "manual" }, calendar, plate)).toBe(false);

  const otherCalendar = structuredClone(calendar.value);
  otherCalendar.divinationHour.effective = otherCalendar.divinationHour.effective === "子" ? "丑" : "子";
  otherCalendar.divinationHour.source = "manual";
  const otherPlate = deriveHeavenEarth(otherCalendar);
  const otherValue = deriveHeavenlyGenerals(
    otherCalendar.pillars.day.effective[0] as never,
    otherCalendar.divinationHour.effective,
    otherPlate,
  );
  expect(isHeavenlyGeneralsSnapshotForCurrentInputs({ ...snapshot, value: otherValue }, calendar, plate)).toBe(false);
});

it("removes heavenly-generals and course when three transmissions change", () => {
  const next = invalidateFrom(referenceSession, "three-transmissions");
  expect(next.snapshots["heavenly-generals"]).toBeUndefined();
  expect(next.snapshots.course).toBeUndefined();
});

it.each([
  { name: "missing", dependsOn: [] },
  { name: "forged", dependsOn: ["heaven-earth"] },
  { name: "extra", dependsOn: ["calendar", "heaven-earth", "course"] },
])("rejects $name declared dependencies", ({ dependsOn }) => {
  const broken = {
    ...referenceSession,
    snapshots: {
      ...referenceSession.snapshots,
      "four-lessons": { ...referenceSession.snapshots["four-lessons"], dependsOn },
    },
  } as unknown as typeof referenceSession;

  expect(validateSession(broken)).toContain("four-lessons 依赖声明无效，应为 calendar, heaven-earth");
});

it("rejects a four-lessons snapshot copied from different day inputs", () => {
  const broken = structuredClone(referenceSession);
  const otherCalendar = structuredClone(referenceSession.snapshots.calendar!.value);
  const plate = referenceSession.snapshots["heaven-earth"];
  if (!plate || !isHeavenEarthResult(plate.value)) throw new Error("expected heaven-earth fixture");
  otherCalendar.pillars.day.effective = "庚申";
  broken.snapshots["four-lessons"]!.value = deriveFourLessons(
    otherCalendar,
    plate.value,
  );

  expect(validateSession(broken)).toContain("four-lessons 与生效日柱或天地盘不一致");
});

it("rejects forged four-lessons metadata", () => {
  const broken = structuredClone(referenceSession);
  broken.snapshots["four-lessons"]!.ruleId = "four-lessons/forged-v1";

  expect(validateSession(broken)).toContain("four-lessons 快照规则编号无效");
});

it("rejects a four-lessons source that does not match its valid inputs", () => {
  const broken = structuredClone(referenceSession);
  broken.snapshots["four-lessons"]!.source = "manual";

  expect(validateSession(broken)).toContain("four-lessons 快照来源无效，应为 automatic");
});

it("rejects an invalid four-lessons result with valid dependencies", () => {
  const broken = structuredClone(referenceSession);
  broken.snapshots["four-lessons"]!.value = {};

  expect(validateSession(broken)).toContain("four-lessons 快照结果无效");
});

it("removes the changed stage and every downstream stage", () => {
  const next = invalidateFrom(referenceSession, "four-lessons");

  expect(next.snapshots.calendar).toBeDefined();
  expect(next.snapshots["heaven-earth"]).toBeDefined();
  expect(next.snapshots["four-lessons"]).toBeUndefined();
  expect(next.snapshots["three-transmissions"]).toBeUndefined();
  expect(next.snapshots["heavenly-generals"]).toBeUndefined();
  expect(next.snapshots.course).toBeUndefined();
});

it("rejects forged three-transmissions metadata", () => {
  const broken = structuredClone(referenceSession);
  const transmissions = broken.snapshots["three-transmissions"] as ThreeTransmissionsSnapshot;
  transmissions.ruleId = "three-transmissions/forged-v1";

  expect(validateSession(broken)).toContain("three-transmissions 快照规则编号无效");
});

it("rejects a three-transmissions source that does not match its direct inputs", () => {
  const broken = structuredClone(referenceSession);
  const transmissions = broken.snapshots["three-transmissions"] as ThreeTransmissionsSnapshot;
  transmissions.source = "manual";

  expect(validateSession(broken)).toContain("three-transmissions 快照来源无效，应为 automatic");
});

it("rejects an invalid three-transmissions result", () => {
  const broken = structuredClone(referenceSession);
  broken.snapshots["three-transmissions"]!.value = {};

  expect(validateSession(broken)).toContain("three-transmissions 快照结果无效");
});

it("rejects a three-transmissions snapshot copied from another plate", () => {
  const broken = structuredClone(referenceSession);
  const otherCalendar = structuredClone(referenceSession.snapshots.calendar!.value);
  otherCalendar.monthGeneral.effective = { name: "登明", branch: "亥" };
  otherCalendar.monthGeneral.source = "manual";
  otherCalendar.divinationHour.effective = "丑";
  otherCalendar.divinationHour.source = "manual";
  const otherPlate = deriveHeavenEarth(otherCalendar);
  const otherFourLessons = deriveFourLessons(otherCalendar, otherPlate);
  broken.snapshots["three-transmissions"]!.value = deriveThreeTransmissions(otherPlate, otherFourLessons);

  expect(validateSession(broken)).toContain("three-transmissions 与生效天地盘或四课不一致");
});

it("rejects a present calendar snapshot whose value fails the runtime guard", () => {
  const broken = structuredClone(referenceSession);
  if (!broken.snapshots.calendar) throw new Error("expected calendar fixture");
  broken.snapshots.calendar.value.pillars.day.effective = "甲丑" as never;

  expect(validateSession(broken)).toContain("calendar 快照结果无效");
});

it("rejects a forged calendar rule ID", () => {
  const broken = structuredClone(referenceSession);
  if (!broken.snapshots.calendar) throw new Error("expected calendar fixture");
  broken.snapshots.calendar.ruleId = "calendar/forged-v1";

  expect(validateSession(broken)).toContain("calendar 快照规则编号无效");
});

it("derives automatic calendar snapshot source from all six reviewed values", () => {
  const broken = structuredClone(referenceSession);
  if (!broken.snapshots.calendar) throw new Error("expected calendar fixture");
  broken.snapshots.calendar.source = "manual";

  expect(validateSession(broken)).toContain("calendar 快照来源无效，应为 automatic");
});

it("derives manual calendar snapshot source from any manual reviewed value", () => {
  const broken = structuredClone(referenceSession);
  const calendar = broken.snapshots.calendar;
  if (!calendar) throw new Error("expected calendar fixture");
  calendar.value.pillars.year.source = "manual";
  calendar.value.evidence = [
    ...calendar.value.evidence,
    {
      ruleId: "calendar/manual-correction-v1",
      field: "yearPillar",
      input: "自动值 丙午，人工值 丙午",
      conclusion: "yearPillar 采用人工有效值 丙午",
    },
  ];

  expect(validateSession(broken)).toContain("calendar 快照来源无效，应为 manual");
});

it("rejects an invalid heaven-earth result", () => {
  const broken = structuredClone(referenceSession);
  const heavenEarth = broken.snapshots["heaven-earth"];
  if (!heavenEarth || typeof heavenEarth.value !== "object" || heavenEarth.value === null) {
    throw new Error("expected heaven-earth fixture");
  }
  const value = heavenEarth.value as { palaces: Array<{ earth: string; heaven: string }> };
  value.palaces[1].heaven = value.palaces[0].heaven;

  expect(validateSession(broken)).toContain("heaven-earth 快照结果无效");
});

it("rejects a forged heaven-earth rule ID", () => {
  const broken = structuredClone(referenceSession);
  const heavenEarth = broken.snapshots["heaven-earth"];
  if (!heavenEarth) throw new Error("expected heaven-earth fixture");
  heavenEarth.ruleId = "heaven-earth/forged-v1";

  expect(validateSession(broken)).toContain("heaven-earth 快照规则编号无效");
});

it("rejects a heaven-earth source that does not match its reviewed inputs", () => {
  const broken = structuredClone(referenceSession);
  const heavenEarth = broken.snapshots["heaven-earth"];
  if (!heavenEarth) throw new Error("expected heaven-earth fixture");
  heavenEarth.source = "manual";

  expect(validateSession(broken)).toContain("heaven-earth 快照来源无效，应为 automatic");
});

it("rejects a heaven-earth snapshot missing its calendar dependency", () => {
  const broken = {
    ...referenceSession,
    snapshots: { "heaven-earth": referenceSession.snapshots["heaven-earth"] },
  };

  expect(validateSession(broken)).toContain("heaven-earth 缺少依赖 calendar");
});

it("rejects an internally valid heaven-earth plate copied from different calendar inputs", () => {
  const broken = structuredClone(referenceSession);
  const calendar = structuredClone(referenceSession.snapshots.calendar!.value);
  calendar.monthGeneral.effective = { name: "登明", branch: "亥" };
  calendar.monthGeneral.source = "manual";
  calendar.divinationHour.effective = "丑";
  calendar.divinationHour.source = "manual";
  const heavenEarth = broken.snapshots["heaven-earth"];
  if (!heavenEarth) throw new Error("expected heaven-earth fixture");
  heavenEarth.value = deriveHeavenEarth(calendar);
  heavenEarth.source = "manual";

  const errors = validateSession(broken);
  expect(errors).toEqual(expect.arrayContaining([
    "heaven-earth 月将名称与 calendar 生效值不一致",
    "heaven-earth 月将地支与 calendar 生效值不一致",
    "heaven-earth 月将来源与 calendar 来源不一致",
    "heaven-earth 占时地支与 calendar 生效值不一致",
    "heaven-earth 占时来源与 calendar 来源不一致",
  ]));
  expect(errors).not.toContain("heavenly-generals 快照结果无效");
});
