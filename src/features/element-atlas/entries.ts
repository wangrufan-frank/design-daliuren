import type { CourseResult } from "../../domain/course/types";
import type { EarthlyBranch, HeavenlyStem } from "../../domain/chart/types";
import { BRANCH_ELEMENTS, STEM_ELEMENTS } from "../../domain/three-transmissions/foundations";
import { STEM_RESIDENCES } from "../../domain/four-lessons/policy";
import { branchStemEntries } from "./branches-stems";
import { generalElementEntries } from "./generals-elements";
import { conceptMethodEntries } from "./concepts-methods";
import type { AtlasEntry, AtlasId } from "./types";
export type { AtlasEntry, AtlasId } from "./types";
export { atlasArt } from "./art";

export const atlasEntries: readonly AtlasEntry[] = [...branchStemEntries, ...generalElementEntries, ...conceptMethodEntries];
const terms = new Map<string, AtlasId>();
for (const entry of atlasEntries) for (const alias of entry.aliases) terms.set(alias, entry.id);
export function atlasIdForTerm(value: string): AtlasId | undefined { return terms.get(value); }

export function atlasCourseContext(id: AtlasId, course: CourseResult): string[] {
  const entry = atlasEntries.find((item) => item.id === id);
  if (!entry) return [];
  const term = entry.aliases[0];
  const context = course.context;
  if (id === "void") return [`本课日柱为${context.pillars.day}，旬空为${context.voidBranches.join("、")}。`, "以本次课式标记为准，不能直接推出事情的结果。"];
  if (id === "plates" || term === "月将" || term === "占时") return [`月将为${context.monthGeneral.name}${context.monthGeneral.branch}，占时为${context.divinationHour}时。`, `天盘${context.monthGeneral.branch}加临地盘${context.divinationHour}宫，其余十一支依次排布。`];
  if (id === "noble" || term === "昼夜贵人" || term === "顺逆布将") return [`本课用${course.noble.dayNight === "day" ? "昼" : "夜"}贵，贵人乘天盘${course.noble.nobleHeaven}，落地盘${course.noble.nobleEarth}宫。`, `十二天将由此${course.noble.direction === "forward" ? "顺布" : "逆布"}。`];
  if (entry.category === "地支") {
    const branch = term as EarthlyBranch;
    const heaven = course.palaces.find((palace) => palace.heaven === branch);
    const earth = course.palaces.find((palace) => palace.earth === branch);
    const lines: string[] = [];
    if (heaven) lines.push(`天盘${branch}落在地盘${heaven.earth}宫，所乘天将为${heaven.general}。`);
    if (earth) lines.push(`地盘${branch}宫上方为天盘${earth.heaven}。`);
    lines.push(context.voidBranches.includes(branch) ? `${branch}属于本课旬空。` : `${branch}不属于本课旬空。`);
    return lines;
  }
  if (entry.category === "天将") {
    const palace = course.palaces.find((item) => item.general === term);
    return palace ? [`本课${term}乘天盘${palace.heaven}，落地盘${palace.earth}宫。`, `三传中所见位置：${course.transmissions.filter((item) => item.general === term).map((item) => item.label).join("、") || "未出现这一将"}。`] : ["本课十二宫未找到这一将，请以完整盘面为准。"];
  }
  if (entry.category === "天干") {
    const stem = term as HeavenlyStem;
    const labels = ["年柱", "月柱", "日柱", "时柱"];
    const columns = Object.values(context.pillars).map((value, index) => value[0] === stem ? labels[index] : "").filter(Boolean);
    return [`本课日干为${context.pillars.day[0]}；${columns.length ? `${stem}出现在${columns.join("、")}` : `四柱天干中未出现${stem}`}。`, `${stem}在十干寄宫规则中寄地盘${STEM_RESIDENCES[stem]}宫，不能把寄宫当作新增的盘支。`];
  }
  if (entry.category === "五行") return [`本课日干${context.pillars.day[0]}属${STEM_ELEMENTS[context.pillars.day[0] as HeavenlyStem]}。`, `三传中属${term}的有：${course.transmissions.filter((item) => BRANCH_ELEMENTS[item.branch] === term).map((item) => item.label + item.branch).join("、") || "无"}。`];
  if (entry.category === "六亲") return [`以本课日干${context.pillars.day[0]}为「我」确定六亲。`, `三传中标为${term}的有：${course.transmissions.filter((item) => item.relation === term).map((item) => item.label + item.branch).join("、") || "无"}。`];
  if (/^(method|subtype|variant)-/.test(entry.id)) {
    const current: (string | undefined)[] = [course.method.method, course.method.subtype, ...course.method.variants].filter(Boolean);
    return [`本课取传为${current.join(" · ")}。`, current.includes(term) ? `本条「${term}」是本课采用的分类，请结合四课与三传阅读。` : `本课未标为「${term}」，本条可作为其他取传情形的对照。`];
  }
  const lesson = course.lessons.find((item) => entry.aliases.includes(item.id === "fourth" ? "第四课" : item.label));
  if (lesson) return [`本课${lesson.label}下位为${lesson.lower.value}，上神为${lesson.upper}，所乘天将为${lesson.general}。`];
  const transmission = course.transmissions.find((item) => entry.aliases.includes(item.label));
  if (transmission) return [`本课${transmission.label}为${transmission.branch}，乘${transmission.general}，六亲为${transmission.relation}。`];
  if (term === "四课") return course.lessons.map((item) => `${item.label}：下${item.lower.value}、上${item.upper}，乘${item.general}。`);
  if (term === "三传") return course.transmissions.map((item) => `${item.label}为${item.branch}，乘${item.general}，六亲${item.relation}。`);
  if (term === "日干" || term === "寄宫") return [`本课日干为${context.pillars.day[0]}，寄地盘${STEM_RESIDENCES[context.pillars.day[0] as HeavenlyStem]}宫。`, `从寄宫向上读到${course.lessons.find((item) => item.id === "first")!.upper}，为第一课上神。`];
  if (term === "日支") return [`本课日支为${context.pillars.day[1]}，其上神为${course.lessons.find((item) => item.id === "third")!.upper}，由此起第三课。`];
  if (term === "本命") return [`本课本命为${context.natal.birthYear}年、${context.natal.branch}命，来源为${context.natal.source === "manual" ? "手动选择" : "自动换算"}。`];
  if (term === "月建") return [`本课月建为${context.monthBuild}，月将为${context.monthGeneral.name}${context.monthGeneral.branch}；两者换算口径不同。`];
  return [`本课四柱：${Object.values(context.pillars).join("、")}。`, `生效干支日为${context.effectiveGanzhiDate}；请结合本条说明回看课式。`];
}
