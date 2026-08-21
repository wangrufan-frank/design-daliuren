import type { FullConfig } from "@playwright/test";
import { createServer } from "vite";

export default async function globalSetup(_config: FullConfig) {
  const server = await createServer({
    server: { host: "127.0.0.1", port: 4173, strictPort: true },
  });
  await server.listen();
  return () => server.close();
}
