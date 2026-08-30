import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveBlenderExecutable, withPythonExitCode } from "./run-blender.mjs";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, "..");
const RUNNER = join(TEST_DIR, "run-blender.mjs");

function invokeRunner(args) {
  return spawnSync(process.execPath, [RUNNER, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
}

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

test("adds one Python exit code unless Blender arguments already specify one", () => {
  assert.deepEqual(withPythonExitCode(["--background"]), [
    "--python-exit-code",
    "1",
    "--background",
  ]);
  assert.deepEqual(
    withPythonExitCode(["--python-exit-code", "7", "--background"]),
    ["--python-exit-code", "7", "--background"],
  );
});

test("returns nonzero when a real Blender Python script raises", () => {
  const temp = mkdtempSync(join(tmpdir(), "daliuren-blender-error-"));
  const script = join(temp, "raise.py");
  writeFileSync(script, 'raise RuntimeError("intentional runner test")\n');

  try {
    const result = invokeRunner(["--background", "--factory-startup", "--python", script]);
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("saves and reopens the graybox at the requested path", () => {
  const temp = mkdtempSync(join(tmpdir(), "daliuren-graybox-save-"));
  const output = join(temp, "nested", "graybox.blend");

  try {
    const save = invokeRunner([
      "--background",
      "--factory-startup",
      "--python",
      "tools/blender/build_graybox.py",
      "--",
      "--save",
      output,
    ]);
    assert.equal(save.status, 0, `${save.stdout}\n${save.stderr}`);
    assert.ok(existsSync(output));
    assert.ok(statSync(output).size > 0);

    const reopen = invokeRunner([
      "--background",
      output,
      "--python-expr",
      "import bpy, sys; from pathlib import Path; sys.path.insert(0, str(Path.cwd() / 'tools' / 'blender')); from daliuren_contract import NODE_IDS; ids = [obj['node_id'] for obj in bpy.data.objects if 'node_id' in obj]; assert len(ids) == len(NODE_IDS); assert len(set(ids)) == len(NODE_IDS); assert set(ids) == set(NODE_IDS); assert 'plate/heaven' in bpy.data.objects; assert 'general/queen-of-heaven' in bpy.data.objects; print('SAVED_BLEND_OK')",
    ]);
    assert.equal(reopen.status, 0, `${reopen.stdout}\n${reopen.stderr}`);
    assert.match(reopen.stdout, /SAVED_BLEND_OK/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
