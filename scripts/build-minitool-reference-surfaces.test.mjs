import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { buildReferenceSurfaces } from "./build-minitool-reference-surfaces.mjs";

const referencePath = resolve("e2e/fixtures/minitool-model-reference.png");
const maskPath = resolve("e2e/fixtures/minitool-model-mask.png");
const GENERAL_NAMES = ["贵人", "螣蛇", "朱雀", "六合", "勾陈", "青龙", "天空", "白虎", "太常", "玄武", "太阴", "天后"];
const REFERENCE_GENERAL_EARTHS = ["申", "未", "午", "巳", "辰", "卯", "寅", "丑", "子", "亥", "戌", "酉"];

async function outputHashes(directory) {
  const files = (await readdir(directory)).sort();
  return Object.fromEntries(await Promise.all(files.map(async (file) => [
    file,
    createHash("sha256").update(await readFile(join(directory, file))).digest("hex"),
  ])));
}

test("builds deterministic, independently owned reference surfaces without a full-frame layer", async () => {
  const firstOutput = await mkdtemp(join(tmpdir(), "minitool-reference-surfaces-a-"));
  const secondOutput = await mkdtemp(join(tmpdir(), "minitool-reference-surfaces-b-"));
  const first = await buildReferenceSurfaces({ referencePath, maskPath, outputDir: firstOutput });
  const second = await buildReferenceSurfaces({ referencePath, maskPath, outputDir: secondOutput });

  assert.deepEqual(first.canonical, { width: 1286, height: 1223 });
  assert.deepEqual(first.rectified, { width: 1024, height: 1024 });
  assert.deepEqual(first.sourceQuad, [[278, 125], [1231, 235], [1134, 1157], [28, 964]]);
  assert.equal(first.sampling, "nearest");
  assert.deepEqual(first.layers.filter(({ kind }) => kind === "general").map(({ name }) => name), GENERAL_NAMES);
  assert.deepEqual(first.layers.filter(({ kind }) => kind === "general").map(({ baselineEarth }) => baselineEarth), REFERENCE_GENERAL_EARTHS);
  assert.equal(first.nativeLayers.filter(({ kind }) => kind === "earth").length, 4);
  assert.deepEqual(first.nativeLayers.filter(({ kind }) => kind === "general").map(({ name }) => name), GENERAL_NAMES);
  assert.equal(first.nativeLayers.some(({ coverage }) => coverage > 0.8), false);
  assert.equal(first.nativeLayers.every(({ sourceRect }) => sourceRect.width <= 1024 && sourceRect.height <= 1024), true);
  assert.equal(first.nativeLayers.find(({ kind }) => kind === "trace")?.ownerId, "plate/core");
  assert.ok(first.nativeLayers.find(({ kind }) => kind === "trace")?.coverage > 0);
  assert.deepEqual(first.trace.referenceEarths, ["卯", "酉", "卯"]);
  assert.equal(first.layers.find(({ kind }) => kind === "earth")?.ownerId, "plate/earth");
  assert.equal(first.layers.find(({ kind }) => kind === "heaven")?.ownerId, "plate/heaven");
  assert.equal(first.layers.find(({ kind }) => kind === "core")?.ownerId, "plate/core");
  assert.equal(first.layers.some(({ coverage }) => coverage > 0.8), false);
  assert.ok(first.trace.removedPixels > 0);
  const textureNames = [
    ...new Set([...first.layers, ...first.nativeLayers].map(({ texture }) => texture)),
  ].sort();
  assert.deepEqual(Object.keys(first.textureIntegrity).sort(), textureNames);
  for (const texture of textureNames) {
    const integrity = first.textureIntegrity[texture];
    const semanticIds = [...first.layers, ...first.nativeLayers]
      .filter((layer) => layer.texture === texture)
      .map(({ id }) => id);
    assert.match(integrity.sha256, /^[a-f0-9]{64}$/);
    assert.deepEqual(integrity.semanticIds, semanticIds);
  }
  assert.notEqual(
    first.textureIntegrity["general-detail-00.png"].sha256,
    first.textureIntegrity["general-detail-01.png"].sha256,
  );
  assert.deepEqual(first, second);
  assert.deepEqual(await outputHashes(firstOutput), await outputHashes(secondOutput));

  for (const file of ["earth.png", "heaven.png", "generals.png", "core.png"]) {
    const metadata = await sharp(join(firstOutput, file)).metadata();
    assert.deepEqual({ width: metadata.width, height: metadata.height }, { width: 1024, height: 1024 });
  }
  for (const layer of first.nativeLayers) {
    const metadata = await sharp(join(firstOutput, layer.texture)).metadata();
    assert.deepEqual(
      { width: metadata.width, height: metadata.height },
      { width: layer.sourceRect.width, height: layer.sourceRect.height },
    );
  }
});
