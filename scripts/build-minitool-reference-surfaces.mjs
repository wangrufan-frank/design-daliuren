import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_REFERENCE = resolve(root, "e2e/fixtures/minitool-model-reference.png");
const DEFAULT_MASK = resolve(root, "e2e/fixtures/minitool-model-mask.png");
const DEFAULT_OUTPUT = resolve(root, "src/minitool/assets/reference-surfaces");
const CANONICAL = Object.freeze({ width: 1286, height: 1223 });
const RECTIFIED_SIZE = 1024;
const CENTER = Object.freeze({ x: 643, y: 615 });
const SOURCE_QUAD = Object.freeze([
  Object.freeze([278, 125]), Object.freeze([1231, 235]),
  Object.freeze([1134, 1157]), Object.freeze([28, 964]),
]);
const PEARLS = Object.freeze([
  Object.freeze({ x: 472, y: 356 }), Object.freeze({ x: 949, y: 410 }),
  Object.freeze({ x: 357, y: 750 }), Object.freeze({ x: 868, y: 846 }),
]);
const GENERAL_NAMES = Object.freeze([
  "贵人", "螣蛇", "朱雀", "六合", "勾陈", "青龙", "天空", "白虎", "太常", "玄武", "太阴", "天后",
]);
const GENERAL_NODE_IDS = Object.freeze([
  "general/noble", "general/snake", "general/vermilion-bird", "general/harmony",
  "general/hook-array", "general/azure-dragon", "general/void", "general/white-tiger",
  "general/constant", "general/black-tortoise", "general/yin", "general/queen-of-heaven",
]);
const GENERAL_EARTHS = Object.freeze(["申", "未", "午", "巳", "辰", "卯", "寅", "丑", "子", "亥", "戌", "酉"]);

function squareToQuad(quad) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = quad;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  const denominator = dx1 * dy2 - dx2 * dy1;
  const g = denominator ? (dx3 * dy2 - dx2 * dy3) / denominator : 0;
  const h = denominator ? (dx1 * dy3 - dx3 * dy1) / denominator : 0;
  return Object.freeze({
    a: x1 - x0 + g * x1, b: x3 - x0 + h * x3, c: x0,
    d: y1 - y0 + g * y1, e: y3 - y0 + h * y3, f: y0,
    g, h,
  });
}

function project(transform, u, v) {
  const divisor = transform.g * u + transform.h * v + 1;
  return {
    x: (transform.a * u + transform.b * v + transform.c) / divisor,
    y: (transform.d * u + transform.e * v + transform.f) / divisor,
  };
}

function inEllipse(x, y, radiusX, radiusY) {
  const dx = (x - CENTER.x) / radiusX;
  const dy = (y - CENTER.y) / radiusY;
  return dx * dx + dy * dy <= 1;
}

function isPearl(x, y) {
  return PEARLS.some((pearl) => (x - pearl.x) ** 2 + (y - pearl.y) ** 2 <= 48 ** 2);
}

function generalIndex(x, y) {
  const angle = Math.atan2((x - CENTER.x) / 205, -(y - CENTER.y) / 150);
  return Math.round(((angle < 0 ? angle + Math.PI * 2 : angle) / (Math.PI / 6))) % 12;
}

function tracePixel(red, green, blue) {
  const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
  const blueNode = blue > red + 20 && blue > green + 8;
  const oldGold = red > green + 14 && green > blue + 12 && chroma > 32;
  return blueNode || oldGold;
}

function coreFill(reference, channels) {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let y = CENTER.y - 60; y <= CENTER.y + 60; y += 1) {
    for (let x = CENTER.x - 80; x <= CENTER.x + 80; x += 1) {
      if (!inEllipse(x, y, 102, 72) || (x - CENTER.x) ** 2 + (y - CENTER.y) ** 2 < 22 ** 2) continue;
      const offset = (y * CANONICAL.width + x) * channels;
      const values = [reference[offset], reference[offset + 1], reference[offset + 2]];
      if (tracePixel(...values)) continue;
      red += values[0];
      green += values[1];
      blue += values[2];
      count += 1;
    }
  }
  return [Math.round(red / count), Math.round(green / count), Math.round(blue / count), 255];
}

function layerKind(x, y) {
  if (isPearl(x, y)) return "earth";
  if (inEllipse(x, y, 112, 82)) return "core";
  if (inEllipse(x, y, 205, 150)) return "generals";
  if (inEllipse(x, y, 340, 275)) return "heaven";
  return "earth";
}

