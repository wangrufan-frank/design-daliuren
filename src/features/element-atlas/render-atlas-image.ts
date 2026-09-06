type AtlasImageInput = {
  title: string;
  summary: string;
  meaning: string;
  imageUrl: string;
  credit: string;
};

function loadArtwork(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const finish = (error?: Error) => {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (error) reject(error);
      else resolve(image);
    };
    const timer = setTimeout(() => finish(new Error("图片加载超时，请重试")), 10000);
    image.onload = () => finish(image.naturalWidth && image.naturalHeight ? undefined : new Error("图片加载失败，请重试"));
    image.onerror = () => finish(new Error("图片加载失败，请重试"));
    image.src = url;
  });
}

function wrapText(context: CanvasRenderingContext2D, value: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    let line = "";
    for (const character of paragraph) {
      if (line && context.measureText(line + character).width > width) {
        lines.push(line);
        line = "";
      }
      line += character;
    }
    lines.push(line);
  }
  return lines;
}

export async function renderAtlasImage(input: AtlasImageInput): Promise<string> {
  const image = await loadArtwork(input.imageUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法生成元素图片");
  const sections = [
    { value: input.title, size: 44, color: "#28382d", gap: 18 },
    { value: input.summary, size: 28, color: "#786442", gap: 28 },
    { value: input.meaning, size: 26, color: "#383b32", gap: 36 },
    { value: input.credit, size: 18, color: "#79766a", gap: 0 },
  ].map((section) => {
    context.font = `${section.size}px serif`;
    return { ...section, lines: wrapText(context, section.value, 772), lineHeight: Math.ceil(section.size * 1.6) };
  });
  const imageHeight = 600;
  const textTop = imageHeight + 96;
  const textHeight = sections.reduce((height, section) => height + section.lines.length * section.lineHeight + section.gap, 0);
  canvas.width = 900;
  canvas.height = Math.ceil(textTop + textHeight + 48);
  if (canvas.height > 4096) throw new Error("文字过长，无法完整生成元素图片");
  context.fillStyle = "#e7deca";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#243b31";
  context.fillRect(24, 24, 852, imageHeight + 24);
  const scale = Math.min(828 / image.naturalWidth, imageHeight / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, (canvas.width - width) / 2, 36 + (imageHeight - height) / 2, width, height);
  context.fillStyle = "#f7f2e6";
  context.fillRect(24, imageHeight + 48, 852, canvas.height - imageHeight - 72);
  context.textAlign = "left";
  context.textBaseline = "top";
  let y = textTop;
  for (const section of sections) {
    context.font = `${section.size}px serif`;
    context.fillStyle = section.color;
    for (const line of section.lines) {
      context.fillText(line, 64, y);
      y += section.lineHeight;
    }
    y += section.gap;
  }
  return canvas.toDataURL("image/png");
}
