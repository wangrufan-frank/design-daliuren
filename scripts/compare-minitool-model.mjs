import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

export const CANONICAL_MODEL_SIZE = Object.freeze({ width: 1286, height: 1223 });

const DEFAULT_THRESHOLDS = Object.freeze({
  mae: 0.035,
  edgeOverlap: 0.98,
  histogramDistance: 0.08,
  blackRatioDelta: 0.015,
  blackRatioMaximum: 0.18,
});

const CENTER = Object.freeze({ x: 643, y: 615 });
const PEARLS = Object.freeze([
  Object.freeze({ name: "north-west", x: 472, y: 356, radius: 48 }),
  Object.freeze({ name: "north-east", x: 949, y: 410, radius: 48 }),
  Object.freeze({ name: "south-west", x: 357, y: 750, radius: 48 }),
  Object.freeze({ name: "south-east", x: 868, y: 846, radius: 48 }),
]);
const GENERAL_NAMES = Object.freeze([
  "贵人", "螣蛇", "朱雀", "六合", "勾陈", "青龙", "天空", "白虎", "太常", "玄武", "太阴", "天后",
]);

function inEllipse(x, y, radiusX, radiusY) {
  const dx = (x - CENTER.x) / radiusX;
  const dy = (y - CENTER.y) / radiusY;
  return dx * dx + dy * dy <= 1;
}

function inAnnulus(x, y, outerX, outerY, innerX, innerY) {
  return inEllipse(x, y, outerX, outerY) && !inEllipse(x, y, innerX, innerY);
}

function inGeneralSector(x, y, index) {
  if (!inAnnulus(x, y, 205, 150, 112, 82)) return false;
  const angle = Math.atan2((x - CENTER.x) / 205, -(y - CENTER.y) / 150);
  const normalized = angle < 0 ? angle + Math.PI * 2 : angle;
  const centerAngle = index * Math.PI / 6;
  const delta = Math.abs(normalized - centerAngle);
  return Math.min(delta, Math.PI * 2 - delta) <= Math.PI / 12;
}

const GENERAL_JADE_ITEMS = Object.freeze(GENERAL_NAMES.map((name, index) => Object.freeze({
  name,
  contains: (x, y) => inGeneralSector(x, y, index),
})));
const PEARL_ITEMS = Object.freeze(PEARLS.map((pearl) => Object.freeze({
  name: pearl.name,
  contains: (x, y) => (x - pearl.x) ** 2 + (y - pearl.y) ** 2 <= pearl.radius ** 2,
})));

const REGIONS = Object.freeze([
  Object.freeze({
    name: "zodiac",
    contains: (x, y) => x >= 70 && x <= 1216 && y >= 125 && y <= 1085 && !inEllipse(x, y, 390, 315),
  }),
  Object.freeze({
    name: "four-pearls",
    contains: (x, y) => PEARL_ITEMS.some((pearl) => pearl.contains(x, y)),
    items: PEARL_ITEMS,
  }),
  Object.freeze({ name: "earth-branches", contains: (x, y) => inAnnulus(x, y, 340, 275, 275, 215) }),
  Object.freeze({ name: "month-generals", contains: (x, y) => inAnnulus(x, y, 275, 215, 205, 150) }),
  Object.freeze({
    name: "general-jades",
    contains: (x, y) => inAnnulus(x, y, 205, 150, 112, 82),
    items: GENERAL_JADE_ITEMS,
  }),
  Object.freeze({ name: "center-trace", contains: (x, y) => inEllipse(x, y, 112, 82) }),
]);

function parseNormalization(value) {
  if (value === undefined || value === "none") return "none";
  if (value === "contain") return value;
  throw new Error(`Unsupported normalization ${value}; expected none or contain.`);
}

async function cornerColor(path) {
  const { data, info } = await sharp(path).ensureAlpha().extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
  return { r: data[0], g: data[1], b: data[2], alpha: info.channels === 4 ? data[3] : 255 };
}

