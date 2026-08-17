import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { validateArtifactDocument } from "./validate-daliuren-glb.mjs";

const BASE_CONTRACT = {
  schemaVersion: 1,
  nodeIds: ["artifact/root", "plate/heaven"],
  dimensionsMeters: {},
  dimensionToleranceMeters: 0.01,
  poseIds: ["closed", "calendar", "plate", "lessons", "transmissions", "generals"],
  triangleBudget: { min: 0, max: 100 },
  forbiddenDynamicKeys: ["初传", "courseValue"],
  allowedFixedRoles: ["fixed-historical-inscription"],
  allowedFixedReferences: ["reference/historical-ring"],
  forbiddenDynamicPatterns: [
    "(?:日干|日支|月将|占时|初传|中传|末传|空亡)[：:][甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]{1,4}$",
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
  assert.deepEqual(ASSET_CONTRACT.allowedFixedRoles, ["fixed-historical-inscription"]);
  assert.deepEqual(ASSET_CONTRACT.allowedFixedReferences, ["reference/historical-ring"]);
  assert.deepEqual(ASSET_CONTRACT.forbiddenDynamicKeys, [
    "日干", "日支", "月将", "占时", "初传", "中传", "末传", "空亡",
    "dayStem", "dayBranch", "monthGeneral", "divinationHour", "initialTransmission",
    "middleTransmission", "finalTransmission", "voidBranches", "courseValue",
  ]);
});

function fakeMesh(name, primitives) {
  return {
    getName: () => name,
    getExtras: () => ({}),
    listPrimitives: () => primitives.map(({ mode, count, indexed = true }) => ({
      getMode: () => mode,
      getIndices: () => indexed ? { getCount: () => count } : null,
      getAttribute: () => ({ getCount: () => count }),
    })),
  };
}

function fakeDocument(nodes, { sceneCount = 1, meshes } = {}) {
  const properties = nodes.map(({ name, extras = {}, bounds, triangles = 0, mesh }) => {
    const nodeMesh = mesh ?? (triangles
      ? fakeMesh(`${name}/mesh`, [{ mode: 4, count: triangles * 3 }])
      : null);
    return {
      getName: () => name,
      getExtras: () => extras,
      getBounds: bounds ? () => bounds : undefined,
      getMesh: () => nodeMesh,
    };
  });
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
      listMeshes: () => meshes ?? properties.map((node) => node.getMesh()).filter(Boolean),
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

test("counts shared mesh definitions once and handles strip and fan primitives", () => {
  const shared = fakeMesh("shared", [{ mode: 4, count: 6 }]);
  const sharedDocument = fakeDocument([
    { name: "root", extras: { node_id: "artifact/root" }, mesh: shared },
    { name: "heaven", extras: { node_id: "plate/heaven" }, mesh: shared },
  ], { meshes: [shared] });
  const stripAndFan = fakeMesh("strip-and-fan", [
    { mode: 5, count: 5 },
    { mode: 6, count: 4, indexed: false },
  ]);
  const stripAndFanDocument = fakeDocument([
    { name: "root", extras: { node_id: "artifact/root" } },
    { name: "heaven", extras: { node_id: "plate/heaven" } },
  ], { meshes: [stripAndFan] });

  assert.deepEqual(validateArtifactDocument(sharedDocument, {
    ...BASE_CONTRACT,
    triangleBudget: { min: 2, max: 2 },
  }), []);
  assert.deepEqual(validateArtifactDocument(stripAndFanDocument, {
    ...BASE_CONTRACT,
    triangleBudget: { min: 5, max: 5 },
  }), []);
});

test("rejects preview node names even when they have no runtime id", () => {
  const fake = fakeDocument([
    { name: "root", extras: { node_id: "artifact/root" } },
    { name: "heaven", extras: { node_id: "plate/heaven" } },
    { name: "preview/closed/base/body" },
    { name: "pose-preview/closed/base/body" },
  ]);

  assert.deepEqual(validateArtifactDocument(fake, BASE_CONTRACT), [
    "preview node name: pose-preview/closed/base/body",
    "preview node name: preview/closed/base/body",
  ]);
});

test("rejects structured dynamic fields and formatted values without blocking fixed references", () => {
  const fixedLabel = fakeDocument([
    { name: "天盘", extras: { node_id: "artifact/root", fixedLabel: "青龙 初传" } },
    { name: "heaven", extras: { node_id: "plate/heaven" } },
  ]);
  const fixedReference = fakeDocument([
    { name: "root", extras: { node_id: "artifact/root" } },
    { name: "heaven", extras: { node_id: "plate/heaven" } },
    {
      name: "reference/historical-ring",
      extras: {
        role: "fixed-historical-inscription",
        初传: "寅",
        caption: "甲子日例 初传寅位",
      },
    },
  ]);
  const runtimeImpostor = fakeDocument([
    {
      name: "root",
      extras: {
        node_id: "artifact/root",
        role: "fixed-historical-inscription",
        初传: "寅",
      },
    },
    { name: "heaven", extras: { node_id: "plate/heaven" } },
  ]);
  const unknownReference = fakeDocument([
    { name: "root", extras: { node_id: "artifact/root" } },
    { name: "heaven", extras: { node_id: "plate/heaven" } },
    {
      name: "reference/unapproved",
      extras: { role: "fixed-historical-inscription", 初传: "寅" },
    },
  ]);
  const chineseKey = fakeDocument([
    { name: "root", extras: { node_id: "artifact/root", 初传: "寅" } },
    { name: "heaven", extras: { node_id: "plate/heaven" } },
  ]);
  const englishKey = fakeDocument([
    { name: "root", extras: { node_id: "artifact/root", courseValue: "寅" } },
    { name: "heaven", extras: { node_id: "plate/heaven" } },
  ]);
  const formatted = fakeDocument([
    { name: "root", extras: { node_id: "artifact/root", course: "初传：寅" } },
    { name: "heaven", extras: { node_id: "plate/heaven" } },
  ]);

  assert.deepEqual(validateArtifactDocument(fixedLabel, BASE_CONTRACT), []);
  assert.deepEqual(validateArtifactDocument(fixedReference, BASE_CONTRACT), []);
  assert.deepEqual(validateArtifactDocument(runtimeImpostor, BASE_CONTRACT), [
    "forbidden dynamic key: root.extras.初传",
  ]);
  assert.deepEqual(validateArtifactDocument(unknownReference, BASE_CONTRACT), [
    "forbidden dynamic key: reference/unapproved.extras.初传",
  ]);
  assert.deepEqual(validateArtifactDocument(chineseKey, BASE_CONTRACT), [
    "forbidden dynamic key: root.extras.初传",
  ]);
  assert.deepEqual(validateArtifactDocument(englishKey, BASE_CONTRACT), [
    "forbidden dynamic key: root.extras.courseValue",
  ]);
  assert.deepEqual(validateArtifactDocument(formatted, BASE_CONTRACT), [
    "forbidden dynamic value: 初传：寅 at root.extras.course",
  ]);
});

test("can be imported when process.argv[1] is absent", () => {
  const moduleUrl = new URL("./validate-daliuren-glb.mjs", import.meta.url).href;
  const result = spawnSync(process.execPath, [
    "--input-type=module",
    "-e",
    `process.argv.splice(1); await import(${JSON.stringify(moduleUrl)});`,
  ], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
});
