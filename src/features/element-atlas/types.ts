import type { CourseResult } from "../../domain/course/types";

export type AtlasId = string;
export type AtlasCategory = "天干" | "地支" | "天将" | "五行" | "六亲" | "盘式" | "取传";
export interface AtlasEntry {
  id: AtlasId;
  title: string;
  glyph: string;
  category: AtlasCategory;
  subtitle: string;
  summary: string;
  history: string;
  meaning: string;
  caution: string;
  sources: string[];
  aliases: string[];
  image: string;
  position: string;
}
export type AtlasCourse = CourseResult;
