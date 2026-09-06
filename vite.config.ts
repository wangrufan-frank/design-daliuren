import { atlasAssets } from "./scripts/atlas-assets";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  plugins: [react(), atlasAssets()],
  base: mode === "test" ? "/" : (process.env.BASE ?? "/design-daliuren/"),
  test: { environment: "jsdom", include: ["src/**/*.test.{ts,tsx}"] },
}));
