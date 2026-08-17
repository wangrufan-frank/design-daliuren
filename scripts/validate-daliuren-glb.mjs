import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { getBounds, NodeIO } from "@gltf-transform/core";

const ROOT_LIST_METHODS = [
  "listAccessors",
  "listAnimations",
  "listBuffers",
  "listCameras",
  "listMaterials",
  "listMeshes",
  "listNodes",
  "listScenes",
  "listSkins",
  "listTextures",
];

function formatNumber(value) {
  return Number(value.toFixed(6)).toString();
}

function nodeBounds(node) {
  return typeof node.getBounds === "function" ? node.getBounds() : getBounds(node);
}

function triangleCount(document) {
  let triangles = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      const count = primitive.getIndices()?.getCount()
        ?? primitive.getAttribute("POSITION")?.getCount()
        ?? 0;
      const mode = primitive.getMode();
      if (mode === 4) triangles += Math.floor(count / 3);
      if (mode === 5 || mode === 6) triangles += Math.max(0, count - 2);
    }
  }
  return triangles;
}

function propertyText(document) {
  const root = document.getRoot();
  const values = [];
  for (const method of ROOT_LIST_METHODS) {
    if (typeof root[method] !== "function") continue;
    for (const property of root[method]()) {
      values.push(property.getName?.() ?? "");
      values.push(JSON.stringify(property.getExtras?.() ?? {}));
    }
  }
  return values.join("\n");
}

export function validateArtifactDocument(document, contract) {
  const errors = [];
  const root = document.getRoot();
  const nodes = root.listNodes();
  const expectedIds = new Set(contract.nodeIds);
  const nodesById = new Map();

  if (contract.schemaVersion !== 1) {
    errors.push(`schema version: expected 1, got ${contract.schemaVersion}`);
  }
  if (root.listScenes().length !== 1) {
    errors.push(`scene count: expected 1, got ${root.listScenes().length}`);
  }

  for (const node of nodes) {
    const nodeId = node.getExtras()?.node_id;
    if (typeof nodeId !== "string") continue;
    if (!expectedIds.has(nodeId)) errors.push(`extra node_id: ${nodeId}`);
    if (nodesById.has(nodeId)) errors.push(`duplicate node_id: ${nodeId}`);
    else nodesById.set(nodeId, node);
  }
  for (const nodeId of contract.nodeIds) {
    if (!nodesById.has(nodeId)) errors.push(`missing node_id: ${nodeId}`);
  }

  const tolerance = contract.dimensionToleranceMeters;
  for (const [nodeId, expected] of Object.entries(contract.dimensionsMeters)) {
    const node = nodesById.get(nodeId);
    if (!node) continue;
    const bounds = nodeBounds(node);
    const actual = bounds.min.map((minimum, axis) => bounds.max[axis] - minimum);
    for (let axis = 0; axis < 3; axis += 1) {
      if (!Number.isFinite(actual[axis]) || Math.abs(actual[axis] - expected[axis]) > tolerance) {
        errors.push(
          `dimension mismatch: ${nodeId}.${"xyz"[axis]} expected ${formatNumber(expected[axis])} ± ${formatNumber(tolerance)}, got ${formatNumber(actual[axis])}`,
        );
      }
    }
  }

  const triangles = triangleCount(document);
  const { min, max } = contract.triangleBudget;
  if (triangles < min || triangles > max) {
    errors.push(`triangle budget: expected ${min}..${max}, got ${triangles}`);
  }

  const embeddedText = propertyText(document);
  for (const value of contract.forbiddenDynamicValues ?? []) {
    if (embeddedText.includes(value)) errors.push(`forbidden dynamic value: ${value}`);
  }
  for (const pattern of contract.forbiddenDynamicPatterns ?? []) {
    const match = new RegExp(pattern, "u").exec(embeddedText);
    if (match) errors.push(`forbidden dynamic value: ${match[0]}`);
  }

  return errors.sort();
}

export function summarizeArtifactDocument(document) {
  const root = document.getRoot();
  const scene = root.listScenes()[0];
  const bounds = scene ? getBounds(scene) : { min: [0, 0, 0], max: [0, 0, 0] };
  const dimensions = bounds.min.map((minimum, axis) => bounds.max[axis] - minimum);
  const nodeCount = root.listNodes().filter(
    (node) => typeof node.getExtras()?.node_id === "string",
  ).length;
  return { nodeCount, triangles: triangleCount(document), dimensions };
}

async function main() {
  const [glbPath, contractPath] = process.argv.slice(2);
  if (!glbPath || !contractPath) {
    console.error("usage: node scripts/validate-daliuren-glb.mjs <asset.glb> <contract.json>");
    process.exitCode = 1;
    return;
  }

  const contract = JSON.parse(await readFile(contractPath, "utf8"));
  const document = await new NodeIO().read(glbPath);
  const errors = validateArtifactDocument(document, contract);
  const summary = summarizeArtifactDocument(document);
  console.log(`nodes=${summary.nodeCount}`);
  console.log(`triangles=${summary.triangles}`);
  console.log(`bounds=${summary.dimensions.map(formatNumber).join(" x ")} m`);
  console.log(`${errors.length} errors`);
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
