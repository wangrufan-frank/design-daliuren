import { spawnSync } from "node:child_process";
import {
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRTextureBasisu } from "@gltf-transform/extensions";
import { listTextureSlots } from "@gltf-transform/functions";

const LOD_FILES = [0, 1, 2].map(
  (level) => `public/models/daliuren/daliuren-artifact-lod${level}.glb`,
);
const COLOR_SLOTS = new Set(["baseColorTexture", "emissiveTexture"]);
const DATA_SLOTS = new Set([
  "normalTexture",
  "occlusionTexture",
  "metallicRoughnessTexture",
]);

export function textureEncoderMode(slots) {
  const hasColor = slots.some((slot) => COLOR_SLOTS.has(slot));
  const hasData = slots.some((slot) => DATA_SLOTS.has(slot));
  const unsupported = slots.filter(
    (slot) => !COLOR_SLOTS.has(slot) && !DATA_SLOTS.has(slot),
  );
  if (unsupported.length) {
    throw new Error(`Texture uses unsupported material slots: ${unsupported.join(", ")}`);
  }
  if (hasColor && hasData) {
    throw new Error("Texture cannot be shared by both color and data slots");
  }
  if (!hasColor && !hasData) {
    throw new Error("Texture has no supported material slot");
  }
  return hasData ? "uastc" : "etc1s";
}

function defaultRun(command, args, options = {}) {
  const result = spawnSync(command, args, {
    ...options,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} exited ${result.status}${output ? `\n${output}` : ""}`);
  }
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

export async function encodeTexture(texture, slots, {
  temporary,
  root,
  python,
  run,
  index,
}) {
  const mode = textureEncoderMode(slots);
  const image = texture.getImage();
  const mimeType = texture.getMimeType();
  if (!image || !mimeType) {
    throw new Error(`Texture has no embedded image: ${texture.getName() || index}`);
  }
  const prefix = String(index).padStart(2, "0");
  const input = join(temporary, `${prefix}-source.bin`);
  const output = join(temporary, `${prefix}-${mode}.ktx2`);
  await writeFile(input, image);
  run(python, [
    join(root, "tools", "python", "encode_ktx2.py"),
    "--mode",
    mode,
    "--mime",
    mimeType,
    input,
    output,
  ]);
  texture.setImage(await readFile(output)).setMimeType("image/ktx2");
}

async function transformGlb(source, destination, {
  temporary,
  root,
  python,
  run,
}) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(source);
  document.createExtension(KHRTextureBasisu).setRequired(true);
  const textures = document.getRoot().listTextures();
  for (const [index, texture] of textures.entries()) {
    await encodeTexture(texture, listTextureSlots(texture), {
      temporary,
      root,
      python,
      run,
      index,
    });
  }
  await io.write(destination, document);
}

export async function compressGlb(inputPath, {
  root = process.cwd(),
  python = process.env.DALIUREN_PYTHON ?? "python",
  run = defaultRun,
  transform = transformGlb,
  replace = rename,
} = {}) {
  const source = resolve(inputPath);
  const temporary = await mkdtemp(join(dirname(source), ".daliuren-ktx2-"));
  const compressed = join(
    dirname(source),
    `.${basename(source)}.${basename(temporary)}.candidate.glb`,
  );
  try {
    await transform(source, compressed, {
      temporary,
      root,
      python,
      run,
    });
    await replace(compressed, source);
  } finally {
    await rm(compressed, { force: true });
    await rm(temporary, { recursive: true, force: true });
  }
  return source;
}

export async function compressLods({ root = process.cwd() } = {}) {
  for (const relativePath of LOD_FILES) {
    const output = await compressGlb(join(root, relativePath), { root });
    console.log(`Compressed KTX2 GLB: ${output}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  compressLods().catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  });
}
