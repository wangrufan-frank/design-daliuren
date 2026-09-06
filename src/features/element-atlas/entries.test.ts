import { expect, it } from "vitest";
import { atlasEntries, atlasArt, atlasIdForTerm, atlasCourseContext } from "./entries";
import { referenceSession } from "../../test/reference-session";
import type { CourseResult } from "../../domain/course/types";

it("covers every displayed element and transmission classification", () => {
  const groups = ["甲乙丙丁戊己庚辛壬癸".split(""), "子丑寅卯辰巳午未申酉戌亥".split(""), "木火土金水".split(""), ["贵人", "螣蛇", "朱雀", "六合", "勾陈", "青龙", "天空", "白虎", "太常", "玄武", "太阴", "天后"], ["父母", "子孙", "官鬼", "妻财", "兄弟"], ["贼克", "比用", "涉害", "遥克", "昴星", "别责", "八专", "伏吟", "反吟"], ["始入", "元首", "重审", "知一", "见机", "察微", "缀瑕", "蒿矢", "弹射", "虎视", "冬蛇掩目", "不虞", "自任", "自信", "井栏", "复等", "杜传"], ["神后", "大吉", "功曹", "太冲", "天罡", "太乙", "胜光", "小吉", "传送", "从魁", "河魁", "登明", "四课", "三传", "初传", "中传", "末传", "月将", "月建", "占时", "本命", "旬空"]];
  for (const term of groups.flat()) expect(atlasIdForTerm(term), term).toBeTruthy();
});
it("has complete distinct content, unique aliases and credited artwork", () => {
  const ids = new Set<string>();
  const aliases = new Set<string>();
  for (const entry of atlasEntries) {
    expect(ids.has(entry.id), entry.id).toBe(false); ids.add(entry.id);
    for (const field of [entry.summary, entry.history, entry.meaning, entry.caution]) expect(field.length, entry.id).toBeGreaterThan(18);
    expect(entry.sources.length).toBeGreaterThan(0);
    expect(atlasArt[entry.image as keyof typeof atlasArt], entry.image).toBeTruthy();
    for (const alias of (entry as typeof entry & { aliases: string[] }).aliases) {
      expect(aliases.has(alias), alias).toBe(false); aliases.add(alias);
      expect(atlasIdForTerm(alias)).toBe(entry.id);
    }
  }
});
it("reports actual positions for expanded entries without falling back to Hai", () => {
  const course = referenceSession.snapshots.course!.value as CourseResult;
  const palace = course.palaces.find(item => item.heaven === "午")!;
  expect(atlasCourseContext(atlasIdForTerm("午")!, course).join(" ")).toContain(`天盘午落在地盘${palace.earth}宫`);
  const generalPalace = course.palaces.find(item => item.general === "青龙")!;
  expect(atlasCourseContext(atlasIdForTerm("青龙")!, course).join(" ")).toContain(generalPalace.earth);
  expect(atlasCourseContext("missing-entry", course)).toEqual([]);
});
it("shows transmission facts and finds lesson roles regardless of display order", () => {
  const course = referenceSession.snapshots.course!.value as CourseResult;
  for (const transmission of course.transmissions) {
    const lines = atlasCourseContext(atlasIdForTerm(transmission.label)!, course).join(" ");
    expect(lines).toContain(`本课${transmission.label}为${transmission.branch}`);
    expect(lines).toContain(transmission.general);
  }
  expect(atlasCourseContext(atlasIdForTerm("三传")!, course)).toHaveLength(3);
  const first = course.lessons.find(item => item.id === "first")!;
  const third = course.lessons.find(item => item.id === "third")!;
  expect(atlasCourseContext(atlasIdForTerm("日干")!, course).join(" ")).toContain(`向上读到${first.upper}`);
  expect(atlasCourseContext(atlasIdForTerm("日支")!, course).join(" ")).toContain(`其上神为${third.upper}`);
});
