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

it("uses the exact 27-second duration without rotating the fixed general seats", () => {
  const pose = evaluateArtifactPose(referenceState, ARTIFACT_DURATION_MS, false);
  expect(ARTIFACT_DURATION_MS).toBe(27_000);
  expect(pose.nodes["plate/heaven"]).toMatchObject({
    translationY: 0,
    rotationY: 6 * Math.PI / 6,
    rotationZ: 0,
  });
  expect(pose.nodes["plate/generals"]).toMatchObject({
    rotationY: 0,
    rotationZ: 0,
  });
  expect(pose.nodes["transmission/initial"].visible).toBe(true);
  expect(pose.courseTraceOpacity).toBe(0);
  expect(pose).not.toHaveProperty("copy");
  expect(pose).not.toHaveProperty("cameraOrbitRequested");
});

it("hides lesson slips before their 8000 ms stage and reveals each over a 760 ms placement", () => {
  expect(evaluateArtifactPose(referenceState, 7_999, false).nodes["lesson/first"].visible).toBe(false);
  const started = evaluateArtifactPose(referenceState, 8_000, false).nodes["lesson/first"];
  expect(started).toMatchObject({ visible: true, translationZ: 0.018 });
  expect(Math.abs(started.translationX)).toBeLessThanOrEqual(0.01);
  expect(evaluateArtifactPose(referenceState, 8_760, false).nodes["lesson/first"]).toMatchObject({
    visible: true, translationX: 0, translationY: 0, translationZ: 0,
  });
  expect(evaluateArtifactPose(referenceState, 8_800, false).nodes["lesson/second"].visible).toBe(false);
  expect(evaluateArtifactPose(referenceState, 9_200, false).nodes["lesson/second"].visible).toBe(true);
});

it("reveals transmission slips one at a time while the noble inlay lands", () => {
  expect(evaluateArtifactPose(referenceState, 13_000, false).nodes["transmission/initial"]).toMatchObject({ visible: true, translationZ: 0.018 });
  expect(evaluateArtifactPose(referenceState, 14_000, false).nodes["transmission/middle"].visible).toBe(true);
  expect(evaluateArtifactPose(referenceState, 15_000, false).nodes["transmission/final"].visible).toBe(true);
  expect(evaluateArtifactPose(referenceState, 18_250, false).nodes["general/noble"]).toMatchObject({
    visible: true, translationX: 0, translationZ: 0,
  });
  expect(evaluateArtifactPose(referenceState, 18_250, false).nodes["general/noble"].translationY).toBeGreaterThan(0);
});

it("reveals the noble-first general label at 18250 ms for either course direction", () => {
  const forward = evaluateArtifactPose(referenceState, 18_250, false);
  const reverse = evaluateArtifactPose({ ...referenceState, noble: { ...referenceState.noble, direction: "reverse" } }, 18_250, false);
  expect(Object.entries(forward.labelOpacity).filter(([id, opacity]) => id.startsWith("dynamic/general/") && opacity > 0).map(([id]) => id)).toEqual(["dynamic/general/noble"]);
  expect(Object.entries(reverse.labelOpacity).filter(([id, opacity]) => id.startsWith("dynamic/general/") && opacity > 0).map(([id]) => id)).toEqual(["dynamic/general/noble"]);
});

it("makes the course trace a deterministic pulse and suppresses it for reduced motion", () => {
  expect(evaluateArtifactPose(referenceState, 23_999, false).courseTraceOpacity).toBe(0);
  expect(evaluateArtifactPose(referenceState, 24_600, false).courseTraceOpacity).toBeCloseTo(0.5);
  expect(evaluateArtifactPose(referenceState, 25_200, false).courseTraceOpacity).toBe(1);
  expect(evaluateArtifactPose(referenceState, 26_400, false).courseTraceOpacity).toBe(0);
  expect(evaluateArtifactPose(referenceState, 25_200, true).courseTraceOpacity).toBe(0);
});

it("is deterministic for repeated seeks and exposes stable facts for reduced motion", () => {
  expect(evaluateArtifactPose(referenceState, 18_250, false)).toEqual(evaluateArtifactPose(referenceState, 18_250, false));
  expect(evaluateArtifactPose(referenceState, ARTIFACT_DURATION_MS, true).nodes["general/queen-of-heaven"].visible).toBe(true);
});
