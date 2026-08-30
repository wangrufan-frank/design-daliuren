import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { getBounds, NodeIO } from "@gltf-transform/core";
import { listTextureSlots } from "@gltf-transform/functions";

const KTX2_IDENTIFIER = [
  0xAB, 0x4B, 0x54, 0x58, 0x20, 0x32, 0x30, 0xBB,
  0x0D, 0x0A, 0x1A, 0x0A,
];
const COLOR_TEXTURE_SLOTS = new Set(["baseColorTexture", "emissiveTexture"]);
const DATA_TEXTURE_SLOTS = new Set([
  "normalTexture",
  "occlusionTexture",
  "metallicRoughnessTexture",
]);
const KTX2_ENCODING_NAMES = new Map([
  [1, "ETC1S/BasisLZ"],
  [2, "UASTC/Zstd"],
]);

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

function transformPoint(point, matrix) {
  const [x, y, z] = point;
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  const divisor = w && w !== 1 ? w : 1;
  return [
    (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / divisor,
    (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / divisor,
    (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / divisor,
  ];
}

const IDENTITY_MATRIX = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

function multiplyMatrices(left, right) {
  const result = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let index = 0; index < 4; index += 1) {
        result[column * 4 + row] += left[index * 4 + row] * right[column * 4 + index];
      }
    }
  }
  return result;
}

function extendMeshBounds(mesh, matrix, bounds) {
  const localPosition = [0, 0, 0];
  for (const primitive of mesh.listPrimitives()) {
    const position = primitive.getAttribute("POSITION");
    if (!position) continue;
    const indices = primitive.getIndices();
    const count = indices?.getCount() ?? position.getCount();
    for (let offset = 0; offset < count; offset += 1) {
      const index = indices ? indices.getScalar(offset) : offset;
      position.getElement(index, localPosition);
      const componentPosition = transformPoint(localPosition, matrix);
      for (let axis = 0; axis < 3; axis += 1) {
        bounds.min[axis] = Math.min(bounds.min[axis], componentPosition[axis]);
        bounds.max[axis] = Math.max(bounds.max[axis], componentPosition[axis]);
      }
    }
  }
}

function localMeshBounds(node) {
  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  const mesh = node.getMesh?.();
  if (mesh) {
    extendMeshBounds(mesh, IDENTITY_MATRIX, bounds);
  } else {
    const visit = (child, matrix) => {
      const childMesh = child.getMesh?.();
      if (childMesh) extendMeshBounds(childMesh, matrix, bounds);
      for (const grandchild of child.listChildren?.() ?? []) {
        visit(grandchild, multiplyMatrices(matrix, grandchild.getMatrix()));
      }
    };
    for (const child of node.listChildren?.() ?? []) {
      visit(child, child.getMatrix());
    }
  }
  return bounds.min.every(Number.isFinite) && bounds.max.every(Number.isFinite)
    ? bounds
    : null;
}

