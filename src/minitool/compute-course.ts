import { LunarTypescriptAdapter } from "../adapters/calendar/lunar-typescript-adapter";
import { runCalendarStage } from "../domain/calendar/compute-calendar";
import type { CourseInput, CourseSession } from "../domain/chart/types";
import { runCourseStage } from "../domain/course/compute-course";
import { runFourLessonsStage } from "../domain/four-lessons/compute-four-lessons";
import { runHeavenEarthStage } from "../domain/heaven-earth/compute-heaven-earth";
import { runHeavenlyGeneralsStage } from "../domain/heavenly-generals/compute-heavenly-generals";
import { runThreeTransmissionsStage } from "../domain/three-transmissions/compute-three-transmissions";
import type { ArtifactSourceResults } from "../features/artifact-scene/model/types";

const adapter = new LunarTypescriptAdapter();
export type MiniToolCourseOutcome = { ok: true; source: ArtifactSourceResults } | { ok: false; message: string };

export function computeMiniToolCourse(input: CourseInput): MiniToolCourseOutcome {
  try {
    const session: CourseSession = { input, snapshots: {} };
    const calendar = runCalendarStage(session, adapter);
    if (!calendar.ok) return { ok: false, message: calendar.error.message };
    const plate = runHeavenEarthStage(calendar.session);
    if (!plate.ok) return { ok: false, message: plate.error.message };
    const lessons = runFourLessonsStage(plate.session);
    if (!lessons.ok) return { ok: false, message: lessons.error.message };
    const transmissions = runThreeTransmissionsStage(lessons.session);
    if (!transmissions.ok) return { ok: false, message: transmissions.error.message };
    const generals = runHeavenlyGeneralsStage(transmissions.session);
    if (!generals.ok) return { ok: false, message: generals.error.message };
    const course = runCourseStage(generals.session);
    if (!course.ok) return { ok: false, message: course.error.message };
    return {
      ok: true,
      source: {
        calendar: calendar.value,
        plate: plate.value,
        lessons: lessons.value,
        transmissions: transmissions.value,
        generals: generals.value,
        course: course.value,
      },
    };
  } catch {
    return { ok: false, message: "课式生成失败，请检查输入" };
  }
}
