import type { ArtifactSourceResults } from "../../features/artifact-scene/model/types";

export const EARTHLY_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"] as const;

export interface ArtifactBlueprint {
  base: { width: number; depth: number };
  earth: { size: number };
  heaven: { radius: number; angleRad: number; branchRadius: number; interactionInnerRadius: number; interactionOuterRadius: number };
  branches: readonly { label: string; angle: number }[];
  generals: readonly { label: string; angle: number; innerRadius: number; outerRadius: number; labelRadius: number }[];
  beads: readonly { angle: number; radius: number; fixedTo: "earth" }[];
  zoom: { minDistance: number; maxDistance: number };
  budget: { triangles: number; drawCalls: number; textureSize: number };
}

export function createArtifactBlueprint(source: ArtifactSourceResults): ArtifactBlueprint {
  const generalsByEarth = new Map(source.generals.placements.map((item) => [item.earth, item.general]));
  return {
    base: { width: 12.2, depth: 12.2 },
    earth: { size: 10.8 },
    heaven: {
      radius: 3.8,
      angleRad: source.plate.offset * Math.PI / 6,
      branchRadius: 3.18,
      interactionInnerRadius: 2.7,
      interactionOuterRadius: 3.75,
    },
    branches: EARTHLY_BRANCHES.map((branch, index) => ({ label: branch, angle: Math.PI + index * Math.PI / 6 })),
    generals: EARTHLY_BRANCHES.map((branch, index) => ({
      label: generalsByEarth.get(branch) || "玉",
      angle: Math.PI + index * Math.PI / 6,
      innerRadius: 1.82,
      outerRadius: 2.62,
      labelRadius: 2.22,
    })),
    beads: [0, 1, 2, 3].map((index) => ({ angle: Math.PI / 4 + index * Math.PI / 2, radius: 4.55, fixedTo: "earth" as const })),
    zoom: { minDistance: 12, maxDistance: 36 },
    budget: { triangles: 3000, drawCalls: 44, textureSize: 1024 },
  };
}
