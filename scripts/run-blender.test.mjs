import test from "node:test";
import assert from "node:assert/strict";
import { resolveBlenderExecutable } from "./run-blender.mjs";

test("uses DALIUREN_BLENDER before the pinned E drive path", () => {
  const seen = [];
  const result = resolveBlenderExecutable(
    { DALIUREN_BLENDER: "E:\\custom\\blender.exe" },
    (path) => (seen.push(path), path === "E:\\custom\\blender.exe"),
  );

  assert.equal(result, "E:\\custom\\blender.exe");
  assert.deepEqual(seen, ["E:\\custom\\blender.exe"]);
});

test("throws with both checked paths when Blender is absent", () => {
  assert.throws(
    () => resolveBlenderExecutable({}, () => false),
    /DALIUREN_BLENDER.*E:\\Tools\\Blender\\4\.5\.12/,
  );
});
