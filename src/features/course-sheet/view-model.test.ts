import { expect, it } from "vitest";
import type { CourseResult, CourseSession } from "../../domain/chart/types";
import { referenceSession } from "../../test/reference-session";
import { toCourseSheetModel } from "./view-model";

const referenceCourse = referenceSession.snapshots.course?.value as CourseResult;

function withCourse(value: unknown): CourseSession {
  const snapshot = referenceSession.snapshots.course;
  if (!snapshot) throw new Error("测试夹具缺少最终课式快照");
  return {
    ...referenceSession,
    snapshots: { ...referenceSession.snapshots, course: { ...snapshot, value } },
  };
}

it("maps the reviewed reference into the confirmed section order", () => {
  const model = toCourseSheetModel(referenceSession);
  expect(model.lessonType).toBe("时课排盘");
  expect(model.sectionOrder).toEqual(["三传格局", "四课盘局", "天地盘式", "起课辅助"]);
  expect(model.transmissions.map((item) => item.label)).toEqual(["初传", "中传", "末传"]);
  expect(model.lessons.map((item) => item.label)).toEqual(["四课", "三课", "二课", "一课"]);
});

it.each([
  { name: "null course", value: null },
  { name: "missing arrays", value: { lessonType: "时课排盘" } },
  { name: "invalid lesson type", value: { ...referenceCourse, lessonType: "即时排盘" } },
  {
    name: "wrong transmission label order",
    value: {
      ...referenceCourse,
      transmissions: referenceCourse.transmissions.map((item, index) => (
        index === 0 ? { ...item, label: "中传" } : item
      )),
    },
  },
  {
    name: "wrong lesson label order",
    value: {
      ...referenceCourse,
      lessons: referenceCourse.lessons.map((item, index) => (
        index === 0 ? { ...item, label: "一课" } : item
      )),
    },
  },
  {
    name: "invalid earthly branch",
    value: {
      ...referenceCourse,
      palaces: referenceCourse.palaces.map((item, index) => (
        index === 0 ? { ...item, branch: "甲" } : item
      )),
    },
  },
  { name: "null auxiliary", value: { ...referenceCourse, auxiliary: null } },
  { name: "non-string auxiliary value", value: { ...referenceCourse, auxiliary: { 驿马: 12 } } },
])("rejects $name with a predictable error", ({ value }) => {
  expect(() => toCourseSheetModel(withCourse(value))).toThrowError("最终课式快照结构无效");
});
