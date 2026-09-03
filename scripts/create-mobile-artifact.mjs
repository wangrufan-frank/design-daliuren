import { NodeIO } from "@gltf-transform/core";
import { KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";
import { prune } from "@gltf-transform/functions";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const source = "public/models/daliuren/daliuren-artifact-lod2.glb";
const destination = "public/models/daliuren/daliuren-artifact-mobile.glb";
const outerBoardSource = "assets/daliuren/textures/source/outer-board-v10-albedo.png";
const jade = [0.94, 0.91, 0.84, 1];
const recess = [0.68, 0.67, 0.61, 1];
const gold = [0.55, 0.32, 0.1, 1];

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
const document = await io.read(source);
const temporary = await mkdtemp(join(tmpdir(), "daliuren-mobile-"));
const outerBoardJpeg = join(temporary, "outer-board-v10.jpg");
let outerBoardImage;
try {
  const resize = spawnSync(process.env.DALIUREN_PYTHON ?? "python", [
    "tools/python/resize_mobile_texture.py",
    outerBoardSource,
    outerBoardJpeg,
    "--size",
    "1024",
  ], { encoding: "utf8" });
  if (resize.error) throw resize.error;
  if (resize.status !== 0) throw new Error(resize.stderr || `Mobile texture resize exited ${resize.status}`);
  outerBoardImage = await readFile(outerBoardJpeg);
} finally {
  await rm(outerBoardJpeg, { force: true });
  await rmdir(temporary);
}
const outerBoardTexture = document.createTexture("mobile-outer-board-v10-albedo")
  .setImage(outerBoardImage)
  .setMimeType("image/jpeg");

for (const material of document.getRoot().listMaterials()) {
  material
    .setBaseColorTexture(null)
    .setNormalTexture(null)
    .setMetallicRoughnessTexture(null)
    .setOcclusionTexture(null)
    .setEmissiveTexture(null);
  const family = material.getExtras().material_family;
  if (family === "M_JadeBody") material.setBaseColorFactor(jade).setMetallicFactor(0).setRoughnessFactor(0.3);
  if (material.getExtras().runtime_projection === "outer-board-v10") {
    material.setBaseColorFactor([1, 1, 1, 1]).setBaseColorTexture(outerBoardTexture);
  }
  if (family === "M_JadeRecess") material.setBaseColorFactor(recess).setMetallicFactor(0).setRoughnessFactor(0.6);
  if (family === "M_OldGold") material.setBaseColorFactor(gold).setMetallicFactor(0.6).setRoughnessFactor(0.38);
}

await document.transform(prune());

const earthNode = document.getRoot().listNodes().find((node) => node.getExtras().node_id === "plate/earth");
const earthTexture = earthNode?.getMesh()?.listPrimitives()[0]?.getMaterial()?.getBaseColorTexture();
if (!earthTexture || earthTexture.getMimeType() !== "image/jpeg" || earthTexture.getSize()?.join("x") !== "1024x1024") {
  throw new Error("Mobile earth plate must retain its 1024x1024 JPEG texture");
}
if (document.getRoot().listTextures().some((texture) => texture.getMimeType() === "image/ktx2")) {
  throw new Error("Mobile artifact must not contain KTX2 textures");
}
await io.write(destination, document);
