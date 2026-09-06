export type ParityModelGroupName = "earth" | "heaven" | "generals" | "core";
export type PackedComponentType = "u16" | "u32" | "i16";
export type ParityMaterialKind = "jade" | "translucentJade" | "recess" | "ink" | "cinnabar" | "gold" | "canvas-label";

export interface PackedAttribute {
  readonly componentType: PackedComponentType;
  readonly itemSize: number;
  readonly count: number;
  readonly min: readonly number[];
  readonly scale: readonly number[];
  readonly data: string;
}

export interface PackedModelNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly matrix: readonly number[];
}

export interface PackedModelMaterial {
  readonly id: string;
  readonly baseColor: readonly number[];
  readonly metalness: number;
  readonly roughness: number;
  readonly alphaMode: string;
}

export interface PackedModelMesh {
  readonly nodeId: string;
  readonly materialId: string;
  readonly position: PackedAttribute;
  readonly normal: PackedAttribute;
  readonly texcoord?: PackedAttribute;
  readonly indices: PackedAttribute;
}

export interface ParityModelPart {
  readonly nodes: readonly PackedModelNode[];
  readonly meshes: readonly PackedModelMesh[];
  readonly materials: readonly PackedModelMaterial[];
}

export type ParityModelParts = Record<ParityModelGroupName, ParityModelPart>;

export interface DecodedModelNode extends PackedModelNode {
  readonly matrix: readonly number[];
}

export interface DecodedModelMaterial extends PackedModelMaterial {
  readonly kind: ParityMaterialKind;
}

export interface DecodedModelMesh {
  readonly nodeId: string;
  readonly materialId: string;
  readonly position: Float32Array;
  readonly normal: Float32Array;
  readonly texcoord?: Float32Array;
  readonly indices: Uint16Array | Uint32Array;
}

export interface DecodedParityModel {
  readonly nodes: ReadonlyMap<string, DecodedModelNode>;
  readonly meshes: readonly DecodedModelMesh[];
  readonly materials: readonly DecodedModelMaterial[];
}

declare global {
  interface Window {
    __DALIUREN_MODEL_PARTS__?: ParityModelParts;
  }
}

const GROUP_NAMES: readonly ParityModelGroupName[] = ["earth", "heaven", "generals", "core"];

function bytesFromBase64(data: string): ArrayBuffer {
  const binary = atob(data);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return buffer;
}

function packedValues(attribute: PackedAttribute): Uint16Array | Uint32Array | Int16Array {
  const buffer = bytesFromBase64(attribute.data);
  if (attribute.componentType === "u16") return new Uint16Array(buffer);
  if (attribute.componentType === "u32") return new Uint32Array(buffer);
  return new Int16Array(buffer);
}

function decodeFloatAttribute(attribute: PackedAttribute): Float32Array {
  const packed = packedValues(attribute);
  const expectedLength = attribute.count * attribute.itemSize;
  if (packed.length !== expectedLength) throw new Error("Packed model attribute length does not match its metadata.");
  const decoded = new Float32Array(expectedLength);
  for (let index = 0; index < expectedLength; index += 1) {
    const axis = index % attribute.itemSize;
    decoded[index] = (attribute.min[axis] ?? 0) + packed[index] * (attribute.scale[axis] ?? 1);
  }
  return decoded;
}

function decodeNormals(attribute: PackedAttribute): Float32Array {
  const packed = packedValues(attribute);
  const expectedLength = attribute.count * attribute.itemSize;
  if (!(packed instanceof Int16Array) || packed.length !== expectedLength) {
    throw new Error("Packed model normals must match their signed-integer metadata.");
  }
  const decoded = new Float32Array(expectedLength);
  for (let index = 0; index < expectedLength; index += 1) decoded[index] = packed[index] / 32767;
  return decoded;
}

function decodeIndices(attribute: PackedAttribute): Uint16Array | Uint32Array {
  const packed = packedValues(attribute);
  if (!(packed instanceof Uint16Array) && !(packed instanceof Uint32Array)) {
    throw new Error("Packed model indices must be unsigned integers.");
  }
  if (packed.length !== attribute.count * attribute.itemSize) {
    throw new Error("Packed model index length does not match its metadata.");
  }
  return packed;
}

function materialKind(id: string): Exclude<ParityMaterialKind, "canvas-label"> {
  if (id === "M_TranslucentJade") return "translucentJade";
  if (id.includes("JadeRecess")) return "recess";
  if (id === "M_InkText") return "ink";
  if (id === "M_CinnabarText") return "cinnabar";
  if (id.includes("OldGold")) return "gold";
  return "jade";
}

export function decodeParityModel(parts: ParityModelParts): DecodedParityModel {
  const nodes = new Map<string, DecodedModelNode>();
  const materials = new Map<string, DecodedModelMaterial>();
  const meshes: DecodedModelMesh[] = [];
  for (const groupName of GROUP_NAMES) {
    const part = parts[groupName];
    if (!part) throw new Error(`Missing parity model part ${groupName}.`);
    for (const node of part.nodes) nodes.set(node.id, { ...node, matrix: [...node.matrix] });
    for (const material of part.materials) {
      if (!materials.has(material.id)) materials.set(material.id, { ...material, kind: materialKind(material.id) });
    }
    for (const mesh of part.meshes) {
      meshes.push({
        nodeId: mesh.nodeId,
        materialId: mesh.materialId,
        position: decodeFloatAttribute(mesh.position),
        normal: decodeNormals(mesh.normal),
        ...(mesh.texcoord ? { texcoord: decodeFloatAttribute(mesh.texcoord) } : {}),
        indices: decodeIndices(mesh.indices),
      });
    }
  }
  return { nodes, materials: [...materials.values()], meshes };
}
