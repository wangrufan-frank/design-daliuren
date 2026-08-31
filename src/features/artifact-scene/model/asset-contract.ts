export const ARTIFACT_ASSET_URLS = {
  0: `${import.meta.env.BASE_URL}models/daliuren/daliuren-artifact-lod0.glb`,
  1: `${import.meta.env.BASE_URL}models/daliuren/daliuren-artifact-lod1.glb`,
  2: `${import.meta.env.BASE_URL}models/daliuren/daliuren-artifact-lod2.glb`,
} as const;

const BRANCHES = [..."子丑寅卯辰巳午未申酉戌亥"] as const;
const MONTH_GENERALS = [
  "胜光", "小吉", "传送", "从魁", "河魁", "登明",
  "神后", "大吉", "功曹", "太冲", "天罡", "太乙",
] as const;

export const REQUIRED_NODE_IDS: readonly string[] = [
  "artifact/root",
  "base/body",
  "plate/earth",
  "plate/heaven",
  "plate/generals",
  "plate/core",
  "calendar/slip",
  "lesson/first",
  "lesson/second",
  "lesson/third",
  "lesson/fourth",
  "transmission/initial",
  "transmission/middle",
  "transmission/final",
  "transmission/method",
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
  ...BRANCHES.map((branch) => `branch/earth/${branch}`),
  ...BRANCHES.map((branch) => `general-slot/${branch}`),
  ...MONTH_GENERALS.map((month) => `month-general/${month}`),
  "interaction/month-general-ring",
  "trace/course",
];

export function selectArtifactLod(width: number, dpr: number): 0 | 1 | 2 {
  if (width < 700 || dpr >= 2.5) return 2;
  if (width < 1600 || dpr >= 1.5) return 1;
  return 0;
}
