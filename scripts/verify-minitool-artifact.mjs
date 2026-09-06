import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectMiniToolDirectory } from "./validate-minitool.mjs";

const ZIP_LIMIT = 10 * 1024 * 1024;

function hash(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function slash(path) {
  return path.split("\\").join("/");
}

function directoryEntries(root) {
  const entries = [];
  function walk(current) {
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) walk(path);
      else {
        const bytes = readFileSync(path);
        entries.push({ name: slash(relative(root, path)), size: bytes.length, sha256: hash(bytes) });
      }
    }
  }
  walk(root);
  return entries.sort((left, right) => left.name.localeCompare(right.name));
}

function zipEntries(zipPath) {
  const source = [
    "import hashlib,json,sys,zipfile",
    "with zipfile.ZipFile(sys.argv[1]) as archive:",
    " print(json.dumps([{'name':i.filename,'size':i.file_size,'sha256':hashlib.sha256(archive.read(i)).hexdigest()} for i in archive.infolist() if not i.is_dir()]))",
  ].join("\n");
  return JSON.parse(execFileSync("python", ["-c", source, zipPath], { encoding: "utf8" }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function verifyMiniToolArtifact({
  directory = "artifacts/daliuren-minitool",
  zipPath = "artifacts/daliuren-minitool.zip",
  validationOptions,
} = {}) {
  const root = resolve(directory);
  const archive = resolve(zipPath);
  const inspected = inspectMiniToolDirectory(root, validationOptions);
  const errors = [...inspected.errors];
  let zipBytes = 0;
  let zipSha256 = "";
  let assets = [];

  if (existsSync(root)) {
    const appPath = join(root, "assets", "app.js");
    if (existsSync(appPath)) {
      const app = readFileSync(appPath, "utf8");
      for (const token of ["writeTempFile", "saveImageToPhotosAlbum", "webglcontextlost", "visibilitychange", "devicePixelRatio"]) {
        if (!app.includes(token)) errors.push(`构建 JS 缺少 ${token}`);
      }
    }
    const assetRoot = join(root, "assets");
    if (existsSync(assetRoot)) assets = readdirSync(assetRoot).sort();
    for (const entry of directoryEntries(root)) {
      if (extname(entry.name) === ".map") errors.push(`禁止 source map: ${entry.name}`);
    }
  }

  if (!existsSync(archive)) {
    errors.push("缺少 ZIP 产物");
  } else {
    const zipBuffer = readFileSync(archive);
    zipBytes = zipBuffer.length;
    zipSha256 = hash(zipBuffer);
    if (zipBytes > ZIP_LIMIT) errors.push(`ZIP 超过 10 MiB (${zipBytes} bytes)`);
    try {
      const entries = zipEntries(archive);
      if (!entries.some(({ name }) => name === "index.html")) errors.push("ZIP 根目录缺少 index.html");
      if (entries.some(({ name }) => name.startsWith("daliuren-minitool/"))) errors.push("ZIP 存在多余顶层目录");
      if (existsSync(root) && JSON.stringify(entries) !== JSON.stringify(directoryEntries(root))) {
        errors.push("ZIP 内容与产物目录不一致");
      }
    } catch (error) {
      errors.push(`ZIP 无法读取: ${error.message}`);
    }
  }

  return {
    errors,
    zipBytes,
    zipSha256,
    assets,
    model: inspected.model,
    referenceTextureCount: inspected.referenceTextureCount,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = verifyMiniToolArtifact();
  if (result.errors.length) {
    console.error(result.errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log([
      "Mini-tool artifact verification: PASS",
      `ZIP bytes: ${result.zipBytes}`,
      `ZIP SHA256: ${result.zipSha256}`,
      `Model: ${result.model.triangles} triangles, ${result.model.drawCalls} draw calls, ${result.model.nodeCount} nodes`,
      `Reference textures: ${result.referenceTextureCount}`,
      `Assets: ${result.assets.join(", ")}`,
    ].join("\n"));
  }
}
