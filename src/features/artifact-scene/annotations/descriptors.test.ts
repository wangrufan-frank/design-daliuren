import { describe, expect, it } from "vitest";
import { REQUIRED_NODE_IDS } from "../model/asset-contract";
import { ARTIFACT_REVIEW_STAGES } from "../timeline/review-stages";
import { ARTIFACT_ANNOTATION_DESCRIPTORS } from "./descriptors";

describe("ARTIFACT_ANNOTATION_DESCRIPTORS", () => {
  it("covers every declared annotation node exactly once", () => {
    const descriptorCount = ARTIFACT_ANNOTATION_DESCRIPTORS.length;
    expect(new Set(ARTIFACT_ANNOTATION_DESCRIPTORS.map(({ id }) => id)).size).toBe(descriptorCount);
    expect(new Set(ARTIFACT_ANNOTATION_DESCRIPTORS.map(({ nodeId }) => nodeId)).size).toBe(descriptorCount);
    ARTIFACT_ANNOTATION_DESCRIPTORS.forEach(({ nodeId }) => expect(REQUIRED_NODE_IDS).toContain(nodeId));
  });

  it("names the rotating month-general ring without implying that fixed seats rotate", () => {
    const byNodeId = new Map(ARTIFACT_ANNOTATION_DESCRIPTORS.map((descriptor) => [descriptor.nodeId, descriptor]));

    expect(byNodeId.get("plate/heaven")).toMatchObject({
      label: "月将环",
      detail: expect.stringContaining("独立旋转"),
    });
    expect(byNodeId.get("plate/heaven")?.detail).not.toMatch(/天盘转动|整体天盘|随月将转动/);
    expect(byNodeId.get("plate/generals")).toMatchObject({
      label: "十二神将承位",
      detail: expect.stringMatching(/固定|承接/),
    });
    expect(byNodeId.get("plate/generals")?.detail).not.toMatch(/转动|旋转/);
  });

  it("uses Chinese copy and reflects every stage feature", () => {
    const byId = new Map(ARTIFACT_ANNOTATION_DESCRIPTORS.map((descriptor) => [descriptor.id, descriptor]));
    ARTIFACT_ANNOTATION_DESCRIPTORS.forEach(({ label, detail }) => {
      expect(label).toMatch(/[\u4e00-\u9fff]/);
      expect(detail).toMatch(/[\u4e00-\u9fff]/);
    });
    ARTIFACT_REVIEW_STAGES.forEach((stage) => {
      expect(stage.annotationIds.length).toBeGreaterThanOrEqual(3);
      expect(stage.annotationIds.length).toBeLessThanOrEqual(6);
      stage.annotationIds.forEach((id) => expect(byId.get(id)?.stages).toContain(stage.id));
    });
  });
});
