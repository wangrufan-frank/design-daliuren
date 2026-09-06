import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

export function atlasAssets(): Plugin {
  const source = resolve("src/features/element-atlas/assets");
  let output = "";
  let base = "/";
  return {
    name: "element-atlas-assets",
    configResolved(config) { output = resolve(config.build.outDir, "assets/atlas"); base = config.base; },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0];
        const prefix = base + "assets/atlas/";
        if (!path.startsWith(prefix)) return next();
        const name = path.slice(prefix.length);
        if (!/^[a-z-]+\.jpg$/.test(name) || !existsSync(resolve(source, name))) return next();
        res.setHeader("Content-Type", "image/jpeg");
        res.end(readFileSync(resolve(source, name)));
      });
    },
    writeBundle() {
      mkdirSync(output, { recursive: true });
      for (const name of readdirSync(source).filter((name) => /^[a-z-]+\.jpg$/.test(name))) copyFileSync(resolve(source, name), resolve(output, name));
    },
  };
}
