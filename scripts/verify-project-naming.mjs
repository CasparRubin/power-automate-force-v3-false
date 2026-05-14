/**
 * Fail the build if superseded project strings appear anywhere under the repo
 * (excluding node_modules, dist, .git). Patterns cover old repo slugs, a former
 * npm package name, and a former store display title — see the `forbidden` list.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const skipDirNames = new Set(["node_modules", "dist", ".git"]);

/** @type {{ label: string; re: RegExp }[]} */
const forbidden = [
  { label: "legacy repo slug power-automate-force-v3-false", re: /power-automate-force-v3-false/i },
  { label: "legacy repo slug power-automate-v3-false", re: /power-automate-v3-false/i },
  { label: "legacy repo slug power_automate_v3_false", re: /power_automate_v3_false/i },
  { label: "legacy package name power-automate-v3-enforcer", re: /power-automate-v3-enforcer/i },
  { label: 'legacy display title "Power Automate v3 enforcer"', re: /Power Automate v3 enforcer/i },
];

const scanExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".html",
  ".css",
  ".svg",
  ".yml",
  ".yaml",
  ".txt",
]);

const maxBytes = 512 * 1024;

/**
 * @param {string} dir
 * @param {string[]} hits
 */
function walk(dir, hits) {
  const names = readdirSync(dir);
  for (const name of names) {
    const full = join(dir, name);
    const rel = relative(root, full).replaceAll("\\", "/");
    if (rel === "scripts/verify-project-naming.mjs") continue;
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (skipDirNames.has(name)) continue;
      walk(full, hits);
      continue;
    }
    if (!st.isFile() || st.size > maxBytes) continue;
    const dot = name.lastIndexOf(".");
    const ext = dot >= 0 ? name.slice(dot) : "";
    if (!scanExtensions.has(ext)) continue;
    let text;
    try {
      text = readFileSync(full, "utf8");
    } catch {
      continue;
    }
    for (const { label, re } of forbidden) {
      if (re.test(text)) {
        hits.push(`${rel}: contains ${label}`);
      }
    }
  }
}

const hits = [];
walk(root, hits);
if (hits.length > 0) {
  console.error(
    "verify-project-naming: forbidden superseded name strings found:\n" + hits.join("\n"),
  );
  process.exit(1);
}
console.log("verify-project-naming: ok (no forbidden superseded name strings).");
