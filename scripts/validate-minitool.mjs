import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MiB = 1024 * 1024;
const SCRIPT_LIMIT = 2 * MiB;
const ENCODED_FIELD_LIMIT = MiB;
const MODEL_NAMES = ["earth", "heaven", "generals", "core"];
const MODEL_SCRIPTS = MODEL_NAMES.map((name) => `./assets/model-${name}.js`);
const EXPECTED_SCRIPTS = [...MODEL_SCRIPTS, "./assets/app.js"];
const ALLOWED = new Set([".html", ".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".woff", ".woff2", ".json"]);
const TEXT_EXTENSIONS = new Set([".html", ".css", ".js", ".svg", ".json"]);
const FORBIDDEN = [
  [/\bfetch\s*\(/, "fetch"], [/XMLHttpRequest/, "XMLHttpRequest"], [/WebAssembly/, "WebAssembly"],
  [/new\s+(?:Shared)?Worker\s*\(/, "Worker"], [/navigator\.serviceWorker/, "Service Worker"],
  [/navigator\.clipboard/, "navigator.clipboard"], [/window\.open/, "window.open"],
  [/\beval\s*\(/, "eval"], [/new\s+Function\b/, "new Function"], [/\bdownload\s*=/i, "download="],
  [/type\s*=\s*["']module["']/i, 'type="module"'], [/https?:\/\/(?!www\.w3\.org\/)/i, "external URL"],
  [/\.glb\b/i, ".glb"], [/\bKTX2?\b|\.ktx2\b/i, "KTX2"], [/\.wasm\b/i, ".wasm"],
  [/data:image\//i, "Base64 image"], [/\.flatMap\s*\(/, "Array.flatMap"],
  [/\.at\s*\(\s*-?\d+\s*\)/, "Array.at"], [/Object\.fromEntries\s*\(/, "Object.fromEntries"],
  [/Object\.hasOwn\s*\(/, "Object.hasOwn"],
];
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function slash(path) {
  return path.split("\\").join("/");
}

function walk(root) {
  const files = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

function readDefaults(options) {
  return {
    modelContract: options.modelContract || JSON.parse(readFileSync(resolve(repositoryRoot, "src/minitool/artifact/model-parity-contract.json"), "utf8")),
    referenceManifest: options.referenceManifest || JSON.parse(readFileSync(resolve(repositoryRoot, "src/minitool/assets/reference-surfaces/manifest.json"), "utf8")),
  };
}

function pngDimensions(buffer) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (buffer.length < 24 || signature.some((byte, index) => buffer[index] !== byte) || buffer.toString("ascii", 12, 16) !== "IHDR") return [0, 0];
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

function jpegDimensions(buffer) {
  let offset = 2;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return [0, 0];
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return [buffer.readUInt16BE(offset + 7), buffer.readUInt16BE(offset + 5)];
    if (length < 2) break;
    offset += 2 + length;
  }
  return [0, 0];
}

function parseModelPart(source, name) {
  const marker = `parts.${name} = `;
  const start = source.indexOf(marker);
  const end = source.lastIndexOf(";\n}());");
  if (start < 0 || end < 0 || end <= start) throw new Error(`不是有效的 model-${name}.js 数据脚本`);
  return JSON.parse(source.slice(start + marker.length, end));
}

function collectEncodedFields(value, output = []) {
  if (!value || typeof value !== "object") return output;
  if (typeof value.data === "string") output.push(value.data);
  const children = Array.isArray(value) ? value : Object.values(value);
  for (const child of children) collectEncodedFields(child, output);
  return output;
}

function inspectModel(root, contract, errors) {
  const assets = join(root, "assets");
  const parts = {};
  for (const name of MODEL_NAMES) {
    const file = join(assets, `model-${name}.js`);
    if (!existsSync(file)) {
      errors.push(`缺少 assets/model-${name}.js`);
      continue;
    }
    const bytes = statSync(file).size;
    if (bytes >= SCRIPT_LIMIT) errors.push(`assets/model-${name}.js 超过 2 MiB (${bytes} bytes)`);
    try {
      parts[name] = parseModelPart(readFileSync(file, "utf8"), name);
    } catch (error) {
      errors.push(`assets/model-${name}.js: ${error.message}`);
    }
  }

  const model = { triangles: 0, drawCalls: 0, nodeCount: 0, largestEncodedFieldBytes: 0 };
  const hiddenMeshKeys = new Set(contract.runtime?.hiddenMeshKeys || []);
  const referenceSurfaceDrawCalls = contract.runtime?.referenceSurfaceDrawCalls;
  if (!Array.isArray(contract.runtime?.hiddenMeshKeys)) errors.push("模型契约缺少运行时隐藏网格清单");
  if (!Number.isSafeInteger(referenceSurfaceDrawCalls) || referenceSurfaceDrawCalls < 0) {
    errors.push("模型契约的参考表面 draw call 无效");
  }
  const nodeIds = [];
  for (const name of MODEL_NAMES) {
    const part = parts[name];
    if (!part) continue;
    if (!Array.isArray(part.nodes) || !Array.isArray(part.meshes)) {
      errors.push(`assets/model-${name}.js: nodes/meshes 清单无效`);
      continue;
    }
    model.drawCalls += part.meshes.filter((mesh) => !hiddenMeshKeys.has(`${mesh.nodeId}\0${mesh.materialId}`)).length;
    nodeIds.push(...part.nodes.map((node) => node.id));
    for (const mesh of part.meshes) {
      const count = mesh?.indices?.count;
      if (!Number.isSafeInteger(count) || count < 0) errors.push(`assets/model-${name}.js: 索引三角形计数无效`);
      else model.triangles += count;
    }
    for (const data of collectEncodedFields(part)) {
      const bytes = Buffer.byteLength(data, "utf8");
      model.largestEncodedFieldBytes = Math.max(model.largestEncodedFieldBytes, bytes);
      if (bytes >= ENCODED_FIELD_LIMIT) errors.push(`assets/model-${name}.js: 编码字段 ${bytes} bytes，必须小于 1048576 bytes`);
    }
  }
  model.nodeCount = new Set(nodeIds).size;
  const expectedNodes = new Set(contract.nodeIds);
  const actualNodes = new Set(nodeIds);
  const missingNodes = [...expectedNodes].filter((id) => !actualNodes.has(id));
  const unexpectedNodes = [...actualNodes].filter((id) => !expectedNodes.has(id));
  if (missingNodes.length) errors.push(`模型清单缺少节点: ${missingNodes.join(", ")}`);
  if (unexpectedNodes.length) errors.push(`模型清单包含未授权节点: ${unexpectedNodes.join(", ")}`);
  if (nodeIds.length !== actualNodes.size) errors.push("模型清单包含重复节点");
  if (model.triangles > contract.budget.triangles) errors.push(`模型三角形 ${model.triangles} 超过预算 ${contract.budget.triangles}`);
  return model;
}

function inspectReferenceSurfaces(root, manifest, errors) {
  const surfaceRoot = join(root, "assets", "reference-surfaces");
  const declared = new Map();
  const semanticLayers = [...(manifest.layers || []), ...(manifest.nativeLayers || [])];
  for (const layer of manifest.layers || []) declared.set(layer.texture, manifest.rectified);
  for (const layer of manifest.nativeLayers || []) declared.set(layer.texture, layer.sourceRect);
  if (existsSync(surfaceRoot)) {
    for (const texture of readdirSync(surfaceRoot).filter((name) => extname(name).toLowerCase() === ".png")) {
      if (!declared.has(texture)) errors.push(`assets/reference-surfaces/${texture}: 未在清单声明`);
    }
  }
  for (const [texture, expected] of declared) {
    const path = join(surfaceRoot, texture);
    if (!existsSync(path)) {
      errors.push(`缺少 assets/reference-surfaces/${texture}`);
      continue;
    }
    const bytes = readFileSync(path);
    const [width, height] = pngDimensions(bytes);
    if (!width || !height) errors.push(`assets/reference-surfaces/${texture}: PNG 无效`);
    if (width > 1024 || height > 1024) errors.push(`assets/reference-surfaces/${texture}: ${width}x${height} 超过 1024 纹理边长`);
    if (expected && (width !== expected.width || height !== expected.height)) {
      errors.push(`assets/reference-surfaces/${texture}: 尺寸 ${width}x${height} 与清单 ${expected.width}x${expected.height} 不符`);
    }
    const integrity = manifest.textureIntegrity?.[texture];
    if (!integrity) {
      errors.push(`assets/reference-surfaces/${texture}: 清单缺少内容完整性记录`);
      continue;
    }
    const actualHash = createHash("sha256").update(bytes).digest("hex");
    if (actualHash !== integrity.sha256) errors.push(`assets/reference-surfaces/${texture}: SHA256 与权威清单不符`);
    if (width !== integrity.width || height !== integrity.height) {
      errors.push(`assets/reference-surfaces/${texture}: 尺寸与完整性清单不符`);
    }
    const semanticIds = semanticLayers.filter((layer) => layer.texture === texture).map(({ id }) => id);
    if (JSON.stringify(semanticIds) !== JSON.stringify(integrity.semanticIds)) {
      errors.push(`assets/reference-surfaces/${texture}: 语义图层映射与完整性清单不符`);
    }
  }
  for (const texture of Object.keys(manifest.textureIntegrity || {})) {
    if (!declared.has(texture)) errors.push(`参考表面完整性清单包含未声明纹理 ${texture}`);
  }
  return { textureCount: declared.size };
}

function inspectHtml(root, errors) {
  const path = join(root, "index.html");
  if (!existsSync(path)) {
    errors.push("根目录缺少 index.html");
    return;
  }
  const html = readFileSync(path, "utf8");
  if (!/^\s*<!doctype html>/i.test(html)) errors.push("index.html 缺少 DOCTYPE");
  if (!/<html\b[^>]*\blang\s*=\s*["']zh-CN["']/i.test(html)) errors.push('index.html 缺少 lang="zh-CN"');
  if (!/<meta\b[^>]*\bcharset\s*=\s*["']?UTF-8/i.test(html)) errors.push("index.html 缺少 UTF-8 charset");
  const viewport = html.match(/<meta\b[^>]*\bname\s*=\s*["']viewport["'][^>]*>/i)?.[0] || "";
  for (const token of ["width=device-width", "initial-scale=1.0", "viewport-fit=cover"]) {
    if (!viewport.includes(token)) errors.push(`index.html viewport 缺少 ${token}`);
  }
  const scriptSources = [...html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  const relevant = scriptSources.filter((source) => EXPECTED_SCRIPTS.includes(source));
  if (JSON.stringify(relevant) !== JSON.stringify(EXPECTED_SCRIPTS)) {
    errors.push(`模型脚本加载顺序必须为 ${EXPECTED_SCRIPTS.join(" -> ")}`);
  }
  for (const match of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    const resource = match[1];
    if (!resource.startsWith("./")) errors.push(`index.html: 资源路径必须以 ./ 开头 (${resource})`);
    else if (!existsSync(join(root, resource.slice(2).split(/[?#]/)[0]))) errors.push(`index.html: 缺少引用资源 ${resource}`);
  }
  if (/<script\b(?![^>]*\bsrc=)[^>]*>/i.test(html)) errors.push("index.html: 禁止内联脚本");
}

export function inspectMiniToolDirectory(directory, options = {}) {
  const root = resolve(directory);
  const errors = [];
  const emptyModel = { triangles: 0, drawCalls: 0, nodeCount: 0, largestEncodedFieldBytes: 0 };
  if (!existsSync(root)) return { errors: ["产物目录不存在"], model: emptyModel, referenceTextureCount: 0 };
  const { modelContract, referenceManifest } = readDefaults(options);
  inspectHtml(root, errors);
  const files = walk(root);
  const allowedFiles = new Set([
    "index.html",
    "assets/style.css",
    "assets/app.js",
    "assets/earth-board.jpg",
    "assets/atlas/waterfall.jpg",
    "assets/atlas/pines.jpg",
    ...["landscape", "bronze", "bird", "dragon", "tiger", "textile"].map((name) => `assets/atlas/${name}.jpg`),
    ...MODEL_NAMES.map((name) => `assets/model-${name}.js`),
    ...Object.keys(referenceManifest.textureIntegrity || {}).map((texture) => `assets/reference-surfaces/${texture}`),
  ]);
  const actualFiles = new Set(files.map((file) => slash(relative(root, file))));
  for (const file of files) {
    const rel = slash(relative(root, file));
    if (!allowedFiles.has(rel)) errors.push(`${rel}: 未在产物白名单`);
    const ext = extname(file).toLowerCase();
    if (!ALLOWED.has(ext)) errors.push(`${rel}: 不允许的文件类型 ${ext || "(无扩展名)"}`);
    if (ext === ".html" && rel !== "index.html") errors.push(`${rel}: 仅允许根目录 index.html`);
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    const text = readFileSync(file, "utf8");
    for (const [pattern, label] of FORBIDDEN) if (pattern.test(text)) errors.push(`${rel}: 包含禁用内容 ${label}`);
  }
  for (const expected of allowedFiles) {
    if (!actualFiles.has(expected)) errors.push(`${expected}: 白名单文件缺失`);
  }
  const appPath = join(root, "assets", "app.js");
  if (!existsSync(appPath)) errors.push("缺少 assets/app.js");
  else if (statSync(appPath).size >= SCRIPT_LIMIT) errors.push(`assets/app.js 超过 2 MiB (${statSync(appPath).size} bytes)`);
  const earthTexture = join(root, "assets", "earth-board.jpg");
  if (!existsSync(earthTexture)) errors.push("缺少 assets/earth-board.jpg");
  else {
    const [width, height] = jpegDimensions(readFileSync(earthTexture));
    const expected = modelContract.budget.textureSize;
    if (width !== expected || height !== expected) errors.push(`地盘纹理尺寸错误: ${width}x${height}，应为 ${expected}x${expected}`);
  }
  for (const name of ["waterfall.jpg", "pines.jpg", "landscape.jpg", "bronze.jpg", "bird.jpg", "dragon.jpg", "tiger.jpg", "textile.jpg"]) {
    const image = join(root, "assets/atlas", name);
    if (!existsSync(image)) continue;
    const bytes = readFileSync(image);
    const [width, height] = jpegDimensions(bytes);
    if (!width || !height || width > 1024 || height > 1024 || bytes.length > MiB / 2) errors.push("assets/atlas/" + name + ": 图鉴图片必须是有效 JPEG，边长不超过 1024 且小于 512 KiB");
  }
  const model = inspectModel(root, modelContract, errors);
  const reference = inspectReferenceSurfaces(root, referenceManifest, errors);
  model.drawCalls += modelContract.runtime?.referenceSurfaceDrawCalls || 0;
  if (model.drawCalls > modelContract.budget.drawCalls) {
    errors.push(`模型 draw call ${model.drawCalls} 超过预算 ${modelContract.budget.drawCalls}`);
  }
  const referenceTextureCount = reference.textureCount;
  return { errors, model, referenceTextureCount };
}

export function validateMiniToolDirectory(directory, options) {
  return inspectMiniToolDirectory(directory, options).errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = inspectMiniToolDirectory(process.argv[2] || "artifacts/daliuren-minitool");
  if (result.errors.length) {
    console.error(result.errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Mini-tool static validation: PASS (0 errors)\nModel: ${result.model.triangles} triangles, ${result.model.drawCalls} draw calls, ${result.model.nodeCount} nodes\nReference textures: ${result.referenceTextureCount}`);
  }
}