async function loadRgb(path, normalization, label) {
  const image = sharp(path, { failOn: "error" });
  const metadata = await image.metadata();
  const sourceDimensions = { width: metadata.width, height: metadata.height };
  if (!sourceDimensions.width || !sourceDimensions.height) throw new Error(`${label} has no readable dimensions.`);
  const differs = sourceDimensions.width !== CANONICAL_MODEL_SIZE.width
    || sourceDimensions.height !== CANONICAL_MODEL_SIZE.height;
  if (differs && normalization !== "contain") {
    throw new Error(
      `${label} is ${sourceDimensions.width}x${sourceDimensions.height}; explicit normalization=contain is required for the ${CANONICAL_MODEL_SIZE.width}x${CANONICAL_MODEL_SIZE.height} comparison.`,
    );
  }
  const pipeline = differs
    ? sharp(path).resize(CANONICAL_MODEL_SIZE.width, CANONICAL_MODEL_SIZE.height, {
      fit: "contain",
      background: await cornerColor(path),
    })
    : sharp(path);
  const { data, info } = await pipeline.flatten({ background: "#ffffff" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== CANONICAL_MODEL_SIZE.width || info.height !== CANONICAL_MODEL_SIZE.height || info.channels !== 3) {
    throw new Error(`${label} did not normalize to canonical RGB pixels.`);
  }
  return { data, sourceDimensions };
}

async function loadMask(path) {
  const metadata = await sharp(path).metadata();
  if (metadata.width !== CANONICAL_MODEL_SIZE.width || metadata.height !== CANONICAL_MODEL_SIZE.height) {
    throw new Error(`Mask must be ${CANONICAL_MODEL_SIZE.width}x${CANONICAL_MODEL_SIZE.height}.`);
  }
  const { data } = await sharp(path).greyscale().raw().toBuffer({ resolveWithObject: true });
  return data;
}

function grayscale(rgb) {
  const pixels = new Uint8Array(CANONICAL_MODEL_SIZE.width * CANONICAL_MODEL_SIZE.height);
  for (let index = 0; index < pixels.length; index += 1) {
    const offset = index * 3;
    pixels[index] = Math.round(rgb[offset] * 0.2126 + rgb[offset + 1] * 0.7152 + rgb[offset + 2] * 0.0722);
  }
  return pixels;
}

function edges(rgb) {
  const { width, height } = CANONICAL_MODEL_SIZE;
  const gray = grayscale(rgb);
  const output = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const gx = -gray[index - width - 1] + gray[index - width + 1]
        - 2 * gray[index - 1] + 2 * gray[index + 1]
        - gray[index + width - 1] + gray[index + width + 1];
      const gy = -gray[index - width - 1] - 2 * gray[index - width] - gray[index - width + 1]
        + gray[index + width - 1] + 2 * gray[index + width] + gray[index + width + 1];
      if (Math.hypot(gx, gy) >= 36) output[index] = 1;
    }
  }
  return output;
}

function hasNearbyEdge(edgeMap, x, y) {
  const { width, height } = CANONICAL_MODEL_SIZE;
  for (let dy = -1; dy <= 1; dy += 1) {
    const nextY = y + dy;
    if (nextY < 0 || nextY >= height) continue;
    for (let dx = -1; dx <= 1; dx += 1) {
      const nextX = x + dx;
      if (nextX >= 0 && nextX < width && edgeMap[nextY * width + nextX]) return true;
    }
  }
  return false;
}

function measure(reference, actual, mask, referenceEdges, actualEdges, contains) {
  const { width, height } = CANONICAL_MODEL_SIZE;
  const referenceHistogram = Array.from({ length: 3 }, () => new Uint32Array(32));
  const actualHistogram = Array.from({ length: 3 }, () => new Uint32Array(32));
  let absoluteError = 0;
  let blackReference = 0;
  let blackActual = 0;
  let pixelCount = 0;
  let referenceEdgeCount = 0;
  let actualEdgeCount = 0;
  let referenceEdgeMatches = 0;
  let actualEdgeMatches = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (mask[index] < 128 || (contains && !contains(x, y))) continue;
      const offset = index * 3;
      let referenceIsBlack = true;
      let actualIsBlack = true;
      for (let channel = 0; channel < 3; channel += 1) {
        const referenceValue = reference[offset + channel];
        const actualValue = actual[offset + channel];
        absoluteError += Math.abs(referenceValue - actualValue);
        referenceHistogram[channel][referenceValue >> 3] += 1;
        actualHistogram[channel][actualValue >> 3] += 1;
        referenceIsBlack &&= referenceValue <= 8;
        actualIsBlack &&= actualValue <= 8;
      }
      if (referenceIsBlack) blackReference += 1;
      if (actualIsBlack) blackActual += 1;
      pixelCount += 1;
      if (referenceEdges[index]) {
        referenceEdgeCount += 1;
        if (hasNearbyEdge(actualEdges, x, y)) referenceEdgeMatches += 1;
      }
      if (actualEdges[index]) {
        actualEdgeCount += 1;
        if (hasNearbyEdge(referenceEdges, x, y)) actualEdgeMatches += 1;
      }
    }
  }
  if (pixelCount === 0) throw new Error("Comparison mask contains no pixels for a required region.");

  let histogramDelta = 0;
  for (let channel = 0; channel < 3; channel += 1) {
    for (let bin = 0; bin < 32; bin += 1) {
      histogramDelta += Math.abs(referenceHistogram[channel][bin] - actualHistogram[channel][bin]) / pixelCount;
    }
  }
  const referenceRecall = referenceEdgeCount === 0 ? (actualEdgeCount === 0 ? 1 : 0) : referenceEdgeMatches / referenceEdgeCount;
  const actualRecall = actualEdgeCount === 0 ? (referenceEdgeCount === 0 ? 1 : 0) : actualEdgeMatches / actualEdgeCount;
  return {
    mae: absoluteError / (pixelCount * 3 * 255),
    edgeOverlap: (referenceRecall + actualRecall) / 2,
    histogramDistance: histogramDelta / 6,
    blackRatio: {
      reference: blackReference / pixelCount,
      actual: blackActual / pixelCount,
    },
    pixelCount,
  };
}

