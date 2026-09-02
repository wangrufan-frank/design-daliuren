import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import {
  validateArtifactDocument,
  validateKtx2Encoding,
} from "./validate-daliuren-glb.mjs";

const KTX2_IDENTIFIER = Buffer.from([
  0xAB, 0x4B, 0x54, 0x58, 0x20, 0x32, 0x30, 0xBB,
  0x0D, 0x0A, 0x1A, 0x0A,
]);

function ktx2Buffer(
  supercompressionScheme,
  {
    vkFormat = 0,
    colorModel = supercompressionScheme === 1 ? 163 : 166,
  } = {},
) {
  const dfdByteOffset = 104;
  const dfdByteLength = 28;
  const image = Buffer.alloc(dfdByteOffset + dfdByteLength);
  KTX2_IDENTIFIER.copy(image);
  image.writeUInt32LE(vkFormat, 12);
  image.writeUInt32LE(1, 16);
  image.writeUInt32LE(4, 20);
  image.writeUInt32LE(4, 24);
  image.writeUInt32LE(1, 36);
  image.writeUInt32LE(1, 40);
  image.writeUInt32LE(supercompressionScheme, 44);
  image.writeUInt32LE(dfdByteOffset, 48);
  image.writeUInt32LE(dfdByteLength, 52);
  image.writeUInt32LE(dfdByteLength, dfdByteOffset);
  image.writeUInt16LE(0, dfdByteOffset + 4);
  image.writeUInt16LE(0, dfdByteOffset + 6);
  image.writeUInt16LE(2, dfdByteOffset + 8);
  image.writeUInt16LE(24, dfdByteOffset + 10);
  image.writeUInt8(colorModel, dfdByteOffset + 12);
  return image;
}

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

const LOD_CONTRACT = {
  ...BASE_CONTRACT,
  lods: {
    lod2: {
      triangleBudget: { min: 0, max: 3 },
      sceneBoundsMeters: [0.52, 0.092, 0.52],
      textureMaxDimensions: {
        hero: [2048, 2048],
        moving: [1024, 1024],
      },
    },
  },
  runtimeAssets: {
    materialFamilies: ["M_Bronze", "M_Celadon"],
    dynamicLabelOwners: {
      "dynamic/calendar": "artifact/root",
      "dynamic/heaven": "plate/heaven",
    },
    requiredTextureExtension: "KHR_texture_basisu",
  },
};

const ASSET_CONTRACT = JSON.parse(
  await readFile(new URL("../assets/daliuren/asset-contract.json", import.meta.url), "utf8"),
);
const PACKAGE = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const ASSET_REQUIREMENTS = await readFile(
  new URL("../tools/python/requirements-assets.txt", import.meta.url),
  "utf8",
).catch(() => "");

test("asset contract freezes the non-mechanical runtime ids and six pose ids", () => {
  assert.equal(ASSET_CONTRACT.schemaVersion, 1);
  const nodeIds = new Set(ASSET_CONTRACT.nodeIds);
  assert.equal(nodeIds.size, ASSET_CONTRACT.nodeIds.length);
  assert.equal(nodeIds.size, 65);
  assert.equal(nodeIds.has("plate/generals"), true);
  assert.equal(nodeIds.has("plate/core"), true);
  for (const forbidden of [
    "transmission/bridge",
    "anchor/course-copy/lessons",
    "anchor/course-copy/transmissions",
    "anchor/course-copy/generals",
  ]) {
    assert.equal(nodeIds.has(forbidden), false, forbidden);
  }
  assert.equal(nodeIds.has("transmission/method"), true);
  assert.equal(nodeIds.has("trace/course"), true);
  for (const branch of "子丑寅卯辰巳午未申酉戌亥") {
    assert.equal(nodeIds.has(`branch/earth/${branch}`), true);
  }
  assert.deepEqual(ASSET_CONTRACT.poseIds, [
    "closed", "calendar", "plate", "lessons", "transmissions", "generals",
  ]);
  assert.deepEqual(ASSET_CONTRACT.triangleBudget, { min: 7000, max: 35000 });
  assert.deepEqual(ASSET_CONTRACT.allowedFixedRoles, ["fixed-historical-inscription"]);
  assert.deepEqual(ASSET_CONTRACT.allowedFixedReferences, ["reference/historical-ring"]);
  assert.deepEqual(ASSET_CONTRACT.forbiddenDynamicKeys, [
    "日干", "日支", "月将", "占时", "初传", "中传", "末传", "空亡",
    "dayStem", "dayBranch", "monthGeneral", "divinationHour", "initialTransmission",
    "middleTransmission", "finalTransmission", "voidBranches", "courseValue",
  ]);
});

