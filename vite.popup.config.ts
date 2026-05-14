import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renameSync, existsSync } from "node:fs";

const repoRoot = fileURLToPath(new URL(".", import.meta.url));
const popupRoot = resolve(repoRoot, "src", "popup");

export default defineConfig({
  root: popupRoot,
  base: "./",
  plugins: [
    react(),
    {
      name: "rename-popup-html",
      closeBundle() {
        const from = resolve(repoRoot, "dist", "index.html");
        const to = resolve(repoRoot, "dist", "popup.html");
        if (existsSync(from)) {
          renameSync(from, to);
        }
      },
    },
  ],
  publicDir: false,
  build: {
    outDir: resolve(repoRoot, "dist"),
    emptyOutDir: false,
    assetsDir: "popup-assets",
    rollupOptions: {
      input: resolve(popupRoot, "index.html"),
    },
  },
});
