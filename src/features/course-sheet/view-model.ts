import type { CourseResult, CourseSession } from "../../domain/chart/types";
import { validateSession } from "../../domain/chart/snapshots";

const lessonTypes = new Set<unknown>(["时课排盘", "日课排盘", "月课排盘"]);
const transmissionLabels = ["初传", "中传", "末传"] as const;
const lessonLabels = ["四课", "三课", "二课", "一课"] as const;
const earthlyBranches = new Set<unknown>(["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCourseResult(value: unknown): value is CourseResult {
  if (!isRecord(value) || !lessonTypes.has(value.lessonType)) return false;
  if (
    !Array.isArray(value.transmissions)
    || value.transmissions.length !== transmissionLabels.length
    || !value.transmissions.every((item, index) => (
      isRecord(item)
      && item.label === transmissionLabels[index]
      && typeof item.value === "string"
      && typeof item.relation === "string"
      && typeof item.general === "string"
    ))
  ) return false;
  if (
    !Array.isArray(value.lessons)
    || value.lessons.length !== lessonLabels.length
    || !value.lessons.every((item, index) => (
      isRecord(item)
      && item.label === lessonLabels[index]
      && typeof item.upper === "string"
      && typeof item.lower === "string"
      && typeof item.general === "string"
    ))
  ) return false;
  if (
    !Array.isArray(value.palaces)
    || value.palaces.length !== 12
    || !value.palaces.every((item) => (
      isRecord(item)
      && earthlyBranches.has(item.branch)
      && earthlyBranches.has(item.heaven)
      && typeof item.general === "string"
    ))
  ) return false;
  if (
    new Set(value.palaces.map((item) => item.branch)).size !== 12
    || new Set(value.palaces.map((item) => item.heaven)).size !== 12
  ) return false;
  return isRecord(value.auxiliary) && Object.values(value.auxiliary).every((item) => typeof item === "string");
}

export interface CourseSheetModel {
  civilDateTime: string;
  lessonType: string;
  sectionOrder: readonly ["三传格局", "四课盘局", "天地盘式", "起课辅助"];
  transmissions: readonly { label: string; value: string; relation: string; general: string }[];
  lessons: readonly { label: string; upper: string; lower: string; general: string }[];
  palaces: readonly { branch: string; heaven: string; general: string }[];
  auxiliary: Readonly<Record<string, string>>;
}

export function toCourseSheetModel(session: CourseSession): CourseSheetModel {
  const errors = validateSession(session);
  if (errors.length) throw new Error(errors.join("；"));
  const snapshot = session.snapshots.course;
  if (!snapshot) throw new Error("缺少最终课式快照");
  if (!isCourseResult(snapshot.value)) throw new Error("最终课式快照结构无效");
  const result = snapshot.value;
  return {
    civilDateTime: session.input.civilDateTime,
    lessonType: result.lessonType,
    sectionOrder: ["三传格局", "四课盘局", "天地盘式", "起课辅助"],
    transmissions: result.transmissions,
    lessons: result.lessons,
    palaces: result.palaces,
    auxiliary: result.auxiliary,
  };
}
