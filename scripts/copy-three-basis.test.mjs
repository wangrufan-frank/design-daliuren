import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { copyThreeBasis } from "./copy-three-basis.mjs";

function createSource(files) {
  const source = mkdtempSync(join(tmpdir(), "three-basis-source-"));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(source, name), content);
  return source;
}

test("copies the Basis transcoder files byte-for-byte", () => {
  const source = createSource({
    "basis_transcoder.js": Buffer.from([0, 1, 2, 3]),
    "basis_transcoder.wasm": Buffer.from([4, 5, 6, 7]),
  });
  const destination = mkdtempSync(join(tmpdir(), "three-basis-destination-"));

  try {
    copyThreeBasis(source, destination);

    for (const name of ["basis_transcoder.js", "basis_transcoder.wasm"]) {
      assert.ok(existsSync(join(destination, name)));
      assert.deepEqual(readFileSync(join(destination, name)), readFileSync(join(source, name)));
    }
  } finally {
    rmSync(source, { recursive: true, force: true });
    rmSync(destination, { recursive: true, force: true });
  }
});

test("rejects a source tree without the Basis WASM file", () => {
  const source = createSource({ "basis_transcoder.js": "export default {};" });
  const destination = mkdtempSync(join(tmpdir(), "three-basis-destination-"));

  try {
    assert.throws(() => copyThreeBasis(source, destination), /basis_transcoder\.wasm/);
  } finally {
    rmSync(source, { recursive: true, force: true });
    rmSync(destination, { recursive: true, force: true });
  }
});
