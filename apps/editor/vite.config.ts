import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  build: {
    emptyOutDir: true,
    outDir: resolve(rootDir, "..", "..", "dist", "editor"),
  },
  plugins: [react()],
  server: {
    fs: {
      allow: [resolve(rootDir, "..")],
    },
  },
});
