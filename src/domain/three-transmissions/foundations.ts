import type { EarthlyBranch, HeavenlyStem } from "../chart/types";
import type { HeavenEarthResult } from "../heaven-earth/types";
import type { FiveElement, Polarity, SixRelation } from "./types";

export const STEM_COMBINATIONS = {
  甲: "己", 己: "甲", 乙: "庚", 庚: "乙", 丙: "辛",
  辛: "丙", 丁: "壬", 壬: "丁", 戊: "癸", 癸: "戊",
} as const;

export const STEM_ELEMENTS = {
  甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土",
  己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水",
} as const satisfies Record<HeavenlyStem, FiveElement>;

export const BRANCH_ELEMENTS = {
  子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火",
  午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水",
} as const satisfies Record<EarthlyBranch, FiveElement>;

export const STEM_POLARITIES = {
  甲: "yang", 乙: "yin", 丙: "yang", 丁: "yin", 戊: "yang",
  己: "yin", 庚: "yang", 辛: "yin", 壬: "yang", 癸: "yin",
} as const satisfies Record<HeavenlyStem, Polarity>;

export const BRANCH_POLARITIES = {
  子: "yang", 丑: "yin", 寅: "yang", 卯: "yin", 辰: "yang", 巳: "yin",
  午: "yang", 未: "yin", 申: "yang", 酉: "yin", 戌: "yang", 亥: "yin",
} as const satisfies Record<EarthlyBranch, Polarity>;

export const PUNISHMENTS = {
  子: "卯", 丑: "戌", 寅: "巳", 卯: "子",
  辰: "辰", 巳: "申", 午: "午", 未: "丑",
  申: "寅", 酉: "酉", 戌: "未", 亥: "亥",
} as const satisfies Record<EarthlyBranch, EarthlyBranch>;

export const CLASHES = {
  子: "午", 丑: "未", 寅: "申", 卯: "酉", 辰: "戌", 巳: "亥",
  午: "子", 未: "丑", 申: "寅", 酉: "卯", 戌: "辰", 亥: "巳",
} as const satisfies Record<EarthlyBranch, EarthlyBranch>;

export const TRINE_NEXT_BRANCHES = {
  子: "辰", 丑: "巳", 寅: "午", 卯: "未", 辰: "申", 巳: "酉",
  午: "戌", 未: "亥", 申: "子", 酉: "丑", 戌: "寅", 亥: "卯",
} as const satisfies Record<EarthlyBranch, EarthlyBranch>;

export const POST_HORSES = {
  申: "寅", 子: "寅", 辰: "寅",
  寅: "申", 午: "申", 戌: "申",
  巳: "亥", 酉: "亥", 丑: "亥",
  亥: "巳", 卯: "巳", 未: "巳",
} as const satisfies Record<EarthlyBranch, EarthlyBranch>;

export function elementOfStem(stem: HeavenlyStem): FiveElement {
  return STEM_ELEMENTS[stem];
}

export function elementOfBranch(branch: EarthlyBranch): FiveElement {
  return BRANCH_ELEMENTS[branch];
}

export function polarityOfStem(stem: HeavenlyStem): Polarity {
  return STEM_POLARITIES[stem];
}

export function polarityOfBranch(branch: EarthlyBranch): Polarity {
  return BRANCH_POLARITIES[branch];
}

const GENERATES: Readonly<Record<FiveElement, FiveElement>> = {
  木: "火", 火: "土", 土: "金", 金: "水", 水: "木",
};

const OVERCOMES: Readonly<Record<FiveElement, FiveElement>> = {
  木: "土", 火: "金", 土: "水", 金: "木", 水: "火",
};

export function relationFor(stem: HeavenlyStem, branch: EarthlyBranch): SixRelation {
  const stemElement = elementOfStem(stem);
  const branchElement = elementOfBranch(branch);
  if (stemElement === branchElement) return "兄弟";
  if (GENERATES[stemElement] === branchElement) return "子孙";
  if (GENERATES[branchElement] === stemElement) return "父母";
  if (OVERCOMES[stemElement] === branchElement) return "妻财";
  return "官鬼";
}

export function punishmentOf(branch: EarthlyBranch): EarthlyBranch {
  return PUNISHMENTS[branch];
}

export function clashOf(branch: EarthlyBranch): EarthlyBranch {
  return CLASHES[branch];
}

export function nextTrineBranch(branch: EarthlyBranch): EarthlyBranch {
  return TRINE_NEXT_BRANCHES[branch];
}

export function postHorseOf(branch: EarthlyBranch): EarthlyBranch {
  return POST_HORSES[branch];
}

function uniquePalace(
  plate: HeavenEarthResult,
  matches: (palace: HeavenEarthResult["palaces"][number]) => boolean,
  description: string,
): HeavenEarthResult["palaces"][number] {
  const palaces = plate.palaces.filter(matches);
  if (palaces.length !== 1) throw new Error(`天地盘${description}${palaces.length === 0 ? "不存在" : "重复"}`);
  return palaces[0];
}

export function heavenAt(plate: HeavenEarthResult, earth: EarthlyBranch): EarthlyBranch {
  return uniquePalace(plate, (palace) => palace.earth === earth, `地支 ${earth}`).heaven;
}

export function earthUnder(plate: HeavenEarthResult, heaven: EarthlyBranch): EarthlyBranch {
  return uniquePalace(plate, (palace) => palace.heaven === heaven, `天支 ${heaven}`).earth;
}
