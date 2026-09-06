export async function saveCourseImage(data: string): Promise<void> {
  const bridge = window.xhs?.miniTool;
  if (!bridge) throw new Error("请在小工具容器内保存");
  const { filePath } = await bridge.writeTempFile({ data });
  await bridge.saveImageToPhotosAlbum({ filePath });
}
