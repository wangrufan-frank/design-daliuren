import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateArtifactDocument } from "./validate-daliuren-glb.mjs";

const BASE_CONTRACT = {
  schemaVersion: 1,
  nodeIds: ["artifact/root", "plate/heaven"],
  dimensionsMeters: {},
  dimensionToleranceMeters: 0.01,
  poseIds: ["closed", "calendar", "plate", "lessons", "transmissions", "generals"],
  triangleBudget: { min: 0, max: 100 },
  forbiddenDynamicPatterns: [
    "(?:日干|日支|月将|占时|初传|中传|末传|空亡)[：:]?[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]{1,4}",
  ],
};

const ASSET_CONTRACT = JSON.parse(
  await readFile(new URL("../assets/daliuren/asset-contract.json", import.meta.url), "utf8"),
);

test("asset contract freezes the 28 runtime ids and six pose ids", () => {
  assert.equal(ASSET_CONTRACT.schemaVersion, 1);
  assert.deepEqual(ASSET_CONTRACT.nodeIds, [
    "artifact/root", "base/body", "plate/earth", "plate/heaven",
    "calendar/slip", "lesson/first", "lesson/second", "lesson/third",
    "lesson/fourth", "transmission/bridge", "transmission/initial",
    "transmission/middle", "transmission/final", "general/noble",
    "general/snake", "general/vermilion-bird", "general/harmony",
    "general/hook-array", "general/azure-dragon", "general/void",
    "general/white-tiger", "general/constant", "general/black-tortoise",
    "general/yin", "general/queen-of-heaven", "anchor/course-copy/lessons",
    "anchor/course-copy/transmissions", "anchor/course-copy/generals",
  ]);
  assert.deepEqual(ASSET_CONTRACT.poseIds, [
    "closed", "calendar", "plate", "lessons", "transmissions", "generals",
  ]);
  assert.deepEqual(ASSET_CONTRACT.triangleBudget, { min: 7000, max: 10000 });
});

function fakeDocument(nodes, { sceneCount = 1 } = {}) {
  const properties = nodes.map(({ name, extras = {}, bounds, triangles = 0 }) => ({
    getName: () => name,
    getExtras: () => extras,
    getBounds: bounds ? () => bounds : undefined,
    getMesh: () => triangles
      ? {
          getName: () => `${name}/mesh`,
          getExtras: () => ({}),
          listPrimitives: () => [{
            getMode: () => 4,
            getIndices: () => ({ getCount: () => triangles * 3 }),
            getAttribute: () => ({ getCount: () => triangles * 3 }),
          }],
        }
      : null,
  }));
  const scenes = Array.from({ length: sceneCount }, (_, index) => ({
    getName: () => `scene-${index}`,
    getExtras: () => ({}),
  }));

  return {
    getRoot: () => ({
      listNodes: () => properties,
      listScenes: () => scenes,
      listAccessors: () => [],
      listAnimations: () => [],
      listBuffers: () => [],
      listCameras: () => [],
      listMaterials: () => [],
      listMeshes: () => properties.map((node) => node.getMesh()).filter(Boolean),
      listSkins: () => [],
      listTextures: () => [],
    }),
  };
}

test("reports missing nodes and duplicate runtime ids", () => {
  const fake = fakeDocument([
    { name: "plate/heaven", extras: { node_id: "plate/heaven" } },
    { name: "copy", extras: { node_id: "plate/heaven" } },
  ]);

  assert.deepEqual(validateArtifactDocument(fake, BASE_CONTRACT), [
    "duplicate node_id: plate/heaven",
    "missing node_id: artifact/root",
  ]);
});

test("reports extra ids and a non-single scene with stable ordering", () => {
  const fake = fakeDocument([
    { name: "root", extras: { node_id: "artifact/root" } },
    { name: "heaven", extras: { node_id: "plate/heaven" } },
    { name: "unexpected", extras: { node_id: "runtime/unexpected" } },
  ], { sceneCount: 2 });

  assert.deepEqual(validateArtifactDocument(fake, BASE_CONTRACT), [
    "extra node_id: runtime/unexpected",
    "scene count: expected 1, got 2",
  ]);
});

test("reports a key node dimension outside the literal tolerance", () => {
  const contract = {
    ...BASE_CONTRACT,
    dimensionsMeters: { "plate/heaven": [1, 2, 3] },
  };
  const fake = fakeDocument([
    { name: "root", extras: { node_id: "artifact/root" } },
    {
      name: "heaven",
      extras: { node_id: "plate/heaven" },
      bounds: { min: [0, 0, 0], max: [1.02, 2, 3] },
    },
  ]);

  assert.deepEqual(validateArtifactDocument(fake, contract), [
    "dimension mismatch: plate/heaven.x expected 1 ± 0.01, got 1.02",
  ]);
});

test("reports triangle counts below and above the declared budget", () => {
  const contract = { ...BASE_CONTRACT, triangleBudget: { min: 5, max: 10 } };
  const nodes = (triangles) => [
    { name: "root", extras: { node_id: "artifact/root" } },
    { name: "heaven", extras: { node_id: "plate/heaven" }, triangles },
  ];

  assert.deepEqual(validateArtifactDocument(fakeDocument(nodes(4)), contract), [
    "triangle budget: expected 5..10, got 4",
  ]);
  assert.deepEqual(validateArtifactDocument(fakeDocument(nodes(11)), contract), [
    "triangle budget: expected 5..10, got 11",
  ]);
});

test("rejects dynamic course values but allows fixed cultural labels", () => {
  const fixed = fakeDocument([
    { name: "天盘", extras: { node_id: "artifact/root", fixedLabel: "青龙 初传" } },
    { name: "heaven", extras: { node_id: "plate/heaven" } },
  ]);
  const dynamic = fakeDocument([
    { name: "root", extras: { node_id: "artifact/root", course: "初传：寅" } },
    { name: "heaven", extras: { node_id: "plate/heaven" } },
  ]);

  assert.deepEqual(validateArtifactDocument(fixed, BASE_CONTRACT), []);
  assert.deepEqual(validateArtifactDocument(dynamic, BASE_CONTRACT), [
    "forbidden dynamic value: 初传：寅",
  ]);
});
