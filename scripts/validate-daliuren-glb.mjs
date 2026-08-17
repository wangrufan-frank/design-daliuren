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

function listProperties(document) {
  const root = document.getRoot();
  const properties = [];
  const seen = new Set();
  for (const method of ROOT_LIST_METHODS) {
    if (typeof root[method] !== "function") continue;
    for (const property of root[method]()) {
      if (seen.has(property)) continue;
      seen.add(property);
      properties.push(property);
    }
  }
  return properties;
}

function hasNonEmptyValue(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasNonEmptyValue);
  if (typeof value === "object") return Object.values(value).some(hasNonEmptyValue);
  return true;
}

function validateDynamicProperty(property, contract) {
  const errors = [];
  const name = property.getName?.() || "(unnamed)";
  const extras = property.getExtras?.() ?? {};
  const isAllowedFixedReference = (contract.allowedFixedReferences ?? []).includes(name)
    && (contract.allowedFixedRoles ?? []).includes(extras.role)
    && !Object.hasOwn(extras, "node_id");
  if (isAllowedFixedReference) return errors;

  const forbiddenKeys = new Set(contract.forbiddenDynamicKeys ?? []);
  const patterns = (contract.forbiddenDynamicPatterns ?? []).map(
    (pattern) => new RegExp(pattern, "u"),
  );
  const forbiddenValues = contract.forbiddenDynamicValues ?? [];

  function inspectText(value, path) {
    for (const forbidden of forbiddenValues) {
      if (value.includes(forbidden)) {
        errors.push(`forbidden dynamic value: ${forbidden} at ${path}`);
      }
    }
    for (const pattern of patterns) {
      const match = pattern.exec(value);
      if (match) errors.push(`forbidden dynamic value: ${match[0]} at ${path}`);
    }
  }

  function inspectValue(value, path) {
    if (typeof value === "string") inspectText(value, path);
    if (Array.isArray(value)) {
      value.forEach((item, index) => inspectValue(item, `${path}[${index}]`));
    } else if (value && typeof value === "object") {
      for (const [key, nested] of Object.entries(value)) {
        const nestedPath = `${path}.${key}`;
        if (forbiddenKeys.has(key) && hasNonEmptyValue(nested)) {
          errors.push(`forbidden dynamic key: ${nestedPath}`);
        }
        inspectValue(nested, nestedPath);
      }
    }
  }

  inspectText(name, `${name}.name`);
  inspectValue(extras, `${name}.extras`);
  return errors;
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
    const nodeName = node.getName?.() ?? "";
    if (nodeName.startsWith("preview/") || nodeName.startsWith("pose-preview/")) {
      errors.push(`preview node name: ${nodeName}`);
    }
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

  for (const property of listProperties(document)) {
    errors.push(...validateDynamicProperty(property, contract));
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
