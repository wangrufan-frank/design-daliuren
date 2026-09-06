import type { CourseResult } from "../../domain/course/types";

const PALACE_ORDER = ["巳", "午", "未", "申", "辰", "酉", "卯", "戌", "寅", "丑", "子", "亥"] as const;
const PALACE_CELLS = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [3, 1], [0, 2], [3, 2], [0, 3], [1, 3], [2, 3], [3, 3]] as const;

function text(context: CanvasRenderingContext2D, value: string, x: number, y: number, size = 24, align: CanvasTextAlign = "left") {
  context.fillStyle = "#e5dbc0";
  context.font = `500 ${size}px serif`;
  context.textAlign = align;
  context.textBaseline = "middle";
  context.fillText(value, x, y);
}

export function courseImageText(result: CourseResult): string[] {
  const output = [
    "大六壬 · 标准文字课式",
    result.context.civilDateTime,
    Object.values(result.context.pillars).join(" "),
  ];
  result.transmissions.forEach((item) => output.push(item.label, item.branch, item.relation, item.general));
  result.lessons.forEach((item) => output.push(item.label, item.upper, item.lower.value, item.general));
  result.palaces.forEach((item) => output.push(item.earth, item.heaven, item.general));
  return output;
}

export function renderCourseImage(result: CourseResult, makeCanvas: () => HTMLCanvasElement = () => document.createElement("canvas")): string {
  const canvas = makeCanvas();
  canvas.width = 720;
  canvas.height = 1280;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法生成课式图片");
  const gradient = context.createLinearGradient(0, 0, 720, 1280);
  gradient.addColorStop(0, "#183f39");
  gradient.addColorStop(1, "#0d2926");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 720, 1280);
  context.strokeStyle = "#9e8251";
  context.lineWidth = 2;
  context.strokeRect(24, 24, 672, 1232);

  text(context, "大六壬 · 标准文字课式", 360, 72, 36, "center");
  text(context, result.context.lunarDateDisplay, 360, 118, 22, "center");
  text(context, `北京时间 ${result.context.civilDateTime}`, 48, 170, 22);
  text(context, `四柱 ${Object.values(result.context.pillars).join("　")}`, 48, 208, 24);
  text(context, `月将 ${result.context.monthGeneral.name}${result.context.monthGeneral.branch}　占时 ${result.context.divinationHour}时　旬空 ${result.context.voidBranches.join("、")}`, 48, 246, 21);

  text(context, `三传 · ${result.method.method}${result.method.subtype ? ` · ${result.method.subtype}` : ""}`, 48, 304, 28);
  result.transmissions.forEach((item, index) => {
    const x = 72 + index * 214;
    context.fillStyle = "rgba(218,231,216,.1)";
    context.fillRect(x, 338, 180, 112);
    text(context, item.label, x + 90, 365, 20, "center");
    text(context, `${item.general}  ${item.branch}`, x + 90, 402, 28, "center");
    text(context, item.relation, x + 90, 432, 18, "center");
  });

  text(context, "四课", 48, 500, 28);
  result.lessons.forEach((item, index) => {
    const x = 48 + index * 162;
    context.strokeStyle = "rgba(218,231,216,.3)";
    context.strokeRect(x, 530, 138, 132);
    text(context, item.label, x + 69, 552, 18, "center");
    text(context, item.general, x + 69, 582, 20, "center");
    text(context, `${item.upper} / ${item.lower.value}`, x + 69, 625, 30, "center");
  });

  text(context, "十二宫方盘　上南 · 下北 · 左东 · 右西", 48, 718, 25);
  const byEarth = new Map(result.palaces.map((item) => [item.earth, item]));
  const left = 80;
  const top = 754;
  const cell = 140;
  PALACE_ORDER.forEach((branch, index) => {
    const item = byEarth.get(branch)!;
    const [column, row] = PALACE_CELLS[index];
    const x = left + column * cell;
    const y = top + row * cell;
    context.fillStyle = item.noble ? "rgba(196,168,105,.22)" : "rgba(218,231,216,.1)";
    context.fillRect(x, y, cell - 5, cell - 5);
    context.strokeStyle = "rgba(218,231,216,.32)";
    context.strokeRect(x, y, cell - 5, cell - 5);
    text(context, item.general, x + 67, y + 30, 22, "center");
    text(context, `天 ${item.heaven}`, x + 67, y + 68, 22, "center");
    text(context, `地 ${item.earth}`, x + 67, y + 104, 22, "center");
  });
  context.fillStyle = "rgba(10,37,34,.75)";
  context.fillRect(left + cell, top + cell, cell * 2 - 5, cell * 2 - 5);
  text(context, `${result.context.monthGeneral.name}${result.context.monthGeneral.branch}`, left + cell * 2, top + cell * 1.75, 30, "center");
  text(context, `${result.noble.dayNight === "day" ? "昼" : "夜"}贵 · ${result.noble.direction === "forward" ? "顺布" : "逆布"}`, left + cell * 2, top + cell * 2.15, 22, "center");
  text(context, result.context.reason, 360, 1230, 20, "center");
  return canvas.toDataURL("image/png");
}
