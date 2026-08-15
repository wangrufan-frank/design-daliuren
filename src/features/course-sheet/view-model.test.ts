import { expect, it } from "vitest";
import { referenceSession } from "../../test/reference-session";
import { toCourseSheetModel } from "./view-model";

it("maps the reviewed reference into the confirmed section order", () => {
  const model = toCourseSheetModel(referenceSession);
  expect(model.lessonType).toBe("时课排盘");
  expect(model.sectionOrder).toEqual(["三传格局", "四课盘局", "天地盘式", "起课辅助"]);
  expect(model.transmissions.map((item) => item.label)).toEqual(["初传", "中传", "末传"]);
  expect(model.lessons.map((item) => item.label)).toEqual(["四课", "三课", "二课", "一课"]);
});
