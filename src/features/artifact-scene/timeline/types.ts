import type { EarthlyBranch } from "../../../domain/chart/types";
import type { GeneralDirection } from "../../../domain/heavenly-generals/types";

export interface ArtifactNodePose {
  translationX: number;
  translationY: number;
  translationZ: number;
  rotationZ: number;
  targetEarth?: EarthlyBranch;
}

export interface ArtifactCopyPose {
  opacity: number;
  sourceLineProgress: number;
  sourceLineOpacity: number;
}

export interface ArtifactPose {
  nodes: Readonly<Record<string, ArtifactNodePose>>;
  copy: Readonly<{
    lessons: ArtifactCopyPose;
    transmissions: ArtifactCopyPose;
    generals: ArtifactCopyPose;
  }>;
  generalDirection: GeneralDirection;
  generalSequence: readonly string[];
  cameraOrbitRequested: boolean;
}
