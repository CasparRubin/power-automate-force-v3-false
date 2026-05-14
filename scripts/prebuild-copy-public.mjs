import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Reset `dist/` and copy packaged static files from `public/` (manifest, rules, icons) before esbuild/vite. */
const root = fileURLToPath(new URL("..", import.meta.url));
const dist = resolve(root, "dist");
const publicDir = resolve(root, "public");

if (existsSync(dist)) {
  rmSync(dist, { recursive: true, force: true });
}
mkdirSync(dist, { recursive: true });
cpSync(publicDir, dist, { recursive: true });
