import type { MonthGeneralName } from "../../../domain/calendar/types";
import type { EarthlyBranch } from "../../../domain/chart/types";
import type { GeneralDirection, HeavenlyGeneral } from "../../../domain/heavenly-generals/types";
import type { ArtifactDisplayState } from "./types";

export const DETENT_RADIANS = Math.PI / 6;

export const MONTH_GENERAL_NODE_IDS = {
  登明: "month-general/登明", 河魁: "month-general/河魁", 从魁: "month-general/从魁",
  传送: "month-general/传送", 小吉: "month-general/小吉", 胜光: "month-general/胜光",
  太乙: "month-general/太乙", 天罡: "month-general/天罡", 太冲: "month-general/太冲",
  功曹: "month-general/功曹", 大吉: "month-general/大吉", 神后: "month-general/神后",
} as const satisfies Record<MonthGeneralName, `month-general/${MonthGeneralName}`>;

export const GENERAL_NODE_IDS = {
  贵人: "general/noble", 螣蛇: "general/snake", 朱雀: "general/vermilion-bird", 六合: "general/harmony",
  勾陈: "general/hook-array", 青龙: "general/azure-dragon", 天空: "general/void", 白虎: "general/white-tiger",
  太常: "general/constant", 玄武: "general/black-tortoise", 太阴: "general/yin", 天后: "general/queen-of-heaven",
} as const satisfies Record<HeavenlyGeneral, `general/${string}`>;

export const GENERAL_LABEL_IDS = Object.fromEntries(
  Object.entries(GENERAL_NODE_IDS).map(([general, id]) => [general, `dynamic/${id}`]),
) as Record<HeavenlyGeneral, `dynamic/general/${string}`>;

export interface JadePlateGeneralLayout {
  sequenceIndex: number;
  nodeId: `general/${string}`;
  labelId: `dynamic/general/${string}`;
  general: HeavenlyGeneral;
  earth: EarthlyBranch;
}

export interface JadePlateLayout {
  correctDetent: number;
  correctAngleRad: number;
  activeMonthGeneralNodeId: `month-general/${MonthGeneralName}`;
  direction: GeneralDirection;
  generalSequence: readonly JadePlateGeneralLayout[];
}

export function deriveJadePlateLayout(state: ArtifactDisplayState): JadePlateLayout {
  if (!Number.isInteger(state.plate.offset) || state.plate.offset < 0 || state.plate.offset > 11) {
    throw new Error(`Invalid jade-plate offset ${state.plate.offset}`);
  }
  const ordered = [...state.generals].sort((a, b) => a.order - b.order);
  if (ordered.length !== 12 || ordered[0]?.general !== "贵人") {
    throw new Error("Jade-plate general sequence must contain twelve placements led by 贵人");
  }
  return Object.freeze({
    correctDetent: state.plate.offset,
    correctAngleRad: state.plate.offset * DETENT_RADIANS,
    activeMonthGeneralNodeId: MONTH_GENERAL_NODE_IDS[state.calendar.monthGeneral],
    direction: state.noble.direction,
    generalSequence: Object.freeze(ordered.map((placement, sequenceIndex) => Object.freeze({
      sequenceIndex,
      nodeId: GENERAL_NODE_IDS[placement.general],
      labelId: GENERAL_LABEL_IDS[placement.general],
      general: placement.general,
      earth: placement.earth,
    }))),
  });
}
