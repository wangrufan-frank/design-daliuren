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

export interface JadePlateGeneralMotion {
  nodeId: string;
  targetEarth: EarthlyBranch;
  visible: boolean;
  heightMeters: number;
  seatProgress: number;
  goldProgress: number;
}

export interface JadePlateMotion {
  monthAngleRad: number;
  activeMonthGeneralNodeId: `month-general/${string}`;
  activeMonthGoldProgress: number;
  generals: readonly JadePlateGeneralMotion[];
}

export interface ArtifactPose {
  nodes: Readonly<Record<string, ArtifactNodePose>>;
  jadePlate: JadePlateMotion;
  labelOpacity: Readonly<Record<string, number>>;
  courseTraceOpacity: number;
  generalDirection: GeneralDirection;
  generalSequence: readonly string[];
}
