import { EARTHLY_BRANCHES } from "../calendar/constants";
import type { EarthlyBranch, HeavenlyStem } from "../chart/types";
import type { HeavenEarthResult } from "../heaven-earth/types";
import type { GeneralDirection, HeavenlyGeneral, HeavenlyGeneralsEvidenceStep, HeavenlyGeneralsResult, NobleDayNight } from "./types";

export const DAY_BRANCHES = ["卯", "辰", "巳", "午", "未", "申"] as const;
export const FORWARD_NOBLE_EARTHS = ["亥", "子", "丑", "寅", "卯", "辰"] as const;
export const GENERAL_ORDER = ["贵人", "螣蛇", "朱雀", "六合", "勾陈", "青龙", "天空", "白虎", "太常", "玄武", "太阴", "天后"] as const satisfies readonly HeavenlyGeneral[];
export const NOBLE_BRANCHES = { 甲: { day: "丑", night: "未" }, 乙: { day: "子", night: "申" }, 丙: { day: "亥", night: "酉" }, 丁: { day: "亥", night: "酉" }, 戊: { day: "丑", night: "未" }, 己: { day: "子", night: "申" }, 庚: { day: "丑", night: "未" }, 辛: { day: "午", night: "寅" }, 壬: { day: "巳", night: "卯" }, 癸: { day: "巳", night: "卯" } } as const satisfies Record<HeavenlyStem, Record<NobleDayNight, EarthlyBranch>>;
export function classifyDayNight(hour: EarthlyBranch): NobleDayNight { return (DAY_BRANCHES as readonly EarthlyBranch[]).includes(hour) ? "day" : "night"; }
export function deriveHeavenlyGenerals(dayStem: HeavenlyStem, divinationHour: EarthlyBranch, plate: HeavenEarthResult): HeavenlyGeneralsResult {
  const dayNight = classifyDayNight(divinationHour); const nobleHeaven = NOBLE_BRANCHES[dayStem][dayNight];
  const matching = plate.palaces.filter(({ heaven }) => heaven === nobleHeaven); if (matching.length !== 1) throw new Error(`贵人天盘支${nobleHeaven}所临地盘宫不唯一`);
  if (!Number.isInteger(plate.offset) || plate.offset < 0 || plate.offset > 11 || plate.palaces.length !== 12 || !plate.palaces.every(({ earth, heaven }, index) => earth === EARTHLY_BRANCHES[index] && heaven === EARTHLY_BRANCHES[(index + plate.offset) % 12])) throw new Error("天地盘十二支布列无效");
  const nobleEarth = matching[0].earth; const direction: GeneralDirection = (FORWARD_NOBLE_EARTHS as readonly EarthlyBranch[]).includes(nobleEarth) ? "forward" : "reverse"; const movement = direction === "forward" ? 1 : -1; const nobleIndex = EARTHLY_BRANCHES.indexOf(nobleEarth);
  const placements = GENERAL_ORDER.map((general, order) => { const earth = EARTHLY_BRANCHES[(nobleIndex + movement * order + 12) % 12]; const palace = plate.palaces.find((item) => item.earth === earth); if (!palace) throw new Error(`天地盘缺少${earth}宫`); return { order, general, earth, heaven: palace.heaven, evidenceId: `hg-${String(order + 5).padStart(2, "0")}` }; });
  const evidence: HeavenlyGeneralsEvidenceStep[] = [
    { id: "hg-01", ruleId: "heavenly-generals/day-night-v1", phase: "day-night", input: `占时${divinationHour}`, conclusion: dayNight === "day" ? "卯至申为昼占" : "酉至寅为夜占", details: { divinationHour, dayNight } },
    { id: "hg-02", ruleId: "heavenly-generals/noble-branch-v1", phase: "noble-branch", input: `日干${dayStem}，${dayNight}`, conclusion: `取贵人天盘支${nobleHeaven}`, details: { dayStem, dayNight, dayNoble: NOBLE_BRANCHES[dayStem].day, nightNoble: NOBLE_BRANCHES[dayStem].night, selected: nobleHeaven } },
    { id: "hg-03", ruleId: "heavenly-generals/noble-palace-v1", phase: "noble-palace", input: `天盘${nobleHeaven}`, conclusion: `临地盘${nobleEarth}宫`, details: { nobleHeaven, nobleEarth } },
    { id: "hg-04", ruleId: "heavenly-generals/direction-v1", phase: "direction", input: `贵人临${nobleEarth}`, conclusion: direction === "forward" ? "六宫内顺布" : "六宫外逆布", details: { nobleEarth, direction } },
    ...placements.map((p, order) => ({ id: p.evidenceId, ruleId: "heavenly-generals/placement-v1" as const, phase: "placement" as const, input: `${p.general}为第${order + 1}将`, conclusion: `${p.general}临地盘${p.earth}、天盘${p.heaven}`, details: { order, general: p.general, ...(order > 0 ? { previousEarth: placements[order - 1].earth } : {}), earth: p.earth, heaven: p.heaven, direction } })),
  ]; return { dayStem, divinationHour, dayNight, nobleHeaven, nobleEarth, direction, placements, evidence };
}
export function generalForEarth(result: HeavenlyGeneralsResult, earth: EarthlyBranch): HeavenlyGeneral { const p = result.placements.find((item) => item.earth === earth); if (!p) throw new Error(`天将结果缺少地盘${earth}宫`); return p.general; }
export function generalForHeaven(result: HeavenlyGeneralsResult, heaven: EarthlyBranch): HeavenlyGeneral { const p = result.placements.find((item) => item.heaven === heaven); if (!p) throw new Error(`天将结果缺少天盘${heaven}支`); return p.general; }
