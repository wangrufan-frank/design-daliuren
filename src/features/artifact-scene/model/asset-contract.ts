export const ARTIFACT_ASSET_URLS = {
  0: "/models/daliuren/daliuren-artifact-lod0.glb",
  1: "/models/daliuren/daliuren-artifact-lod1.glb",
  2: "/models/daliuren/daliuren-artifact-lod2.glb",
} as const;

export const REQUIRED_NODE_IDS: readonly string[] = [
  "artifact/root",
  "base/body",
  "plate/earth",
  "plate/heaven",
  "calendar/slip",
  "lesson/first",
  "lesson/second",
  "lesson/third",
  "lesson/fourth",
  "transmission/bridge",
  "transmission/initial",
  "transmission/middle",
  "transmission/final",
  "general/noble",
  "general/snake",
  "general/vermilion-bird",
  "general/harmony",
  "general/hook-array",
  "general/azure-dragon",
  "general/void",
  "general/white-tiger",
  "general/constant",
  "general/black-tortoise",
  "general/yin",
  "general/queen-of-heaven",
  "anchor/course-copy/lessons",
  "anchor/course-copy/transmissions",
  "anchor/course-copy/generals",
];

export function selectArtifactLod(width: number, dpr: number): 0 | 1 | 2 {
  if (width < 700 || dpr >= 2.5) return 2;
  if (width < 1600 || dpr >= 1.5) return 1;
  return 0;
}