export async function buildReferenceSurfaces({ referencePath, maskPath, outputDir } = {}) {
  const sourcePath = resolve(referencePath ?? DEFAULT_REFERENCE);
  const sourceMaskPath = resolve(maskPath ?? DEFAULT_MASK);
  const target = resolve(outputDir ?? DEFAULT_OUTPUT);
  const referenceObject = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const maskObject = await sharp(sourceMaskPath).greyscale().raw().toBuffer({ resolveWithObject: true });
  if (referenceObject.info.width !== CANONICAL.width || referenceObject.info.height !== CANONICAL.height) {
    throw new Error(`Reference surface source must be ${CANONICAL.width}x${CANONICAL.height}.`);
  }
  if (maskObject.info.width !== CANONICAL.width || maskObject.info.height !== CANONICAL.height) {
    throw new Error(`Reference surface mask must be ${CANONICAL.width}x${CANONICAL.height}.`);
  }

  const transform = squareToQuad(SOURCE_QUAD);
  const buffers = Object.fromEntries(["earth", "heaven", "generals", "core"].map((kind) => [
    kind,
    Buffer.alloc(RECTIFIED_SIZE * RECTIFIED_SIZE * 4),
  ]));
  const counts = { earth: 0, heaven: 0, core: 0, generals: Array(12).fill(0) };
  const jadeFill = coreFill(referenceObject.data, referenceObject.info.channels);
  let removedPixels = 0;
  for (let row = 0; row < RECTIFIED_SIZE; row += 1) {
    for (let column = 0; column < RECTIFIED_SIZE; column += 1) {
      const source = project(transform, (column + 0.5) / RECTIFIED_SIZE, (row + 0.5) / RECTIFIED_SIZE);
      const sourceX = Math.max(0, Math.min(CANONICAL.width - 1, Math.round(source.x)));
      const sourceY = Math.max(0, Math.min(CANONICAL.height - 1, Math.round(source.y)));
      if (maskObject.data[sourceY * CANONICAL.width + sourceX] < 128) continue;
      const kind = layerKind(source.x, source.y);
      const destination = (row * RECTIFIED_SIZE + column) * 4;
      const referenceOffset = (sourceY * CANONICAL.width + sourceX) * referenceObject.info.channels;
      let rgba = [0, 1, 2, 3].map((channel) => referenceObject.data[referenceOffset + channel] ?? (channel === 3 ? 255 : 0));
      if (kind === "core" && tracePixel(rgba[0], rgba[1], rgba[2])
        && (source.x - CENTER.x) ** 2 + (source.y - CENTER.y) ** 2 > 22 ** 2) {
        rgba = jadeFill;
        removedPixels += 1;
      }
      Buffer.from(rgba).copy(buffers[kind], destination);
      if (kind === "generals") counts.generals[generalIndex(source.x, source.y)] += 1;
      else counts[kind] += 1;
    }
  }

  const nativeDrafts = [
    ...[
      { left: 0, top: 0, width: 643, height: 612 },
      { left: 643, top: 0, width: 643, height: 612 },
      { left: 0, top: 612, width: 643, height: 611 },
      { left: 643, top: 612, width: 643, height: 611 },
    ].map((sourceRect, index) => ({
      id: `reference-native/earth/${index}`, kind: "earth", ownerId: "plate/earth",
      texture: `earth-detail-${index}.png`, sourceRect,
    })),
    {
      id: "reference-native/heaven", kind: "heaven", ownerId: "plate/heaven",
      texture: "heaven-detail.png", sourceRect: { left: 303, top: 340, width: 681, height: 551 },
    },
    ...GENERAL_NAMES.map((name, index) => ({
      id: `reference-native/general/${name}`, kind: "general", name,
      ownerId: GENERAL_NODE_IDS[index], baselineEarth: GENERAL_EARTHS[index], sectorIndex: index,
      texture: `general-detail-${String(index).padStart(2, "0")}.png`,
      sourceRect: { left: 438, top: 465, width: 411, height: 301 },
    })),
    {
      id: "reference-native/core", kind: "core", ownerId: "plate/core",
      texture: "core-detail.png", sourceRect: { left: 531, top: 533, width: 225, height: 165 },
    },
    {
      id: "reference-native/trace", kind: "trace", ownerId: "plate/core",
      texture: "trace-detail.png", sourceRect: { left: 531, top: 533, width: 225, height: 165 },
    },
  ];
  const nativeBuffers = nativeDrafts.map((layer) => Buffer.alloc(layer.sourceRect.width * layer.sourceRect.height * 4));
  const nativeCounts = nativeDrafts.map(() => 0);
  for (let y = 0; y < CANONICAL.height; y += 1) {
    for (let x = 0; x < CANONICAL.width; x += 1) {
      if (maskObject.data[y * CANONICAL.width + x] < 128) continue;
      const kind = layerKind(x, y);
      let layerIndex;
      if (kind === "earth") layerIndex = (y >= 612 ? 2 : 0) + (x >= 643 ? 1 : 0);
      else if (kind === "heaven") layerIndex = 4;
      else if (kind === "generals") layerIndex = 5 + generalIndex(x, y);
      else layerIndex = 17;
      const layer = nativeDrafts[layerIndex];
      const { left, top, width } = layer.sourceRect;
      const destination = ((y - top) * width + x - left) * 4;
      const sourceOffset = (y * CANONICAL.width + x) * referenceObject.info.channels;
      let rgba = [0, 1, 2, 3].map((channel) => referenceObject.data[sourceOffset + channel] ?? (channel === 3 ? 255 : 0));
      const isTrace = kind === "core" && tracePixel(rgba[0], rgba[1], rgba[2])
        && (x - CENTER.x) ** 2 + (y - CENTER.y) ** 2 > 22 ** 2;
      if (isTrace) {
        const traceDestination = ((y - top) * width + x - left) * 4;
        rgba.forEach((value, channel) => { nativeBuffers[18][traceDestination + channel] = value; });
        nativeCounts[18] += 1;
        rgba = jadeFill;
      }
      rgba.forEach((value, channel) => { nativeBuffers[layerIndex][destination + channel] = value; });
      nativeCounts[layerIndex] += 1;
    }
  }

  const pixelTotal = RECTIFIED_SIZE * RECTIFIED_SIZE;
  const layers = [
    { id: "reference/earth", kind: "earth", ownerId: "plate/earth", texture: "earth.png", coverage: counts.earth / pixelTotal },
    { id: "reference/heaven", kind: "heaven", ownerId: "plate/heaven", texture: "heaven.png", coverage: counts.heaven / pixelTotal },
    ...GENERAL_NAMES.map((name, index) => ({
      id: `reference/general/${name}`,
      kind: "general",
      name,
      ownerId: GENERAL_NODE_IDS[index],
      baselineEarth: GENERAL_EARTHS[index],
      sectorIndex: index,
      texture: "generals.png",
      coverage: counts.generals[index] / pixelTotal,
    })),
    { id: "reference/core", kind: "core", ownerId: "plate/core", texture: "core.png", coverage: counts.core / pixelTotal },
  ];
  const manifestBase = {
    schemaVersion: 1,
    sampling: "nearest",
    canonical: CANONICAL,
    rectified: { width: RECTIFIED_SIZE, height: RECTIFIED_SIZE },
    sourceQuad: SOURCE_QUAD,
    transform,
    referenceHeavenAngleRad: Math.PI - 10.25 * Math.PI / 180,
    layers,
    nativeLayers: nativeDrafts.map((layer, index) => ({
      ...layer,
      coverage: nativeCounts[index] / (CANONICAL.width * CANONICAL.height),
    })),
    trace: { center: [CENTER.x, CENTER.y], radius: [92, 64], removedPixels, referenceEarths: ["卯", "酉", "卯"] },
  };

  await mkdir(target, { recursive: true });
  await Promise.all(Object.entries(buffers).map(([kind, buffer]) => sharp(buffer, {
    raw: { width: RECTIFIED_SIZE, height: RECTIFIED_SIZE, channels: 4 },
  }).png({ compressionLevel: 9, adaptiveFiltering: false }).toFile(resolve(target, `${kind}.png`))));
  await Promise.all(nativeDrafts.map((layer, index) => sharp(nativeBuffers[index], {
    raw: { width: layer.sourceRect.width, height: layer.sourceRect.height, channels: 4 },
  }).png({ compressionLevel: 9, adaptiveFiltering: false }).toFile(resolve(target, layer.texture))));
  const semanticLayers = [...layers, ...manifestBase.nativeLayers];
  const textureNames = [...new Set(semanticLayers.map(({ texture }) => texture))];
  const textureIntegrity = Object.fromEntries(await Promise.all(textureNames.map(async (texture) => {
    const bytes = await readFile(resolve(target, texture));
    const metadata = await sharp(bytes).metadata();
    return [texture, {
      sha256: createHash("sha256").update(bytes).digest("hex"),
      width: metadata.width,
      height: metadata.height,
      semanticIds: semanticLayers.filter((layer) => layer.texture === texture).map(({ id }) => id),
    }];
  })));
  const manifest = { ...manifestBase, textureIntegrity };
  await writeFile(resolve(target, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildReferenceSurfaces().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
    process.exitCode = 1;
  });
}
