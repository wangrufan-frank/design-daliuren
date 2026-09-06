import { atlasAssets } from "./scripts/atlas-assets";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const output = resolve("artifacts/daliuren-minitool");
const modelParts = ["earth", "heaven", "generals", "core"] as const;

export default defineConfig({
  base: "./",
  publicDir: false,
  resolve: { alias: { three: "three-webgl1" } },
  plugins: [
    react(),
    atlasAssets(),
    {
      name: "minitool-classic-entry",
      closeBundle() {
        const assetsOutput = resolve(output, "assets");
        const referenceOutput = resolve(assetsOutput, "reference-surfaces");
        mkdirSync(assetsOutput, { recursive: true });
        mkdirSync(referenceOutput, { recursive: true });
        copyFileSync(resolve("src/minitool/index.html"), resolve(output, "index.html"));
        copyFileSync(resolve("src/minitool/assets/earth-board.jpg"), resolve(assetsOutput, "earth-board.jpg"));
        for (const part of modelParts) {
          copyFileSync(resolve(`src/minitool/artifact/generated/model-${part}.js`), resolve(assetsOutput, `model-${part}.js`));
        }
        for (const texture of readdirSync(resolve("src/minitool/assets/reference-surfaces")).filter((file) => file.endsWith(".png"))) {
          copyFileSync(resolve(`src/minitool/assets/reference-surfaces/${texture}`), resolve(referenceOutput, texture));
        }
        const appPath = resolve(output, "assets/app.js");
        const app = readFileSync(appPath, "utf8")
          .replaceAll("https://react.dev/errors/", "react-error:")
          .replaceAll("https://jcgt.org/published/0007/04/01/", "reference:jcgt-vndf")
          .replaceAll("https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733.", "three-lighting-update.");
        writeFileSync(appPath, app);
      },
    },
  ],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    target: ["es2017", "chrome61"],
    outDir: output,
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    lib: { entry: resolve("src/minitool/main.tsx"), formats: ["iife"], name: "DaLiuRenMiniTool" },
    rollupOptions: {
      output: {
        entryFileNames: "assets/app.js",
        assetFileNames: (asset) => asset.name?.endsWith(".css") ? "assets/style.css" : "assets/[name][extname]",
      },
    },
  },
});