function assess(name, metrics, thresholds) {
  const failures = [];
  if (metrics.mae > thresholds.mae) failures.push(`${name}: MAE ${metrics.mae.toFixed(6)} > ${thresholds.mae}`);
  if (metrics.edgeOverlap < thresholds.edgeOverlap) failures.push(`${name}: edge overlap ${metrics.edgeOverlap.toFixed(6)} < ${thresholds.edgeOverlap}`);
  if (metrics.histogramDistance > thresholds.histogramDistance) {
    failures.push(`${name}: histogram distance ${metrics.histogramDistance.toFixed(6)} > ${thresholds.histogramDistance}`);
  }
  if (metrics.blackRatio.actual > thresholds.blackRatioMaximum) {
    failures.push(`${name}: black pixel ratio ${metrics.blackRatio.actual.toFixed(6)} > ${thresholds.blackRatioMaximum}`);
  }
  const blackDelta = Math.abs(metrics.blackRatio.actual - metrics.blackRatio.reference);
  if (blackDelta > thresholds.blackRatioDelta) {
    failures.push(`${name}: black pixel ratio delta ${blackDelta.toFixed(6)} > ${thresholds.blackRatioDelta}`);
  }
  return failures;
}

async function writeDiff(path, reference, actual, mask) {
  const pixels = CANONICAL_MODEL_SIZE.width * CANONICAL_MODEL_SIZE.height;
  const output = Buffer.alloc(pixels * 4);
  for (let index = 0; index < pixels; index += 1) {
    const offset = index * 3;
    const destination = index * 4;
    const difference = Math.max(
      Math.abs(reference[offset] - actual[offset]),
      Math.abs(reference[offset + 1] - actual[offset + 1]),
      Math.abs(reference[offset + 2] - actual[offset + 2]),
    );
    output[destination] = Math.min(255, difference * 4);
    output[destination + 1] = difference > 0 ? Math.min(96, difference) : 0;
    output[destination + 2] = difference > 0 ? Math.min(64, difference) : 0;
    output[destination + 3] = mask[index];
  }
  await mkdir(dirname(resolve(path)), { recursive: true });
  await sharp(output, { raw: { width: CANONICAL_MODEL_SIZE.width, height: CANONICAL_MODEL_SIZE.height, channels: 4 } }).png().toFile(path);
}

export async function compareMinitoolModel(options) {
  const normalization = parseNormalization(options.normalization);
  const thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
  const [referenceImage, actualImage, mask] = await Promise.all([
    loadRgb(options.referencePath, normalization, "Reference"),
    loadRgb(options.actualPath, normalization, "Actual"),
    loadMask(options.maskPath),
  ]);
  const referenceEdges = edges(referenceImage.data);
  const actualEdges = edges(actualImage.data);
  const metrics = measure(referenceImage.data, actualImage.data, mask, referenceEdges, actualEdges);
  const failures = assess("overall", metrics, thresholds);
  const regions = REGIONS.map((region) => {
    const regionMetrics = measure(
      referenceImage.data,
      actualImage.data,
      mask,
      referenceEdges,
      actualEdges,
      region.contains,
    );
    const regionFailures = assess(region.name, regionMetrics, thresholds);
    const items = region.items?.map((item) => {
      const itemMetrics = measure(
        referenceImage.data,
        actualImage.data,
        mask,
        referenceEdges,
        actualEdges,
        item.contains,
      );
      const itemFailures = assess(`${region.name}/${item.name}`, itemMetrics, thresholds);
      failures.push(...itemFailures);
      return { name: item.name, pass: itemFailures.length === 0, metrics: itemMetrics, failures: itemFailures };
    });
    failures.push(...regionFailures);
    return {
      name: region.name,
      pass: regionFailures.length === 0 && (!items || items.every(({ pass }) => pass)),
      metrics: regionMetrics,
      failures: regionFailures,
      ...(items ? { items } : {}),
    };
  });
  if (options.diffPath) await writeDiff(options.diffPath, referenceImage.data, actualImage.data, mask);
  const result = {
    pass: failures.length === 0,
    normalization,
    canonicalDimensions: CANONICAL_MODEL_SIZE,
    sourceDimensions: {
      reference: referenceImage.sourceDimensions,
      actual: actualImage.sourceDimensions,
    },
    thresholds,
    metrics,
    regions,
    failures,
  };
  if (options.metricsPath) {
    await mkdir(dirname(resolve(options.metricsPath)), { recursive: true });
    await writeFile(options.metricsPath, `${JSON.stringify(result, null, 2)}\n`);
  }
  return result;
}

function parseCli(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`Expected --key value, got ${key ?? "end of input"}.`);
    values[key.slice(2)] = value;
  }
  for (const required of ["reference", "actual", "mask", "diff", "metrics"]) {
    if (!values[required]) throw new Error(`Missing --${required}.`);
  }
  return values;
}

async function main() {
  const values = parseCli(process.argv.slice(2));
  const result = await compareMinitoolModel({
    referencePath: values.reference,
    actualPath: values.actual,
    maskPath: values.mask,
    diffPath: values.diff,
    metricsPath: values.metrics,
    normalization: values.normalize,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.pass) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
    process.exitCode = 1;
  });
}