function nodeBounds(node) {
  return localMeshBounds(node)
    ?? (typeof node.getBounds === "function" ? node.getBounds() : getBounds(node));
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

function extensionName(extension) {
  return extension.extensionName ?? extension.constructor?.EXTENSION_NAME ?? "";
}

function parseKtx2Header(image) {
  if (!(image instanceof Uint8Array) || image.byteLength < 48) return null;
  for (let index = 0; index < KTX2_IDENTIFIER.length; index += 1) {
    if (image[index] !== KTX2_IDENTIFIER[index]) return null;
  }
  const view = new DataView(image.buffer, image.byteOffset, image.byteLength);
  const header = {
    vkFormat: view.getUint32(12, true),
    typeSize: view.getUint32(16, true),
    pixelWidth: view.getUint32(20, true),
    pixelHeight: view.getUint32(24, true),
    faceCount: view.getUint32(36, true),
    levelCount: view.getUint32(40, true),
    supercompressionScheme: view.getUint32(44, true),
  };
  if (
    header.pixelWidth === 0
    || header.pixelHeight === 0
    || header.faceCount !== 1
    || header.levelCount === 0
  ) return null;
  return header;
}

export function validateKtx2Encoding(name, image, slots) {
  const header = parseKtx2Header(image);
  if (!header) return [`texture encoding: ${name} has an invalid KTX2 header`];
  const hasColor = slots.some((slot) => COLOR_TEXTURE_SLOTS.has(slot));
  const hasData = slots.some((slot) => DATA_TEXTURE_SLOTS.has(slot));
  if (hasColor && hasData) {
    return [`texture encoding: ${name} is shared by color and data slots`];
  }
  if (!hasColor && !hasData) {
    return [`texture encoding: ${name} has no supported material slots`];
  }
  const expectedScheme = hasColor ? 1 : 2;
  if (header.supercompressionScheme === expectedScheme) return [];
  const actual = KTX2_ENCODING_NAMES.get(header.supercompressionScheme)
    ?? `supercompression scheme ${header.supercompressionScheme}`;
  const expected = KTX2_ENCODING_NAMES.get(expectedScheme);
  return [
    `texture encoding: ${name} expected ${expected} for ${hasColor ? "color" : "data"} slots, got ${actual}`,
  ];
}

function validateRuntimeAssets(document, contract, lodProfile) {
  const errors = [];
  const root = document.getRoot();
  const runtime = contract.runtimeAssets;
  if (!runtime || !lodProfile) return errors;

  const expectedFamilies = new Set(runtime.materialFamilies ?? []);
  const actualFamilies = new Set(
    root.listMaterials()
      .map((material) => material.getExtras?.()?.material_family)
      .filter((family) => typeof family === "string"),
  );
  for (const family of expectedFamilies) {
    if (!actualFamilies.has(family)) errors.push(`material family missing: ${family}`);
  }
  for (const family of actualFamilies) {
    if (!expectedFamilies.has(family)) errors.push(`material family unexpected: ${family}`);
  }

  const expectedLabels = runtime.dynamicLabelOwners ?? {};
  const labelCounts = new Map();
  for (const node of root.listNodes()) {
    const extras = node.getExtras?.() ?? {};
    const dynamicId = extras.dynamic_label_id;
    if (typeof dynamicId !== "string") continue;
    labelCounts.set(dynamicId, (labelCounts.get(dynamicId) ?? 0) + 1);
    if (!Object.hasOwn(expectedLabels, dynamicId)) {
      errors.push(`dynamic label unexpected: ${dynamicId}`);
      continue;
    }
    if (extras.owner_node_id !== expectedLabels[dynamicId]) {
      errors.push(
        `dynamic label owner mismatch: ${dynamicId} expected ${expectedLabels[dynamicId]}, got ${extras.owner_node_id ?? "(missing)"}`,
      );
    }
  }
  for (const dynamicId of Object.keys(expectedLabels)) {
    const count = labelCounts.get(dynamicId) ?? 0;
    if (count === 0) errors.push(`dynamic label missing: ${dynamicId}`);
    if (count > 1) errors.push(`dynamic label duplicate: ${dynamicId}`);
  }

  const requiredExtension = runtime.requiredTextureExtension;
  const usedExtensions = new Set(
    (root.listExtensionsUsed?.() ?? []).map(extensionName),
  );
  if (requiredExtension && !usedExtensions.has(requiredExtension)) {
    errors.push(`required extension missing: ${requiredExtension}`);
  }

  const limits = lodProfile?.textureMaxDimensions;
  for (const texture of root.listTextures()) {
    const name = texture.getName?.() || "(unnamed)";
    const mimeType = texture.getMimeType?.() || "(missing)";
    if (requiredExtension && mimeType !== "image/ktx2") {
      errors.push(`texture mime type: ${name} expected image/ktx2, got ${mimeType}`);
    }
    const slots = typeof texture.listMaterialSlots === "function"
      ? texture.listMaterialSlots()
      : listTextureSlots(texture);
    errors.push(...validateKtx2Encoding(name, texture.getImage?.(), slots));
    if (!limits) continue;
    const atlasClass = name.includes("-moving-") ? "moving" : "hero";
    const maximum = limits[atlasClass];
    const size = texture.getSize?.();
    if (
      maximum
      && size
      && (size[0] > maximum[0] || size[1] > maximum[1])
    ) {
      errors.push(
        `texture dimensions: ${name} expected <= ${maximum[0]}x${maximum[1]}, got ${size[0]}x${size[1]}`,
      );
    }
  }
  return errors;
}

export function validateArtifactDocument(document, contract, { lodId } = {}) {
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

  const lodProfile = lodId ? contract.lods?.[lodId] : undefined;
  if (lodId && !lodProfile) errors.push(`LOD profile missing: ${lodId}`);
  const tolerance = contract.dimensionToleranceMeters;
  if (lodProfile?.sceneBoundsMeters && root.listScenes()[0]) {
    const expected = lodProfile.sceneBoundsMeters;
    const bounds = nodeBounds(root.listScenes()[0]);
    const actual = bounds.min.map((minimum, axis) => bounds.max[axis] - minimum);
    for (let axis = 0; axis < 3; axis += 1) {
      if (!Number.isFinite(actual[axis]) || Math.abs(actual[axis] - expected[axis]) > tolerance) {
        errors.push(
          `scene bounds mismatch: ${"xyz"[axis]} expected ${formatNumber(expected[axis])} ± ${formatNumber(tolerance)}, got ${formatNumber(actual[axis])}`,
        );
      }
    }
  } else {
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
  }

  const triangles = triangleCount(document);
  const { min, max } = lodProfile?.triangleBudget ?? contract.triangleBudget;
  if (triangles < min || triangles > max) {
    errors.push(`triangle budget: expected ${min}..${max}, got ${triangles}`);
  }

  errors.push(...validateRuntimeAssets(document, contract, lodProfile));

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
  const [glbPath, contractPath, requestedLodId] = process.argv.slice(2);
  if (!glbPath || !contractPath) {
    console.error("usage: node scripts/validate-daliuren-glb.mjs <asset.glb> <contract.json>");
    process.exitCode = 1;
    return;
  }

  const contract = JSON.parse(await readFile(contractPath, "utf8"));
  const normalizedPath = glbPath.replaceAll("\\", "/");
  const lodId = requestedLodId ?? Object.entries(contract.lods ?? {}).find(
    ([, profile]) => normalizedPath.endsWith(profile.file),
  )?.[0];
  const io = new NodeIO();
  try {
    const extensions = await import("@gltf-transform/extensions");
    io.registerExtensions(extensions.KHRONOS_EXTENSIONS);
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
  }
  const document = await io.read(glbPath);
  const errors = validateArtifactDocument(document, contract, { lodId });
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
