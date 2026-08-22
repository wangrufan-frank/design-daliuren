import type { ArtifactAnnotationId, ProjectedAnchor } from "./types";

export interface AnnotationAnchor {
  id: ArtifactAnnotationId;
  position: readonly [number, number, number];
  occluded?: boolean;
}

export interface AnnotationViewport {
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function projectArtifactAnnotations(
  anchors: readonly AnnotationAnchor[],
  viewProjectionMatrix: readonly number[],
  viewport: AnnotationViewport,
): ProjectedAnchor[] {
  return anchors.map(({ id, position: [x, y, z], occluded = false }) => {
    const clipX = viewProjectionMatrix[0] * x + viewProjectionMatrix[4] * y + viewProjectionMatrix[8] * z + viewProjectionMatrix[12];
    const clipY = viewProjectionMatrix[1] * x + viewProjectionMatrix[5] * y + viewProjectionMatrix[9] * z + viewProjectionMatrix[13];
    const clipZ = viewProjectionMatrix[2] * x + viewProjectionMatrix[6] * y + viewProjectionMatrix[10] * z + viewProjectionMatrix[14];
    const clipW = viewProjectionMatrix[3] * x + viewProjectionMatrix[7] * y + viewProjectionMatrix[11] * z + viewProjectionMatrix[15];
    const divisor = clipW === 0 ? 1 : clipW;
    const normalizedX = clipX / divisor;
    const normalizedY = clipY / divisor;

    return {
      id,
      x: clamp((normalizedX + 1) * viewport.width / 2, 0, viewport.width),
      y: clamp((1 - normalizedY) * viewport.height / 2, 0, viewport.height),
      depth: clipZ / divisor,
      behindCamera: clipW <= 0,
      occluded,
    };
  });
}
