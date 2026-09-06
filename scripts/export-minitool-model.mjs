import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = joinRoot("public/models/daliuren/daliuren-artifact-mobile.glb");
const contractPath = joinRoot("src/minitool/artifact/model-parity-contract.json");
const defaultOutput = joinRoot("src/minitool/artifact/generated");
const groupNames = ["earth", "heaven", "generals", "core"];
const dynamicNode = /^(surface\/dynamic|interaction)\//;

function joinRoot(path) {
  return resolve(root, path);
}

function sourceId(node) {
  return node.getName().replace(/^lod2\//, "");
}

function multiply(a, b) {
  const result = Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let index = 0; index < 4; index += 1) result[column * 4 + row] += a[index * 4 + row] * b[column * 4 + index];
    }
  }
  return result;
}

function invert(matrix) {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = matrix;
  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  const determinant = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!determinant) throw new Error("Cannot export geometry with a singular transform.");
  const factor = 1 / determinant;
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * factor, (a02 * b10 - a01 * b11 - a03 * b09) * factor,
    (a31 * b05 - a32 * b04 + a33 * b03) * factor, (a22 * b04 - a21 * b05 - a23 * b03) * factor,
    (a12 * b08 - a10 * b11 - a13 * b07) * factor, (a00 * b11 - a02 * b08 + a03 * b07) * factor,
    (a32 * b02 - a30 * b05 - a33 * b01) * factor, (a20 * b05 - a22 * b02 + a23 * b01) * factor,
    (a10 * b10 - a11 * b08 + a13 * b06) * factor, (a01 * b08 - a00 * b10 - a03 * b06) * factor,
    (a30 * b04 - a31 * b02 + a33 * b00) * factor, (a21 * b02 - a20 * b04 - a23 * b00) * factor,
    (a11 * b07 - a10 * b09 - a12 * b06) * factor, (a00 * b09 - a01 * b07 + a02 * b06) * factor,
    (a31 * b01 - a30 * b03 - a32 * b00) * factor, (a20 * b03 - a21 * b01 + a22 * b00) * factor,
  ];
}

function transformPosition(matrix, x, y, z) {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
}

function transformNormal(matrix, x, y, z) {
  const inverseMatrix = invert(matrix);
  const transformed = [
    inverseMatrix[0] * x + inverseMatrix[1] * y + inverseMatrix[2] * z,
    inverseMatrix[4] * x + inverseMatrix[5] * y + inverseMatrix[6] * z,
    inverseMatrix[8] * x + inverseMatrix[9] * y + inverseMatrix[10] * z,
  ];
  const length = Math.hypot(...transformed) || 1;
  return transformed.map((value) => value / length);
}

function encode(array) {
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString("base64");
}

function packPositions(values) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < values.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], values[index + axis]);
      max[axis] = Math.max(max[axis], values[index + axis]);
    }
  }
  const scale = max.map((value, axis) => (value - min[axis]) / 65535);
  const packed = new Uint16Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    const axis = index % 3;
    packed[index] = scale[axis] ? Math.round((values[index] - min[axis]) / scale[axis]) : 0;
  }
  return { componentType: "u16", itemSize: 3, count: values.length / 3, min, scale, data: encode(packed) };
}

function packNormals(values) {
  const packed = new Int16Array(values.length);
  for (let index = 0; index < values.length; index += 1) packed[index] = Math.round(Math.max(-1, Math.min(1, values[index])) * 32767);
  return { componentType: "i16", itemSize: 3, count: values.length / 3, min: [0, 0, 0], scale: [1 / 32767, 1 / 32767, 1 / 32767], data: encode(packed) };
}

function packTexcoords(values) {
  const min = [Infinity, Infinity];
  const max = [-Infinity, -Infinity];
  for (let index = 0; index < values.length; index += 2) {
    for (let axis = 0; axis < 2; axis += 1) {
      min[axis] = Math.min(min[axis], values[index + axis]);
      max[axis] = Math.max(max[axis], values[index + axis]);
    }
  }
  const scale = max.map((value, axis) => (value - min[axis]) / 65535);
  const packed = new Uint16Array(values.length);
  for (let index = 0; index < values.length; index += 1) {
    const axis = index % 2;
    packed[index] = scale[axis] ? Math.round((values[index] - min[axis]) / scale[axis]) : 0;
  }
  return { componentType: "u16", itemSize: 2, count: values.length / 2, min, scale, data: encode(packed) };
}

function packIndices(values) {
  const ArrayType = values.length && Math.max(...values) > 65535 ? Uint32Array : Uint16Array;
  const packed = new ArrayType(values);
  return { componentType: ArrayType === Uint32Array ? "u32" : "u16", itemSize: 3, count: values.length / 3, min: [0, 0, 0], scale: [1, 1, 1], data: encode(packed) };
}

function ownerFor(node, contractIds) {
  let current = node;
  while (current) {
    const id = sourceId(current);
    if (id !== "artifact/root" && contractIds.has(id)) return id;
    current = current.getParentNode();
  }
  return null;
}

function mergeOwner(owner) {
  if (owner.startsWith("branch/earth/")) return "plate/heaven";
  if (owner.startsWith("month-general/")) return "plate/heaven";
  if (owner.startsWith("general-slot/")) return "plate/generals";
  return owner;
}

function runtimeParentId(id, parentId) {
  return id.startsWith("branch/earth/") ? "plate/heaven" : parentId;
}

