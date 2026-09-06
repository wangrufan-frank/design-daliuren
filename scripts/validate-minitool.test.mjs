import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inspectMiniToolDirectory, validateMiniToolDirectory } from "./validate-minitool.mjs";

const MiB = 1024 * 1024;
const modelNames = ["earth", "heaven", "generals", "core"];

function png(width, height) {
  const buffer = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function surface(width, height, identity) {
  return Buffer.concat([png(width, height), Buffer.from(identity)]);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function jpeg(width, height) {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08,
    height >> 8, height & 0xff, width >> 8, width & 0xff,
    0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    0xff, 0xd9,
  ]);
}

function partSource(name, part) {
  return `;(function () {\n  var parts = window.__DALIUREN_MODEL_PARTS__ || (window.__DALIUREN_MODEL_PARTS__ = {});\n  parts.${name} = ${JSON.stringify(part)};\n}());\n`;
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "minitool-valid-"));
  const assets = join(root, "assets");
  const surfaces = join(assets, "reference-surfaces");
  mkdirSync(surfaces, { recursive: true });
  writeFileSync(join(root, "index.html"), `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"><link rel="stylesheet" href="./assets/style.css"></head><body><script src="./assets/model-earth.js"></script><script src="./assets/model-heaven.js"></script><script src="./assets/model-generals.js"></script><script src="./assets/model-core.js"></script><script src="./assets/app.js"></script></body></html>`);
  writeFileSync(join(assets, "style.css"), "body{color:#123}");
  writeFileSync(join(assets, "app.js"), "window.app={ready:true};");
  writeFileSync(join(assets, "earth-board.jpg"), jpeg(1024, 1024));
  mkdirSync(join(assets, "atlas"));
  for (const name of ["waterfall.jpg", "pines.jpg", "landscape.jpg", "bronze.jpg", "bird.jpg", "dragon.jpg", "tiger.jpg", "textile.jpg"]) writeFileSync(join(assets, "atlas", name), jpeg(1000, 880));
  writeFileSync(join(surfaces, "earth-detail-0.png"), surface(643, 612, "earth"));
  writeFileSync(join(surfaces, "general-detail-00.png"), surface(411, 301, "noble"));
  writeFileSync(join(surfaces, "general-detail-01.png"), surface(411, 301, "snake"));
  for (const name of modelNames) {
    const part = name === "earth"
      ? { nodes: [{ id: "plate/earth" }], meshes: [{ materialId: "RT_M_JadeBody_uniform", indices: { count: 2, data: "AA==" } }], materials: [] }
      : { nodes: [], meshes: [], materials: [] };
    writeFileSync(join(assets, `model-${name}.js`), partSource(name, part));
  }
  return root;
}

function validationOptions(overrides = {}) {
  const earth = surface(643, 612, "earth");
  const noble = surface(411, 301, "noble");
  const snake = surface(411, 301, "snake");
  return {
    modelContract: {
      nodeIds: ["plate/earth"],
      budget: { triangles: 100000, drawCalls: 50, textureSize: 1024 },
      runtime: { hiddenMeshKeys: [], referenceSurfaceDrawCalls: 0 },
    },
    referenceManifest: {
      rectified: { width: 1024, height: 1024 },
      layers: [],
      nativeLayers: [
        { id: "reference-native/earth/0", kind: "earth", ownerId: "plate/earth", texture: "earth-detail-0.png", sourceRect: { width: 643, height: 612 } },
        { id: "reference-native/general/贵人", kind: "general", name: "贵人", ownerId: "general/noble", texture: "general-detail-00.png", sourceRect: { width: 411, height: 301 } },
        { id: "reference-native/general/螣蛇", kind: "general", name: "螣蛇", ownerId: "general/snake", texture: "general-detail-01.png", sourceRect: { width: 411, height: 301 } },
      ],
      textureIntegrity: {
        "earth-detail-0.png": { sha256: sha256(earth), width: 643, height: 612, semanticIds: ["reference-native/earth/0"] },
        "general-detail-00.png": { sha256: sha256(noble), width: 411, height: 301, semanticIds: ["reference-native/general/贵人"] },
        "general-detail-01.png": { sha256: sha256(snake), width: 411, height: 301, semanticIds: ["reference-native/general/螣蛇"] },
      },
    },
    ...overrides,
  };
}

