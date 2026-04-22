import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
var rootDir = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
    base: "./",
    plugins: [react()],
    server: {
        fs: {
            allow: [resolve(rootDir, "..")],
        },
    },
});
