interface XhsMiniToolBridge {
  writeTempFile(input: { data: string }): Promise<{ filePath: string }>;
  saveImageToPhotosAlbum(input: { filePath: string }): Promise<void>;
}

interface Window {
  xhs?: { miniTool?: XhsMiniToolBridge };
}
