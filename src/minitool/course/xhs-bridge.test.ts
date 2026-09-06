import { afterEach, describe, expect, it, vi } from "vitest";
import { saveCourseImage } from "./xhs-bridge";

describe("saveCourseImage", () => {
  afterEach(() => { delete window.xhs; });

  it("writes the full data URI before saving its temporary path", async () => {
    const writeTempFile = vi.fn().mockResolvedValue({ filePath: "tmp/course.png" });
    const saveImageToPhotosAlbum = vi.fn().mockResolvedValue(undefined);
    window.xhs = { miniTool: { writeTempFile, saveImageToPhotosAlbum } };
    await saveCourseImage("data:image/png;base64,QUJD");
    expect(writeTempFile).toHaveBeenCalledWith({ data: "data:image/png;base64,QUJD" });
    expect(saveImageToPhotosAlbum).toHaveBeenCalledWith({ filePath: "tmp/course.png" });
    expect(writeTempFile.mock.invocationCallOrder[0]).toBeLessThan(saveImageToPhotosAlbum.mock.invocationCallOrder[0]);
  });

  it("reports a missing container bridge", async () => {
    await expect(saveCourseImage("data:image/png;base64,QUJD")).rejects.toThrow("请在小工具容器内保存");
  });
});
