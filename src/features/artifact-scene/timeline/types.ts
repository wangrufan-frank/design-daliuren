import type { EarthlyBranch } from "../../../domain/chart/types";
import type { GeneralDirection } from "../../../domain/heavenly-generals/types";

export interface ArtifactNodePose {
  translationX: number;
  translationY: number;
  translationZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  visible?: boolean;
  targetEarth?: EarthlyBranch;
}

export interface ArtifactPose {
  nodes: Readonly<Record<string, ArtifactNodePose>>;
  labelOpacity: Readonly<Record<string, number>>;
  courseTraceOpacity: number;
  generalDirection: GeneralDirection;
  generalSequence: readonly string[];
}
