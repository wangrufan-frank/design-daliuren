import test from "node:test";
import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Document } from "@gltf-transform/core";
import {
  addVoidPaletteMaterials,
  compressGlb,
  encodeTexture,
  textureEncoderMode,
} from "./compress-daliuren-glbs.mjs";

test("adds the two fixed void palette materials without attaching them to geometry", () => {
  const document = new Document();
  document.createMaterial("M_Bronze").setExtras({ material_family: "M_Bronze" });

  addVoidPaletteMaterials(document);

  const materials = document.getRoot().listMaterials();
  assert.deepEqual(materials.map((material) => material.getName()), [
    "M_Bronze",
    "M_EarthVoid",
    "M_HeavenVoid",
  ]);
  assert.deepEqual(materials.slice(1).map((material) => material.getExtras()), [
    { material_family: "M_EarthVoid" },
    { material_family: "M_HeavenVoid" },
  ]);
  assert.equal(materials[1].getRoughnessFactor(), 0.52);
  assert.equal(materials[2].getRoughnessFactor(), 0.52);
  assert.deepEqual(document.getRoot().listMeshes(), []);
});

test("assigns ETC1S only to color slots and UASTC only to data slots", () => {
  assert.equal(textureEncoderMode(["baseColorTexture"]), "etc1s");
  assert.equal(textureEncoderMode(["emissiveTexture"]), "etc1s");
  assert.equal(textureEncoderMode(["normalTexture"]), "uastc");
  assert.equal(
    textureEncoderMode(["occlusionTexture", "metallicRoughnessTexture"]),
    "uastc",
  );
  assert.throws(
    () => textureEncoderMode(["baseColorTexture", "normalTexture"]),
    /both color and data slots/,
  );
  assert.throws(() => textureEncoderMode([]), /no supported material slot/);
});

test("invokes the pinned asset encoder and replaces texture bytes with KTX2", async () => {
  const directory = mkdtempSync(join(tmpdir(), "daliuren-encoder-test-"));
  const calls = [];
  let image = Buffer.from("png-source");
  let mimeType = "image/png";
  const texture = {
    getName: () => "bronze-hero-normal",
    getImage: () => image,
    getMimeType: () => mimeType,
    setImage: (value) => {
      image = value;
      return texture;
    },
    setMimeType: (value) => {
      mimeType = value;
      return texture;
    },
  };
  const run = (command, args) => {
    calls.push([command, ...args]);
    copyFileSync(args.at(-2), args.at(-1));
    writeFileSync(args.at(-1), "ktx2-output");
    return { stdout: "encoded" };
  };

  try {
    await encodeTexture(texture, ["normalTexture"], {
      temporary: directory,
      root: directory,
      python: "python",
      run,
      index: 3,
    });

    assert.equal(calls.length, 1);
    assert.match(calls[0][1], /tools[\\/]python[\\/]encode_ktx2\.py$/);
    assert.deepEqual(calls[0].slice(2, 6), [
      "--mode",
      "uastc",
      "--mime",
      "image/png",
    ]);
    assert.equal(Buffer.from(image).toString(), "ktx2-output");
    assert.equal(mimeType, "image/ktx2");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("atomically replaces the source GLB only after transformation succeeds", async () => {
  const directory = mkdtempSync(join(tmpdir(), "daliuren-compress-test-"));
  const input = join(directory, "lod0.glb");
  writeFileSync(input, "source");
  const transform = async (_source, destination) => writeFileSync(destination, "compressed");

  try {
    await compressGlb(input, { root: directory, transform });
    assert.equal(readFileSync(input, "utf8"), "compressed");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("does not replace the source GLB when transformation fails", async () => {
  const directory = mkdtempSync(join(tmpdir(), "daliuren-compress-failure-"));
  const input = join(directory, "lod0.glb");
  writeFileSync(input, "source");
  const transform = async () => {
    throw new Error("compression failed");
  };

  try {
    await assert.rejects(
      compressGlb(input, { root: directory, transform }),
      /compression failed/,
    );
    assert.equal(readFileSync(input, "utf8"), "source");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
