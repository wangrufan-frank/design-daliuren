import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const PINNED = "E:\\Tools\\Blender\\4.5.12\\blender-4.5.12-windows-x64\\blender.exe";

export function resolveBlenderExecutable(env = process.env, exists = existsSync) {
  const candidates = [env.DALIUREN_BLENDER, PINNED].filter(Boolean);
  const found = candidates.find((candidate) => exists(candidate));

  if (!found) {
    throw new Error(`Blender not found. Checked DALIUREN_BLENDER and ${PINNED}`);
  }

  return found;
}

export function withPythonExitCode(args) {
  const separator = args.indexOf("--");
  const blenderArgs = separator === -1 ? args : args.slice(0, separator);
  return blenderArgs.includes("--python-exit-code")
    ? args
    : ["--python-exit-code", "1", ...args];
}

export function runBlender(args) {
  const result = spawnSync(resolveBlenderExecutable(), withPythonExitCode(args), { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBlender(process.argv.slice(2));
}
