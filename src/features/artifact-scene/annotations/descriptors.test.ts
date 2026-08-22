import { describe, expect, it } from "vitest";
import { REQUIRED_NODE_IDS } from "../model/asset-contract";
import { ARTIFACT_REVIEW_STAGES } from "../timeline/review-stages";
import { ARTIFACT_ANNOTATION_DESCRIPTORS } from "./descriptors";

describe("ARTIFACT_ANNOTATION_DESCRIPTORS", () => {
  it("covers the frozen 22 annotation nodes exactly once", () => {
    expect(ARTIFACT_ANNOTATION_DESCRIPTORS).toHaveLength(22);
    expect(new Set(ARTIFACT_ANNOTATION_DESCRIPTORS.map(({ id }) => id)).size).toBe(22);
    expect(new Set(ARTIFACT_ANNOTATION_DESCRIPTORS.map(({ nodeId }) => nodeId)).size).toBe(22);
    ARTIFACT_ANNOTATION_DESCRIPTORS.forEach(({ nodeId }) => expect(REQUIRED_NODE_IDS).toContain(nodeId));
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