function fakeMesh(name, primitives, materialsByName = new Map()) {
  return {
    getName: () => name,
    getExtras: () => ({}),
    listPrimitives: () => primitives.map(({ mode, count, indexed = true, material }) => ({
      getMode: () => mode,
      getIndices: () => indexed ? { getCount: () => count } : null,
      getAttribute: () => ({ getCount: () => count }),
      getMaterial: () => materialsByName.get(material) ?? null,
    })),
  };
}

function localBoundsMesh(min, max) {
  const positions = [
    min,
    max,
  ];
  return {
    getName: () => "local-bounds-mesh",
    getExtras: () => ({}),
    listPrimitives: () => [{
      getMode: () => 4,
      getIndices: () => null,
      getAttribute: (semantic) => semantic === "POSITION" ? {
        getCount: () => positions.length,
        getElement: (index, target) => {
          target.splice(0, 3, ...positions[index]);
          return target;
        },
      } : null,
    }],
  };
}

function fakeDocument(nodes, {
  sceneCount = 1,
  sceneBounds,
  meshes,
  materials = [],
  textures = [],
  extensionsUsed = [],
} = {}) {
  const materialsByName = new Map(materials.map((material) => [material.name, {
    getName: () => material.name,
    getExtras: () => material.extras ?? (material.family ? { material_family: material.family } : {}),
    getAlphaMode: () => material.alphaMode ?? "OPAQUE",
    getAlphaCutoff: () => material.alphaCutoff ?? 0.5,
    getBaseColorFactor: () => material.baseColorFactor ?? [1, 1, 1, 1],
  }]));
  let propertiesByName;
  const properties = nodes.map(({
    name,
    extras = {},
    bounds,
    triangles = 0,
    material,
    mesh,
    children = [],
    localMatrix,
    worldMatrix,
  }) => {
    const nodeMesh = mesh ?? (triangles
      ? fakeMesh(`${name}/mesh`, [{ mode: 4, count: triangles * 3, material }], materialsByName)
      : null);
    return {
      getName: () => name,
      getExtras: () => extras,
      getBounds: bounds ? () => bounds : undefined,
      getMesh: () => nodeMesh,
      getMatrix: () => localMatrix ?? [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ],
      listChildren: () => children.map((childName) => propertiesByName.get(childName)),
      getWorldMatrix: () => worldMatrix ?? [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      ],
    };
  });
  propertiesByName = new Map(properties.map((property) => [property.getName(), property]));
  const scenes = Array.from({ length: sceneCount }, (_, index) => ({
    getName: () => `scene-${index}`,
    getExtras: () => ({}),
    getBounds: sceneBounds ? () => sceneBounds : undefined,
  }));

  return {
    getRoot: () => ({
      listNodes: () => properties,
      listScenes: () => scenes,
      listAccessors: () => [],
      listAnimations: () => [],
      listBuffers: () => [],
      listCameras: () => [],
      listMaterials: () => [...materialsByName.values()],
      listMeshes: () => meshes ?? properties.map((node) => node.getMesh()).filter(Boolean),
      listSkins: () => [],
      listTextures: () => textures.map(({
        name,
        mimeType = "image/ktx2",
        size,
        scheme = name.includes("normal") || name.includes("orm") ? 2 : 1,
        slots = name.includes("normal")
          ? ["normalTexture"]
          : name.includes("orm")
            ? ["occlusionTexture", "metallicRoughnessTexture"]
            : ["baseColorTexture"],
      }) => {
        const dataTexture = slots.some((slot) => (
          slot === "normalTexture"
          || slot === "occlusionTexture"
          || slot === "metallicRoughnessTexture"
        ));
        return {
          getName: () => name,
          getExtras: () => ({}),
          getMimeType: () => mimeType,
          getSize: () => size,
          getImage: () => ktx2Buffer(scheme, { colorModel: dataTexture ? 166 : 163 }),
          listMaterialSlots: () => slots,
        };
      }),
      listExtensionsUsed: () => extensionsUsed.map((extensionName) => ({ extensionName })),
    }),
  };
}

