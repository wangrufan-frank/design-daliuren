import { expect, it } from "vitest";
import type { ArtifactDisplayState } from "../model/types";
import { ARTIFACT_DURATION_MS, evaluateArtifactPose } from "./evaluate-pose";
import { evaluateStageReplay } from "./evaluate-stage-replay";
import { reviewStageFor } from "./review-stages";

const referenceState: ArtifactDisplayState = {
  calendar: { pillars: ["丙午", "丙申", "辛酉", "戊子"], monthBuild: "申", monthGeneral: "胜光", monthGeneralBranch: "午", divinationHour: "子", manualFields: [] },
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

it("locks the heaven plate to offset times 30 degrees", () => {
  const pose = evaluateArtifactPose(referenceState, 3_200, false);
  expect(pose.nodes["plate/heaven"].rotationZ).toBeCloseTo(referenceState.plate.offset * Math.PI / 6);
});

it("uses the confirmed absolute travels at the final pose", () => {
  const pose = evaluateArtifactPose(referenceState, ARTIFACT_DURATION_MS, false);
  expect(pose.nodes["calendar/slip"]).toMatchObject({ translationZ: 0.035, rotationX: -0.12 });
  expect(pose.nodes["plate/heaven"].translationZ).toBeCloseTo(0.03);
  expect(pose.nodes["lesson/first"].translationX).toBeCloseTo(-0.045);
  expect(pose.nodes["lesson/fourth"].translationX).toBeCloseTo(0.045);
  expect(pose.nodes["transmission/bridge"].translationY).toBeCloseTo(-0.118);
  expect(pose.nodes["transmission/final"].translationY).toBeCloseTo(-0.075);
  expect(pose.nodes["general/noble"].translationZ).toBeCloseTo(0.004);
  expect(pose.nodes["general/queen-of-heaven"].translationZ).toBeCloseTo(0.048);
  expect(pose.nodes["anchor/course-copy/lessons"].translationX).toBeCloseTo(-0.025);
  expect(pose.nodes["anchor/course-copy/transmissions"].translationX).toBeCloseTo(0.025);
});

it("returns identical structures for repeated seeks", () => {
  expect(evaluateArtifactPose(referenceState, 8_450, false)).toEqual(
    evaluateArtifactPose(referenceState, 8_450, false),
  );
});

it("settles stage four identically after different prior click sequences", () => {
  const poseAfterClicks = (stages: readonly ("calendar" | "heaven-earth" | "four-lessons" | "three-transmissions" | "heavenly-generals" | "course")[]) => {
    let pose = evaluateArtifactPose(referenceState, 0, false);
    for (const stageId of stages) {
      const replay = evaluateStageReplay(reviewStageFor(stageId), 1_800, false);
      pose = evaluateArtifactPose(referenceState, replay.timelineTimeMs, false);
    }
    return pose;
  };

  expect(poseAfterClicks(["calendar", "heaven-earth", "four-lessons", "three-transmissions"])).toEqual(
    poseAfterClicks(["course", "heavenly-generals", "calendar", "three-transmissions"]),
  );
});

it.each([
  [-1, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [600, 0.0175, 0, 0, 0, 0], [1_200, 0.035, 0, 0, 0, 0],
  [2_200, 0.035, 3, 0, 0, 0], [3_200, 0.035, 6, 0, 0, 0], [4_300, 0.035, 6, 0.0225, 0, 0],
  [5_400, 0.035, 6, 0.045, 0, 0], [6_500, 0.035, 6, 0.045, -0.059, 0], [7_600, 0.035, 6, 0.045, -0.118, 0],
  [8_950, 0.035, 6, 0.045, -0.118, 0.004], [10_300, 0.035, 6, 0.045, -0.118, 0.004], [11_400, 0.035, 6, 0.045, -0.118, 0.004],
  [12_500, 0.035, 6, 0.045, -0.118, 0.004], [12_501, 0.035, 6, 0.045, -0.118, 0.004],
])("clamps and evaluates the stage boundaries at %d ms", (timeMs, slip, plate, lesson, bridge, general) => {
  const pose = evaluateArtifactPose(referenceState, timeMs, false);
  expect(pose.nodes["calendar/slip"].translationZ).toBeCloseTo(slip);
  expect(pose.nodes["plate/heaven"].rotationZ).toBeCloseTo(plate * Math.PI / 6);
  expect(Math.abs(pose.nodes["lesson/first"].translationX)).toBeCloseTo(lesson);
  expect(pose.nodes["transmission/bridge"].translationY).toBeCloseTo(bridge);
  expect(pose.nodes["general/noble"].translationZ).toBeCloseTo(general);
});

it("uses each general earth palace independently from deployment order and direction", () => {
  const reversed = evaluateArtifactPose({ ...referenceState, noble: { ...referenceState.noble, direction: "reverse" } }, 10_300, false);
  const reordered = evaluateArtifactPose({ ...referenceState, generals: [...referenceState.generals].reverse().map((item, order) => ({ ...item, order })) }, 10_300, false);
  expect(reversed.nodes["general/snake"].targetEarth).toBe("丑");
  expect(reordered.nodes["general/snake"].targetEarth).toBe("丑");
  expect(reversed.generalDirection).toBe("reverse");
  expect(reversed.generalSequence).toEqual([
    "general/queen-of-heaven", "general/yin", "general/black-tortoise", "general/constant",
    "general/white-tiger", "general/void", "general/azure-dragon", "general/hook-array",
    "general/harmony", "general/vermilion-bird", "general/snake", "general/noble",
  ]);
});

it("places generals one at a time in the requested directional sequence", () => {
  const forward = evaluateArtifactPose(referenceState, 7_825, false);
  const reverse = evaluateArtifactPose(
    { ...referenceState, noble: { ...referenceState.noble, direction: "reverse" } },
    7_825,
    false,
  );

  expect(forward.nodes["general/noble"].translationZ).toBeCloseTo(0.007);
  expect(forward.nodes["general/snake"].translationZ).toBe(0);
  expect(reverse.nodes["general/queen-of-heaven"].translationZ).toBeCloseTo(0.007);
  expect(reverse.nodes["general/yin"].translationZ).toBe(0);
});

it("snaps reduced motion stages, fades source lines briefly, and retains final copy", () => {
  expect(evaluateArtifactPose(referenceState, 600, true).nodes["calendar/slip"].translationZ).toBe(0);
  expect(evaluateArtifactPose(referenceState, 1_200, true).nodes["calendar/slip"].translationZ).toBe(0.035);
  const fade = evaluateArtifactPose(referenceState, 10_375, true).copy.lessons;
  expect(fade.sourceLineOpacity).toBeCloseTo(0.5);
  expect(evaluateArtifactPose(referenceState, ARTIFACT_DURATION_MS, true).copy).toEqual({
    lessons: { opacity: 1, sourceLineProgress: 0, sourceLineOpacity: 0 },
    transmissions: { opacity: 1, sourceLineProgress: 0, sourceLineOpacity: 0 },
    generals: { opacity: 1, sourceLineProgress: 0, sourceLineOpacity: 0 },
  });
});

it("keeps copy hidden until the final stage and clears normal source lines at completion", () => {
  expect(evaluateArtifactPose(referenceState, 10_299, false).copy.lessons).toEqual({ opacity: 0, sourceLineProgress: 0, sourceLineOpacity: 0 });
  expect(evaluateArtifactPose(referenceState, ARTIFACT_DURATION_MS, false).copy.lessons).toEqual({ opacity: 1, sourceLineProgress: 0, sourceLineOpacity: 0 });
});
