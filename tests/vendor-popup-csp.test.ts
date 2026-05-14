import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Release checklist (Chrome MV3): default extension_pages CSP disallows remote script; bundled popup
 * must not use inline script blocks. Run `npm run build` before relying on this test in CI.
 *
 * Chrome Web Store: single-purpose description and permission/host justifications stay manual;
 * align copy with `declarativeNetRequest`, `webNavigation`, `storage`, and manifest host patterns.
 */
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const popupHtmlPath = resolve(repoRoot, "dist", "popup.html");

const hasDistPopup = existsSync(popupHtmlPath);

describe("vendor: dist popup.html CSP / no remote code", () => {
  it.skipIf(!hasDistPopup)("has no script tags without src and no http(s) script src", () => {
    const html = readFileSync(popupHtmlPath, "utf8");
    const scriptWithoutSrc = /<script(?![^>]*\bsrc=)[^>]*>/i;
    expect(html).not.toMatch(scriptWithoutSrc);
    expect(html).not.toMatch(/<script[^>]+src=["'](https?:)/i);
  });
});