function validLodDocument(overrides = {}) {
  const nodes = overrides.nodes ?? [
    { name: "root", extras: { node_id: "artifact/root" } },
    { name: "heaven", extras: { node_id: "plate/heaven" }, triangles: 3 },
    {
      name: "surface/dynamic/calendar",
      extras: { dynamic_label_id: "dynamic/calendar", owner_node_id: "artifact/root" },
    },
    {
      name: "surface/dynamic/heaven",
      extras: { dynamic_label_id: "dynamic/heaven", owner_node_id: "plate/heaven" },
    },
  ];
  return fakeDocument(nodes, {
    sceneBounds: overrides.sceneBounds ?? {
      min: [-0.26, 0, -0.26],
      max: [0.26, 0.092, 0.26],
    },
    materials: overrides.materials ?? [
      { name: "bronze", family: "M_Bronze" },
      { name: "celadon", family: "M_Celadon" },
    ],
    textures: overrides.textures ?? [
      { name: "bronze-hero-basecolor", size: [2048, 2048] },
      { name: "celadon-moving-normal", size: [1024, 1024] },
    ],
    extensionsUsed: overrides.extensionsUsed ?? ["KHR_texture_basisu"],
  });
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

test("measures a mesh node locally instead of including child geometry", () => {
  const contract = {
    ...BASE_CONTRACT,
    dimensionsMeters: { "plate/heaven": [1, 2, 3] },
  };
  const fake = fakeDocument([
    { name: "root", extras: { node_id: "artifact/root" } },
    {
      name: "heaven",
      extras: { node_id: "plate/heaven" },
      bounds: { min: [0, 0, 0], max: [1, 2.5, 3] },
      mesh: localBoundsMesh([0, 0, 0], [1, 2, 3]),
    },
  ]);

  assert.deepEqual(validateArtifactDocument(fake, contract), []);
});

test("measures an empty component from descendant meshes in component-local space", () => {
  const contract = {
    ...BASE_CONTRACT,
    nodeIds: ["artifact/root", "calendar/slip"],
    dimensionsMeters: { "calendar/slip": [0.3, 0.009, 0.038] },
    dimensionToleranceMeters: 0.0005,
  };
  const tenDegrees = Math.PI / 18;
  const fake = fakeDocument([
    { name: "root", extras: { node_id: "artifact/root" } },
    {
      name: "calendar",
      extras: { node_id: "calendar/slip" },
      children: ["calendar-body"],
      localMatrix: [
        1, 0, 0, 0,
        0, Math.cos(tenDegrees), Math.sin(tenDegrees), 0,
        0, -Math.sin(tenDegrees), Math.cos(tenDegrees), 0,
        0, 0, 0, 1,
      ],
      bounds: {
        min: [-0.15, -0.0075575, -0.0194925],
        max: [0.15, 0.0075575, 0.0194925],
      },
    },
    {
      name: "calendar-body",
      mesh: localBoundsMesh([-0.15, -0.0045, -0.019], [0.15, 0.0045, 0.019]),
    },
  ]);

  assert.deepEqual(validateArtifactDocument(fake, contract), []);
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

test("enforces the approved thirty-five-thousand graybox triangle ceiling", () => {
  const contract = {
    ...BASE_CONTRACT,
    triangleBudget: ASSET_CONTRACT.triangleBudget,
  };
  const nodes = (triangles) => [
    { name: "root", extras: { node_id: "artifact/root" } },
    { name: "heaven", extras: { node_id: "plate/heaven" }, triangles },
  ];

  assert.deepEqual(validateArtifactDocument(fakeDocument(nodes(35000)), contract), []);
  assert.deepEqual(validateArtifactDocument(fakeDocument(nodes(35001)), contract), [
    "triangle budget: expected 7000..35000, got 35001",
  ]);
});

test("uses the selected LOD budget without changing the graybox budget", () => {
  const fourTriangles = fakeDocument([
    { name: "root", extras: { node_id: "artifact/root" } },
    { name: "heaven", extras: { node_id: "plate/heaven" }, triangles: 4 },
  ], {
    sceneBounds: { min: [-0.26, 0, -0.26], max: [0.26, 0.092, 0.26] },
  });

  assert.deepEqual(validateArtifactDocument(fourTriangles, BASE_CONTRACT), []);
  assert.deepEqual(validateArtifactDocument(fourTriangles, LOD_CONTRACT), []);
  assert.ok(validateArtifactDocument(validLodDocument(), LOD_CONTRACT, { lodId: "lod2" }).length === 0);
  assert.deepEqual(
    validateArtifactDocument(fourTriangles, LOD_CONTRACT, { lodId: "lod2" }),
    [
      "dynamic label missing: dynamic/calendar",
      "dynamic label missing: dynamic/heaven",
      "material family missing: M_Bronze",
      "material family missing: M_Celadon",
      "required extension missing: KHR_texture_basisu",
      "triangle budget: expected 0..3, got 4",
    ],
  );
});

test("validates runtime material families and dynamic label owner extras", () => {
  const invalid = validLodDocument({
    nodes: [
      { name: "root", extras: { node_id: "artifact/root" } },
      { name: "heaven", extras: { node_id: "plate/heaven" }, triangles: 3 },
      {
        name: "surface/duplicate-a",
        extras: { dynamic_label_id: "dynamic/calendar", owner_node_id: "plate/heaven" },
      },
      {
        name: "surface/duplicate-b",
        extras: { dynamic_label_id: "dynamic/calendar", owner_node_id: "artifact/root" },
      },
    ],
    materials: [
      { name: "bronze", family: "M_Bronze" },
      { name: "unknown", family: "M_Unknown" },
    ],
  });

  assert.deepEqual(validateArtifactDocument(invalid, LOD_CONTRACT, { lodId: "lod2" }), [
    "dynamic label duplicate: dynamic/calendar",
    "dynamic label missing: dynamic/heaven",
    "dynamic label owner mismatch: dynamic/calendar expected artifact/root, got plate/heaven",
    "material family missing: M_Celadon",
    "material family unexpected: M_Unknown",
  ]);
});

test("only excludes the contract-declared invisible interaction surface from material families", () => {
  const contract = {
    ...LOD_CONTRACT,
    nodeIds: [...LOD_CONTRACT.nodeIds, "interaction/month-general-ring"],
    runtimeAssets: {
      ...LOD_CONTRACT.runtimeAssets,
      materialFamilies: ["M_Bronze", "M_Celadon"],
      interactionSurfaces: {
        "interaction/month-general-ring": {
          material: "M_InteractionRaycast",
          runtimeVisibility: "raycast-only",
          colorWrite: false,
          depthWrite: false,
        },
      },
    },
  };
  const document = validLodDocument({
    nodes: [
      { name: "root", extras: { node_id: "artifact/root" } },
      { name: "heaven", extras: { node_id: "plate/heaven" }, triangles: 2 },
      {
        name: "interaction",
        extras: {
          node_id: "interaction/month-general-ring",
          runtime_visibility: "raycast-only",
          color_write: false,
          depth_write: false,
        },
        triangles: 1,
        material: "M_InteractionRaycast",
      },
      {
        name: "surface/dynamic/calendar",
        extras: { dynamic_label_id: "dynamic/calendar", owner_node_id: "artifact/root" },
      },
      {
        name: "surface/dynamic/heaven",
        extras: { dynamic_label_id: "dynamic/heaven", owner_node_id: "plate/heaven" },
      },
    ],
    materials: [
      { name: "bronze", family: "M_Bronze" },
      { name: "celadon", family: "M_Celadon" },
      {
        name: "M_InteractionRaycast",
        extras: {
          material_family: "M_InteractionRaycast",
          runtime_visibility: "raycast-only",
          color_write: false,
          depth_write: false,
        },
        alphaMode: "MASK",
        alphaCutoff: 0.5,
        baseColorFactor: [0, 0, 0, 0],
      },
      {
        name: "unrelated-raycast-tag",
        family: "M_Unexpected",
        extras: { material_family: "M_Unexpected", runtime_visibility: "raycast-only" },
      },
    ],
  });

  assert.deepEqual(validateArtifactDocument(document, contract, { lodId: "lod2" }), [
    "material family unexpected: M_Unexpected",
  ]);
});

test("validates final LOD scene bounds instead of graybox component bounds", () => {
  const invalid = validLodDocument({
    sceneBounds: {
      min: [-0.26, 0, -0.26],
      max: [0.26, 0.11, 0.26],
    },
  });

  assert.deepEqual(validateArtifactDocument(invalid, LOD_CONTRACT, { lodId: "lod2" }), [
    "scene bounds mismatch: y expected 0.092 ± 0.01, got 0.11",
  ]);
});

test("asset contract declares final LOD budgets and runtime texture validation", () => {
  assert.deepEqual(ASSET_CONTRACT.lods, {
    lod0: {
      file: "public/models/daliuren/daliuren-artifact-lod0.glb",
      triangleBudget: { min: 1, max: 300000 },
      sceneBoundsMeters: [0.52, 0.07605, 0.52],
      textureMaxDimensions: { hero: [4096, 4096], moving: [2048, 2048] },
    },
    lod1: {
      file: "public/models/daliuren/daliuren-artifact-lod1.glb",
      triangleBudget: { min: 1, max: 300000 },
      sceneBoundsMeters: [0.52, 0.07605, 0.52],
      textureMaxDimensions: { hero: [4096, 4096], moving: [2048, 2048] },
    },
    lod2: {
      file: "public/models/daliuren/daliuren-artifact-lod2.glb",
      triangleBudget: { min: 1, max: 82000 },
      sceneBoundsMeters: [0.52, 0.07605, 0.52],
      textureMaxDimensions: { hero: [2048, 2048], moving: [1024, 1024] },
    },
  });
  assert.deepEqual(ASSET_CONTRACT.runtimeAssets.materialFamilies, [
    "M_JadeBody", "M_TranslucentJade", "M_JadeRecess", "M_InkText",
    "M_CinnabarText", "M_OldGold",
  ]);
  assert.equal(ASSET_CONTRACT.runtimeAssets.requiredTextureExtension, "KHR_texture_basisu");
  assert.equal(Object.keys(ASSET_CONTRACT.runtimeAssets.dynamicLabelOwners).length, 21);
});

test("package exposes the LOD export and validation toolchain", () => {
  assert.match(PACKAGE.scripts["asset:export-lods"], /asset:install-python-tools/);
  assert.match(PACKAGE.scripts["asset:export-lods"], /asset:bake-textures/);
  assert.match(PACKAGE.scripts["asset:export-lods"], /asset:export-lods:raw/);
  assert.match(PACKAGE.scripts["asset:export-lods"], /asset:compress-lods/);
  assert.match(PACKAGE.scripts["asset:export-lods:raw"], /asset:export-lod0/);
  assert.match(PACKAGE.scripts["asset:export-lods:raw"], /asset:export-lod1/);
  assert.match(PACKAGE.scripts["asset:export-lods:raw"], /asset:export-lod2/);
  assert.match(PACKAGE.scripts["asset:bake-textures"], /uv_and_bake\.py/);
  assert.match(PACKAGE.scripts["asset:compress-lods"], /compress-daliuren-glbs\.mjs/);
  assert.match(PACKAGE.scripts["asset:install-python-tools"], /requirements-assets\.txt/);
  assert.match(ASSET_REQUIREMENTS, /^alktx2==0\.1\.7/m);
  assert.match(
    ASSET_REQUIREMENTS,
    /sha256:a0952acacaeb7de1ef15e157fcf9de368eabe687fb1d358d50fd5c3a05c6cb05/,
  );
  assert.match(PACKAGE.scripts["asset:validate"], /daliuren-artifact-lod0\.glb/);
  assert.match(PACKAGE.scripts["asset:validate"], /daliuren-artifact-lod1\.glb/);
  assert.match(PACKAGE.scripts["asset:validate"], /daliuren-artifact-lod2\.glb/);
});

test("requires BasisU textures within the selected LOD dimensions", () => {
  const invalid = validLodDocument({
    textures: [
      { name: "bronze-hero-basecolor", mimeType: "image/png", size: [4096, 2048] },
      { name: "celadon-moving-normal", size: [2048, 1024] },
    ],
    extensionsUsed: [],
  });

  assert.deepEqual(validateArtifactDocument(invalid, LOD_CONTRACT, { lodId: "lod2" }), [
    "required extension missing: KHR_texture_basisu",
    "texture dimensions: bronze-hero-basecolor expected <= 2048x2048, got 4096x2048",
    "texture dimensions: celadon-moving-normal expected <= 1024x1024, got 2048x1024",
    "texture mime type: bronze-hero-basecolor expected image/ktx2, got image/png",
  ]);
});

test("parses KTX2 supercompression and enforces ETC1S color versus UASTC data slots", () => {
  assert.deepEqual(
    validateKtx2Encoding("color", ktx2Buffer(1), ["baseColorTexture"]),
    [],
  );
  assert.deepEqual(
    validateKtx2Encoding("data", ktx2Buffer(2), ["normalTexture"]),
    [],
  );
  assert.deepEqual(
    validateKtx2Encoding("color", ktx2Buffer(2, { colorModel: 163 }), ["baseColorTexture"]),
    ["texture encoding: color expected ETC1S/BasisLZ for color slots, got UASTC/Zstd"],
  );
  assert.deepEqual(
    validateKtx2Encoding("data", ktx2Buffer(1, { colorModel: 166 }), ["metallicRoughnessTexture"]),
    ["texture encoding: data expected UASTC/Zstd for data slots, got ETC1S/BasisLZ"],
  );
  assert.deepEqual(
    validateKtx2Encoding("broken", Buffer.from("not-ktx2"), ["baseColorTexture"]),
    ["texture encoding: broken has an invalid KTX2 header"],
  );
});

test("rejects scheme-2 impostors without an undefined Vulkan format and UASTC DFD model", () => {
  assert.deepEqual(
    validateKtx2Encoding(
      "vk-format-impostor",
      ktx2Buffer(2, { vkFormat: 37, colorModel: 166 }),
      ["normalTexture"],
    ),
    ["texture encoding: vk-format-impostor expected vkFormat 0, got 37"],
  );
  assert.deepEqual(
    validateKtx2Encoding(
      "dfd-impostor",
      ktx2Buffer(2, { colorModel: 163 }),
      ["normalTexture"],
    ),
    ["texture encoding: dfd-impostor expected UASTC DFD color model 166, got 163"],
  );
});

test("runtime validation reads committed KTX2 bytes instead of trusting MIME declarations", () => {
  const invalid = validLodDocument({
    textures: [
      {
        name: "bronze-hero-basecolor",
        size: [2048, 2048],
        scheme: 2,
        slots: ["baseColorTexture"],
      },
      {
        name: "celadon-moving-normal",
        size: [1024, 1024],
        scheme: 1,
        slots: ["normalTexture"],
      },
    ],
  });

  assert.deepEqual(validateArtifactDocument(invalid, LOD_CONTRACT, { lodId: "lod2" }), [
    "texture encoding: bronze-hero-basecolor expected ETC1S/BasisLZ for color slots, got UASTC/Zstd",
    "texture encoding: celadon-moving-normal expected UASTC/Zstd for data slots, got ETC1S/BasisLZ",
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