function materialRecord(material) {
  return {
    id: material?.getName() || "default",
    baseColor: material?.getBaseColorFactor() || [1, 1, 1, 1],
    metalness: material?.getMetallicFactor() || 0,
    roughness: material?.getRoughnessFactor() || 1,
    alphaMode: material?.getAlphaMode() || "OPAQUE",
  };
}

function scriptSource(name, part) {
  return `;(function () {\n  var parts = window.__DALIUREN_MODEL_PARTS__ || (window.__DALIUREN_MODEL_PARTS__ = {});\n  parts.${name} = ${JSON.stringify(part)};\n}());\n`;
}

export async function exportMinitoolModel({ outputDir = defaultOutput } = {}) {
  const contract = JSON.parse(await readFile(contractPath, "utf8"));
  const document = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(sourcePath);
  const sourceNodes = new Map(document.getRoot().listNodes().map((node) => [sourceId(node), node]));
  const contractIds = new Set(contract.nodeIds);
  const missing = contract.nodeIds.filter((id) => !sourceNodes.has(id));
  if (missing.length) throw new Error(`Source model is missing contract nodes: ${missing.join(", ")}`);

  const nodes = new Map(contract.nodeIds.map((id) => {
    const node = sourceNodes.get(id);
    const parentId = node.getParentNode() ? sourceId(node.getParentNode()) : null;
    return [id, { id, parentId: runtimeParentId(id, contractIds.has(parentId) ? parentId : null), matrix: [...node.getWorldMatrix()] }];
  }));
  const batches = new Map();
  for (const node of document.getRoot().listNodes()) {
    const id = sourceId(node);
    if (dynamicNode.test(id) || !node.getMesh()) continue;
    const owner = ownerFor(node, contractIds);
    if (!owner) continue;
    const targetNodeId = mergeOwner(owner);
    const relativeMatrix = multiply(invert(nodes.get(targetNodeId).matrix), node.getWorldMatrix());
    for (const primitive of node.getMesh().listPrimitives()) {
      const position = primitive.getAttribute("POSITION");
      if (!position || primitive.getMode() !== 4) continue;
      const material = materialRecord(primitive.getMaterial());
      const key = `${targetNodeId}\u0000${material.id}`;
      const batch = batches.get(key) || { nodeId: targetNodeId, material, positions: [], normals: [], indices: [] };
      const sourcePositions = position.getArray();
      const normal = primitive.getAttribute("NORMAL")?.getArray();
      const texcoord = primitive.getAttribute("TEXCOORD_0")?.getArray();
      const offset = batch.positions.length / 3;
      if (texcoord && !batch.texcoords) batch.texcoords = Array(offset * 2).fill(0);
      for (let index = 0; index < sourcePositions.length; index += 3) {
        batch.positions.push(...transformPosition(relativeMatrix, sourcePositions[index], sourcePositions[index + 1], sourcePositions[index + 2]));
        batch.normals.push(...transformNormal(relativeMatrix, normal?.[index] ?? 0, normal?.[index + 1] ?? 1, normal?.[index + 2] ?? 0));
        if (batch.texcoords) {
          const texcoordIndex = (index / 3) * 2;
          batch.texcoords.push(texcoord?.[texcoordIndex] ?? 0, texcoord?.[texcoordIndex + 1] ?? 0);
        }
      }
      const sourceIndices = primitive.getIndices()?.getArray();
      if (sourceIndices) {
        for (const index of sourceIndices) batch.indices.push(offset + index);
      } else {
        for (let index = 0; index < position.getCount(); index += 1) batch.indices.push(offset + index);
      }
      batches.set(key, batch);
    }
  }

  const grouped = Object.fromEntries(groupNames.map((name) => [name, { nodes: [], meshes: [], materials: [] }]));
  const groupForNode = new Map(groupNames.flatMap((name) => contract.groups[name].nodeIds.map((id) => [id, name])));
  for (const node of nodes.values()) grouped[groupForNode.get(node.id)].nodes.push(node);
  for (const batch of batches.values()) {
    const group = grouped[groupForNode.get(batch.nodeId)];
    if (!group.materials.some((material) => material.id === batch.material.id)) group.materials.push(batch.material);
    group.meshes.push({
      nodeId: batch.nodeId,
      materialId: batch.material.id,
      position: packPositions(batch.positions),
      normal: packNormals(batch.normals),
      indices: packIndices(batch.indices),
      ...(batch.texcoords ? { texcoord: packTexcoords(batch.texcoords) } : {}),
    });
  }
  for (const group of Object.values(grouped)) {
    group.nodes.sort((a, b) => a.id.localeCompare(b.id));
    group.materials.sort((a, b) => a.id.localeCompare(b.id));
    group.meshes.sort((a, b) => `${a.nodeId}\u0000${a.materialId}`.localeCompare(`${b.nodeId}\u0000${b.materialId}`));
  }

  const triangles = [...batches.values()].reduce((total, batch) => total + batch.indices.length / 3, 0);
  const drawCalls = Object.values(grouped).reduce((total, group) => total + group.meshes.length, 0);
  const manifest = { nodeIds: [...contract.nodeIds], extensions: [], triangles, drawCalls };
  if (triangles > contract.budget.triangles || drawCalls > contract.budget.drawCalls) {
    throw new Error(`Export exceeds budget: ${triangles} triangles, ${drawCalls} draw calls.`);
  }
  await mkdir(outputDir, { recursive: true });
  await Promise.all(groupNames.map((name) => writeFile(resolve(outputDir, `model-${name}.js`), scriptSource(name, grouped[name]))));
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) exportMinitoolModel();
