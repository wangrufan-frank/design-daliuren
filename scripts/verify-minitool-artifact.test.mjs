import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { verifyMiniToolArtifact } from "./verify-minitool-artifact.mjs";

test("verifies the packaged directory and rejects ZIP content drift", () => {
  const root = mkdtempSync(join(tmpdir(), "minitool-artifact-"));
  const directory = join(root, "daliuren-minitool");
  const zipPath = join(root, "daliuren-minitool.zip");
  cpSync(resolve("artifacts/daliuren-minitool"), directory, { recursive: true });
  execFileSync("python", [resolve("tools/python/package_minitool.py"), directory, zipPath]);
  try {
    const verified = verifyMiniToolArtifact({ directory, zipPath });
    assert.deepEqual(verified.errors, []);
    assert.ok(verified.model.triangles > 0 && verified.model.triangles <= 100000);
    assert.ok(verified.model.drawCalls > 0 && verified.model.drawCalls <= 50);
    assert.match(verified.zipSha256, /^[a-f0-9]{64}$/);

    const surfaceRoot = join(directory, "assets/reference-surfaces");
    const general00 = join(surfaceRoot, "general-detail-00.png");
    const general01 = join(surfaceRoot, "general-detail-01.png");
    const general00Bytes = readFileSync(general00);
    const general01Bytes = readFileSync(general01);
    writeFileSync(general00, general01Bytes);
    writeFileSync(general01, general00Bytes);
    execFileSync("python", [resolve("tools/python/package_minitool.py"), directory, zipPath]);
    assert.match(
      verifyMiniToolArtifact({ directory, zipPath }).errors.join("\n"),
      /general-detail-00\.png: SHA256 与权威清单不符.*general-detail-01\.png: SHA256 与权威清单不符/s,
    );

    writeFileSync(general00, general00Bytes);
    writeFileSync(general01, general01Bytes);
    execFileSync("python", [resolve("tools/python/package_minitool.py"), directory, zipPath]);
    writeFileSync(join(directory, "assets/style.css"), "body{color:red}");
    assert.match(verifyMiniToolArtifact({ directory, zipPath }).errors.join("\n"), /ZIP 内容与产物目录不一致/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
