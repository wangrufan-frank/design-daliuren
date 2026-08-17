import type { CalendarResult } from "../calendar/types";
import type { EarthlyBranch } from "../chart/types";
import type { FourLessonsResult } from "../four-lessons/types";
import { generalForHeaven } from "../heavenly-generals/policy";
import type { HeavenlyGeneralsResult } from "../heavenly-generals/types";
import type { ThreeTransmissionsResult } from "../three-transmissions/types";
import type { CourseResult } from "./types";

export const COURSE_LESSON_ORDER = ["fourth", "third", "second", "first"] as const;
export const COURSE_PALACE_ORDER = ["巳", "午", "未", "申", "酉", "戌", "亥", "子", "丑", "寅", "卯", "辰"] as const satisfies readonly EarthlyBranch[];

export class CourseProjectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CourseProjectionError";
  }
}

export function deriveCourse(
  locationName: string,
  calendar: CalendarResult,
  fourLessons: FourLessonsResult,
  transmissions: ThreeTransmissionsResult,
  generals: HeavenlyGeneralsResult,
): CourseResult {
  try {
    const lessonsById = new Map(fourLessons.lessons.map((lesson) => [lesson.id, lesson]));
    const placementsByEarth = new Map(generals.placements.map((placement) => [placement.earth, placement]));
    return {
      context: {
        civilDateTime: calendar.civilDateTime,
        effectiveGanzhiDate: calendar.effectiveGanzhiDate,
        locationName,
        lunarDateDisplay: calendar.lunarDate.display,
        pillars: {
          year: calendar.pillars.year.effective,
          month: calendar.pillars.month.effective,
          day: calendar.pillars.day.effective,
          hour: calendar.pillars.hour.effective,
        },
        monthBuild: calendar.monthBuild,
        monthGeneral: calendar.monthGeneral.effective,
        divinationHour: calendar.divinationHour.effective,
      },
      method: {
        method: transmissions.method,
        ...(transmissions.subtype ? { subtype: transmissions.subtype } : {}),
        variants: [...transmissions.variants],
      },
      transmissions: transmissions.transmissions.map((transmission) => ({
        position: transmission.position,
        label: transmission.label,
        branch: transmission.branch,
        relation: transmission.relation,
        general: generalForHeaven(generals, transmission.branch),
      })),
      lessons: COURSE_LESSON_ORDER.map((id) => {
        const lesson = lessonsById.get(id);
        if (!lesson) throw new CourseProjectionError(`四课结果缺少${id}`);
        return {
          id: lesson.id,
          label: lesson.label,
          upper: lesson.upper,
          lower: lesson.lower,
          general: generalForHeaven(generals, lesson.upper),
        };
      }),
      palaces: COURSE_PALACE_ORDER.map((earth) => {
        const placement = placementsByEarth.get(earth);
        if (!placement) throw new CourseProjectionError(`天将结果缺少${earth}宫`);
        return { earth, heaven: placement.heaven, general: placement.general, noble: earth === generals.nobleEarth };
      }),
      noble: {
        dayNight: generals.dayNight,
        nobleHeaven: generals.nobleHeaven,
        nobleEarth: generals.nobleEarth,
        direction: generals.direction,
      },
    };
  } catch (cause) {
    if (cause instanceof CourseProjectionError) throw cause;
    throw new CourseProjectionError(cause instanceof Error ? cause.message : "课式天将映射失败");
  }
}

const dayNightText = { day: "昼", night: "夜" } as const;
const directionText = { forward: "顺", reverse: "逆" } as const;

export function serializeCourseText(result: CourseResult): string {
  const method = [result.method.method, result.method.subtype, result.method.variants.length ? result.method.variants.join("/") : undefined]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
  return [
    "大六壬标准课式",
    `时间：${result.context.civilDateTime}`,
    `地点：${result.context.locationName}`,
    `农历：${result.context.lunarDateDisplay}`,
    `四柱：${result.context.pillars.year}　${result.context.pillars.month}　${result.context.pillars.day}　${result.context.pillars.hour}`,
    `月建：${result.context.monthBuild}`,
    `月将：${result.context.monthGeneral.name}（${result.context.monthGeneral.branch}）　占时：${result.context.divinationHour}`,
    "",
    `三传取法：${method}`,
    ...result.transmissions.map((item) => `${item.label}：${item.general}　${item.branch}　${item.relation}`),
    "",
    "四课",
    ...result.lessons.map((item) => `${item.label}：${item.general}　上神${item.upper}　下神${item.lower.value}`),
    "",
    "十二宫",
    ...result.palaces.map((item) => `${item.earth}宫：${item.general}　天盘${item.heaven}　地盘${item.earth}`),
    "",
    `贵人：${dayNightText[result.noble.dayNight]}贵${result.noble.nobleHeaven}　落${result.noble.nobleEarth}宫　${directionText[result.noble.direction]}布`,
  ].join("\n");
}