test("accepts a complete package and reports real model statistics", () => {
  const root = createFixture();
  try {
    const result = inspectMiniToolDirectory(root, validationOptions());
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.model, {
      triangles: 2,
      drawCalls: 1,
      nodeCount: 1,
      largestEncodedFieldBytes: 4,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("does not budget packaged reference textures as runtime draw calls", () => {
  const root = createFixture();
  try {
    const heaven = surface(1024, 1024, "heaven");
    writeFileSync(join(root, "assets/reference-surfaces/heaven.png"), heaven);
    const options = validationOptions();
    options.referenceManifest.layers = [
      { id: "reference-rectified/heaven", kind: "heaven", ownerId: "plate/heaven", texture: "heaven.png" },
    ];
    options.referenceManifest.textureIntegrity["heaven.png"] = {
      sha256: sha256(heaven),
      width: 1024,
      height: 1024,
      semanticIds: ["reference-rectified/heaven"],
    };

    const result = inspectMiniToolDirectory(root, options);
    assert.deepEqual(result.errors, []);
    assert.equal(result.model.drawCalls, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("requires all four model scripts in dependency order", () => {
  const missing = createFixture();
  const reordered = createFixture();
  try {
    rmSync(join(missing, "assets/model-core.js"));
    const missingErrors = validateMiniToolDirectory(missing, validationOptions()).join("\n");
    assert.match(missingErrors, /model-core\.js/);

    const htmlPath = join(reordered, "index.html");
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"></head><body><script src="./assets/model-heaven.js"></script><script src="./assets/model-earth.js"></script><script src="./assets/model-generals.js"></script><script src="./assets/model-core.js"></script><script src="./assets/app.js"></script></body></html>`;
    writeFileSync(htmlPath, html);
    assert.match(validateMiniToolDirectory(reordered, validationOptions()).join("\n"), /加载顺序/);
  } finally {
    rmSync(missing, { recursive: true, force: true });
    rmSync(reordered, { recursive: true, force: true });
  }
});

test("rejects model budgets and oversized encoded geometry using parsed payloads", () => {
  const root = createFixture();
  const drawCalls = createFixture();
  try {
    const oversized = {
      nodes: [{ id: "plate/earth" }],
      meshes: [{ indices: { count: 100001, data: "A".repeat(MiB + 1) } }],
      materials: [],
    };
    writeFileSync(join(root, "assets/model-earth.js"), partSource("earth", oversized));
    const errors = validateMiniToolDirectory(root, validationOptions()).join("\n");
    assert.match(errors, /100001.*100000/);
    assert.match(errors, /编码字段.*1048576/);
    const drawCallErrors = validateMiniToolDirectory(drawCalls, validationOptions({
      modelContract: {
        nodeIds: ["plate/earth"],
        budget: { triangles: 100000, drawCalls: 0, textureSize: 1024 },
        runtime: { hiddenMeshKeys: [], referenceSurfaceDrawCalls: 0 },
      },
    })).join("\n");
    assert.match(drawCallErrors, /draw call 1.*预算 0/);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(drawCalls, { recursive: true, force: true });
  }
});

test("requires every manifest surface at its declared native dimensions", () => {
  const missing = createFixture();
  const wrongSize = createFixture();
  const undeclared = createFixture();
  try {
    rmSync(join(missing, "assets/reference-surfaces/earth-detail-0.png"));
    assert.match(validateMiniToolDirectory(missing, validationOptions()).join("\n"), /earth-detail-0\.png/);
    writeFileSync(join(wrongSize, "assets/reference-surfaces/earth-detail-0.png"), png(1025, 612));
    assert.match(validateMiniToolDirectory(wrongSize, validationOptions()).join("\n"), /1025x612.*1024/);
    writeFileSync(join(undeclared, "assets/reference-surfaces/full-reference.png"), png(1024, 1024));
    assert.match(validateMiniToolDirectory(undeclared, validationOptions()).join("\n"), /full-reference\.png.*未在清单声明/);
  } finally {
    rmSync(missing, { recursive: true, force: true });
    rmSync(wrongSize, { recursive: true, force: true });
    rmSync(undeclared, { recursive: true, force: true });
  }
});

test("rejects same-sized general textures when their semantic contents are exchanged", () => {
  const root = createFixture();
  try {
    const noblePath = join(root, "assets/reference-surfaces/general-detail-00.png");
    const snakePath = join(root, "assets/reference-surfaces/general-detail-01.png");
    const noble = readFileSync(noblePath);
    writeFileSync(noblePath, readFileSync(snakePath));
    writeFileSync(snakePath, noble);
    const errors = validateMiniToolDirectory(root, validationOptions()).join("\n");
    assert.match(errors, /general-detail-00\.png.*SHA256/);
    assert.match(errors, /general-detail-01\.png.*SHA256/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects every file outside the manifest-derived package allow-list", () => {
  const root = createFixture();
  try {
    writeFileSync(join(root, "assets/extra.json"), '{"sensitive":true}');
    assert.match(
      validateMiniToolDirectory(root, validationOptions()).join("\n"),
      /assets\/extra\.json.*未在产物白名单/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects container-forbidden files, runtime dependencies, and malformed earth texture", () => {
  const root = createFixture();
  try {
    writeFileSync(join(root, "assets/app.js"), "fetch('x.glb');new Worker('x.js');var decoder='KTX2';var image='data:image/png;base64,x';Object.hasOwn({},'x');");
    writeFileSync(join(root, "model.wasm"), "x");
    writeFileSync(join(root, "assets/earth-board.jpg"), jpeg(512, 1024));
    const errors = validateMiniToolDirectory(root, validationOptions()).join("\n");
    for (const token of ["fetch", ".glb", "Worker", "KTX2", "Base64", "Object.hasOwn", ".wasm", "512x1024"]) {
      assert.match(errors, new RegExp(token.replace(".", "\\.")));
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a missing or oversized atlas image", () => {
  const root = createFixture();
  try {
    rmSync(join(root, "assets/atlas/pines.jpg"));
    writeFileSync(join(root, "assets/atlas/waterfall.jpg"), jpeg(4000, 4000));
    const errors = validateMiniToolDirectory(root, validationOptions());
    assert.ok(errors.some((error) => error.includes("pines.jpg") && error.includes("缺失")));
    assert.ok(errors.some((error) => error.includes("waterfall.jpg") && error.includes("图鉴图片")));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
