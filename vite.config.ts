import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "test" ? "/" : (process.env.BASE ?? "/design-daliuren/"),
  test: { environment: "jsdom", include: ["src/**/*.test.{ts,tsx}"] },
}));
