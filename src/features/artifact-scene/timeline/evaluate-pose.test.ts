import { expect, it } from "vitest";
import type { ArtifactDisplayState } from "../model/types";
import { ARTIFACT_DURATION_MS, evaluateArtifactPose } from "./evaluate-pose";

const referenceState: ArtifactDisplayState = {
  calendar: { pillars: ["丙午", "丙申", "辛酉", "戊子"], monthBuild: "申", monthGeneral: "胜光", monthGeneralBranch: "午", divinationHour: "子", voidBranches: ["子", "丑"], manualFields: [] },
  plate: { offset: 6, palaces: ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"].map((earth) => ({ earth, heaven: earth })) as ArtifactDisplayState["plate"]["palaces"] },
  lessons: [] as unknown as ArtifactDisplayState["lessons"],
  transmissions: [] as unknown as ArtifactDisplayState["transmissions"],
  methodLabel: "反吟 · 重审",
  generals: [
    ["贵人", "子"], ["螣蛇", "丑"], ["朱雀", "寅"], ["六合", "卯"], ["勾陈", "辰"], ["青龙", "巳"],
    ["天空", "午"], ["白虎", "未"], ["太常", "申"], ["玄武", "酉"], ["太阴", "戌"], ["天后", "亥"],
  ].map(([general, earth], order) => ({ order, general, earth, heaven: earth, evidenceId: `placement-${order}` })) as ArtifactDisplayState["generals"],
  noble: { dayNight: "day", nobleHeaven: "子", nobleEarth: "子", direction: "forward" },
};

it("uses the concise two-stage duration and keeps explanation props out of the 3D demo", () => {
  const pose = evaluateArtifactPose(referenceState, ARTIFACT_DURATION_MS, false);
  expect(ARTIFACT_DURATION_MS).toBe(8_200);
  expect(pose.nodes["plate/heaven"]).toMatchObject({
    translationY: 0,
    rotationY: 6 * Math.PI / 6,
    rotationZ: 0,
  });
  expect(pose.nodes["plate/generals"]).toMatchObject({
    rotationY: 0,
    rotationZ: 0,
  });
  for (const id of [
    "calendar/slip",
    "lesson/first", "lesson/second", "lesson/third", "lesson/fourth",
    "transmission/initial", "transmission/middle", "transmission/final", "transmission/method",
  ]) expect(pose.nodes[id].visible).toBe(false);
  expect(pose.labelOpacity).toEqual({});
  expect(pose.nodes["general/noble"].visible).toBe(true);
  expect(pose.courseTraceOpacity).toBe(0);
  expect(pose).not.toHaveProperty("copy");
  expect(pose).not.toHaveProperty("cameraOrbitRequested");
});

it("starts the twelve-general landing after the month-general stage", () => {
  expect(evaluateArtifactPose(referenceState, 2_999, false).nodes["general/noble"].visible).toBe(false);
  expect(evaluateArtifactPose(referenceState, 3_250, false).nodes["general/noble"]).toMatchObject({
    visible: true, translationX: 0, translationZ: 0,
  });
  expect(evaluateArtifactPose(referenceState, 3_250, false).nodes["general/noble"].translationY).toBeGreaterThan(0);
});

it("keeps legacy explanation props, labels, and trace hidden throughout", () => {
  for (const timeMs of [0, 3_000, ARTIFACT_DURATION_MS]) {
    const pose = evaluateArtifactPose(referenceState, timeMs, false);
    expect(pose.nodes["calendar/slip"].visible).toBe(false);
    expect(pose.nodes["lesson/first"].visible).toBe(false);
    expect(pose.nodes["transmission/initial"].visible).toBe(false);
    expect(pose.labelOpacity).toEqual({});
    expect(pose.courseTraceOpacity).toBe(0);
  }
});

it("is deterministic for repeated seeks and exposes stable facts for reduced motion", () => {
  expect(evaluateArtifactPose(referenceState, 3_250, false)).toEqual(evaluateArtifactPose(referenceState, 3_250, false));
  expect(evaluateArtifactPose(referenceState, ARTIFACT_DURATION_MS, true).nodes["general/queen-of-heaven"].visible).toBe(true);
});
