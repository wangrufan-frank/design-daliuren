import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixturePath = new URL("../src/test/calendar-cases.ts", import.meta.url);
const scriptPath = new URL("./verify-calendar-cases.mjs", import.meta.url);

async function runWithChangedFixture(change) {
  const original = await readFile(fixturePath, "utf8");
  const changed = change(original);
  assert.notEqual(changed, original, "test fixture mutation must change the source");

  const directory = await mkdtemp(join(tmpdir(), "calendar-source-verifier-"));
  const changedFixturePath = join(directory, "calendar-cases.ts");
  await writeFile(changedFixturePath, changed);
  try {
    return spawnSync(process.execPath, [fileURLToPath(scriptPath)], {
      encoding: "utf8",
      env: { ...process.env, CALENDAR_FIXTURE_PATH: changedFixturePath },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("rejects a changed independent solar-term instant", { concurrency: false }, async () => {
  const result = await runWithChangedFixture((source) => source.replace("2024-02-04T16:26:49.630+08:00", "2024-02-04T16:00:00.000+08:00"));

  assert.notEqual(result.status, 0);
});

test("rejects a changed locked solar-term discrepancy", { concurrency: false }, async () => {
  const result = await runWithChangedFixture((source) => source.replace("differenceSeconds: 17.37", "differenceSeconds: 1"));

  assert.notEqual(result.status, 0);
});
