import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FILES = ["basis_transcoder.js", "basis_transcoder.wasm"];
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

export function copyThreeBasis(sourceDir, destinationDir) {
  for (const name of FILES) {
    const source = join(sourceDir, name);
    if (!existsSync(source)) throw new Error(`Missing Three.js Basis transcoder file: ${source}`);
  }

  mkdirSync(destinationDir, { recursive: true });
  for (const name of FILES) copyFileSync(join(sourceDir, name), join(destinationDir, name));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  copyThreeBasis(
    resolve(SCRIPT_DIR, "../node_modules/three/examples/jsm/libs/basis"),
    resolve(SCRIPT_DIR, "../public/three/basis"),
  );
}
