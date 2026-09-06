import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
const contract = JSON.parse(await readFile(join(root, "src/minitool/artifact/model-parity-contract.json"), "utf8"));
const scriptNames = ["earth", "heaven", "generals", "core"];
const MiB = 1024 * 1024;

function loadPart(source, filename) {
  const context = vm.createContext({ window: {} });
  new vm.Script(source, { filename }).runInContext(context);
  return context.window.__DALIUREN_MODEL_PARTS__;
}

function encodedPayloads(value, payloads = []) {
  if (!value || typeof value !== "object") return payloads;
  if (typeof value.data === "string") payloads.push(value.data);
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    encodedPayloads(child, payloads);
  }
  return payloads;
}

function checksum(files) {
  const hash = createHash("sha256");
  for (const [name, source] of files) hash.update(name).update(source);
  return hash.digest("hex");
}

test("exports deterministic, budgeted website geometry for every contract node", async () => {
  const { exportMinitoolModel } = await import("./export-minitool-model.mjs");
  const firstOutput = await mkdtemp(join(tmpdir(), "minitool-model-first-"));
  const secondOutput = await mkdtemp(join(tmpdir(), "minitool-model-second-"));

  try {
    const firstManifest = await exportMinitoolModel({ outputDir: firstOutput });
    const secondManifest = await exportMinitoolModel({ outputDir: secondOutput });
    const firstFiles = await Promise.all(scriptNames.map(async (name) => [
      name,
      await readFile(join(firstOutput, `model-${name}.js`), "utf8"),
    ]));
    const secondFiles = await Promise.all(scriptNames.map(async (name) => [
      name,
      await readFile(join(secondOutput, `model-${name}.js`), "utf8"),
    ]));
    const parts = Object.assign({}, ...firstFiles.map(([name, source]) => loadPart(source, `model-${name}.js`)));
    const exportedNodes = new Map(Object.values(parts).flatMap((part) => part.nodes).map((node) => [node.id, node]));

    assert.deepEqual(new Set(firstManifest.nodeIds), new Set(contract.nodeIds));
    assert.deepEqual(new Set(exportedNodes.keys()), new Set(contract.nodeIds));
    assert.equal(exportedNodes.get("branch/earth/午").parentId, "plate/heaven");
    assert.equal(exportedNodes.get("general-slot/午").parentId, "plate/generals");
    assert.equal(firstManifest.extensions.includes("KHR_texture_basisu"), false);
    assert.ok(firstManifest.triangles <= contract.budget.triangles);
    assert.ok(firstManifest.drawCalls <= contract.budget.drawCalls);
    assert.equal(firstManifest.drawCalls, Object.values(parts).reduce((total, part) => total + part.meshes.length, 0));
    assert.equal(checksum(firstFiles), checksum(secondFiles));

    for (const name of scriptNames) {
      const source = firstFiles.find(([entry]) => entry === name)[1];
      assert.ok(Buffer.byteLength(source) < 2 * MiB, `${name} script must be below 2 MiB`);
      assert.equal(source.includes("KHR_texture_basisu"), false, `${name} script must not retain BasisU`);
      assert.ok(parts[name], `${name} script must register its part`);
    }

    for (const nodeId of contract.nodeIds) assert.ok(firstManifest.nodeIds.includes(nodeId), `missing ${nodeId}`);
    for (const forbidden of ["calendar/slip", "lesson/first", "transmission/initial"]) {
      assert.equal(firstManifest.nodeIds.includes(forbidden), false, `must exclude ${forbidden}`);
    }
    for (const payload of encodedPayloads(parts)) {
      assert.ok(Buffer.byteLength(payload, "utf8") < MiB, "serialized Base64 accessor must be below 1 MiB");
    }
    const earthBoard = parts.earth.meshes.find((mesh) => mesh.materialId === "RT_M_JadeBody_outer_board_v10");
    assert.ok(earthBoard, "must retain the GLB earth-board primitive");
    assert.equal(earthBoard.texcoord.itemSize, 2);
    assert.equal(earthBoard.texcoord.count, earthBoard.position.count);
    assert.deepEqual(firstManifest, secondManifest);
  } finally {
    await Promise.all([rm(firstOutput, { recursive: true, force: true }), rm(secondOutput, { recursive: true, force: true })]);
  }
});
