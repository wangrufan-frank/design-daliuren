import * as THREE from "three";

export const LABEL_COLORS = {
  oldGold: "#B7A36B",
  celadon: "#879B92",
  ash: "#C2C6BB",
} as const;

export type LabelStyle = "old-gold" | "celadon" | "ash";
export type LabelMarker = "noble" | "manual" | "direction-forward" | "direction-reverse";

export interface LabelTextureOptions {
  width: number;
  height: number;
  color: string;
  marker?: LabelMarker;
}

export interface LabelDescriptor {
  text: string;
  style: LabelStyle;
  width: number;
  height: number;
  marker?: LabelMarker;
}

const MARKER_GLYPHS: Record<LabelMarker, string> = {
  noble: "◆",
  manual: "✎",
  "direction-forward": "↻",
  "direction-reverse": "↺",
};

const STYLE_COLORS: Record<LabelStyle, string> = {
  "old-gold": LABEL_COLORS.oldGold,
  celadon: LABEL_COLORS.celadon,
  ash: LABEL_COLORS.ash,
};

export function createLabelTexture(text: string, options: LabelTextureOptions): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D context is unavailable for artifact labels");

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#121817";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = options.color;
  context.strokeStyle = options.color;
  context.textAlign = "center";
  context.textBaseline = "middle";

  const lines = text.split("\n");
  const lineHeight = canvas.height / Math.max(3, lines.length + 1);
  context.font = `600 ${Math.floor(lineHeight * 0.68)}px "Noto Serif SC", "Songti SC", serif`;
  lines.forEach((line, index) => {
    const y = canvas.height / 2 + (index - (lines.length - 1) / 2) * lineHeight;
    context.fillText(line, canvas.width / 2, y);
  });

  if (options.marker) {
    const inset = Math.max(6, Math.round(Math.min(canvas.width, canvas.height) * 0.04));
    context.lineWidth = Math.max(2, Math.round(inset / 3));
    context.setLineDash(options.marker === "manual" ? [inset, inset] : []);
    context.strokeRect(inset, inset, canvas.width - inset * 2, canvas.height - inset * 2);
    if (options.marker === "noble") {
      context.strokeRect(inset * 2, inset * 2, canvas.width - inset * 4, canvas.height - inset * 4);
    }
    context.font = `600 ${Math.floor(canvas.height * 0.16)}px "Noto Serif SC", serif`;
    context.fillText(MARKER_GLYPHS[options.marker], canvas.width - inset * 2.5, inset * 2.5);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface CacheEntry {
  texture: THREE.CanvasTexture;
  references: number;
}

export class LabelTextureCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly keysByTexture = new WeakMap<THREE.CanvasTexture, string>();
  private disposed = false;

  constructor(private readonly anisotropy: number) {}

  acquire(descriptor: LabelDescriptor): THREE.CanvasTexture {
    if (this.disposed) throw new Error("Artifact label cache is disposed");
    const key = JSON.stringify([
      descriptor.text,
      descriptor.style,
      descriptor.width,
      descriptor.height,
      descriptor.marker ?? null,
    ]);
    const cached = this.entries.get(key);
    if (cached) {
      cached.references += 1;
      return cached.texture;
    }

    const texture = createLabelTexture(descriptor.text, {
      width: descriptor.width,
      height: descriptor.height,
      color: STYLE_COLORS[descriptor.style],
      marker: descriptor.marker,
    });
    texture.anisotropy = this.anisotropy;
    this.entries.set(key, { texture, references: 1 });
    this.keysByTexture.set(texture, key);
    return texture;
  }

  release(texture: THREE.CanvasTexture): void {
    const key = this.keysByTexture.get(texture);
    if (!key) return;
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.references -= 1;
    if (entry.references > 0) return;
    this.entries.delete(key);
    this.keysByTexture.delete(texture);
    texture.dispose();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const { texture } of this.entries.values()) texture.dispose();
    this.entries.clear();
  }
}
