import { describe, expect, it } from "vitest";
import type { CourseResult } from "../../domain/course/types";
import { referenceSession } from "../../test/reference-session";
import { courseImageText, renderCourseImage } from "./render-course-image";

const result = referenceSession.snapshots.course!.value as CourseResult;

describe("renderCourseImage", () => {
  it("includes the full course and emits a PNG data URI", () => {
    const drawn: string[] = [];
    const context = new Proxy({
      createLinearGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {},
      fillText(value: string) { drawn.push(value); },
    }, { set: () => true }) as unknown as CanvasRenderingContext2D;
    const canvas = { getContext: () => context, toDataURL: () => "data:image/png;base64,QUJDRA==" } as unknown as HTMLCanvasElement;
    const uri = renderCourseImage(result, () => canvas);
    const expected = courseImageText(result);
    expect(expected).toContain("大六壬 · 标准文字课式");
    for (const item of result.transmissions) expect(expected).toContain(item.label);
    for (const item of result.lessons) expect(expected).toContain(item.label);
    for (const item of result.palaces) expect(expected).toContain(item.earth);
    expect(drawn.join(" ")).toContain("十二宫方盘");
    expect(uri).toMatch(/^data:image\/png;base64,/);
    expect((uri.length * 3) / 4).toBeLessThan(1024 * 1024);
  });
});
