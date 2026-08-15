import type { CourseResult, CourseSession } from "../../domain/chart/types";
import { validateSession } from "../../domain/chart/snapshots";

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
  const result = snapshot.value as CourseResult;
  if (!result.lessonType || result.transmissions.length !== 3 || result.lessons.length !== 4 || result.palaces.length !== 12) {
    throw new Error("最终课式快照结构无效");
  }
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
