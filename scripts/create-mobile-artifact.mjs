import { NodeIO } from "@gltf-transform/core";
import { KHRONOS_EXTENSIONS } from "@gltf-transform/extensions";
import { prune } from "@gltf-transform/functions";

const source = "public/models/daliuren/daliuren-artifact-lod2.glb";
const destination = "public/models/daliuren/daliuren-artifact-mobile.glb";
const jade = [0.94, 0.91, 0.84, 1];
const recess = [0.68, 0.67, 0.61, 1];
const gold = [0.55, 0.32, 0.1, 1];

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
const document = await io.read(source);

for (const material of document.getRoot().listMaterials()) {
  material
    .setBaseColorTexture(null)
    .setNormalTexture(null)
    .setMetallicRoughnessTexture(null)
    .setOcclusionTexture(null)
    .setEmissiveTexture(null);
  const family = material.getExtras().material_family;
  if (family === "M_JadeBody") material.setBaseColorFactor(jade).setMetallicFactor(0).setRoughnessFactor(0.3);
  if (family === "M_JadeRecess") material.setBaseColorFactor(recess).setMetallicFactor(0).setRoughnessFactor(0.6);
  if (family === "M_OldGold") material.setBaseColorFactor(gold).setMetallicFactor(0.6).setRoughnessFactor(0.38);
}

await document.transform(prune());
await io.write(destination, document);
