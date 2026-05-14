import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENFORCED_V3,
  DNR_RULESET_CLASSIC_EDITOR_ID,
  DNR_RULESET_NEW_DESIGNER_ID,
  needsDefaultEnforcedV3Seed,
  parseEnforcedV3,
  STORAGE_KEY_ENFORCED_V3,
} from "../src/constants";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

type PublicManifest = {
  declarative_net_request?: {
    rule_resources?: Array<{ id: string; path: string; enabled?: boolean }>;
  };
  icons?: Record<string, string>;
};

function readPublicManifest(): PublicManifest {
  return JSON.parse(
    readFileSync(join(repoRoot, "public", "manifest.json"), "utf8"),
  ) as PublicManifest;
}

describe("parseEnforcedV3", () => {
  it('returns "true" only for strict string true', () => {
    expect(parseEnforcedV3("true")).toBe("true");
  });

  it('returns "false" for any other input including string false', () => {
    expect(parseEnforcedV3("false")).toBe("false");
    expect(parseEnforcedV3(undefined)).toBe("false");
    expect(parseEnforcedV3(null)).toBe("false");
    expect(parseEnforcedV3("")).toBe("false");
    expect(parseEnforcedV3("TRUE")).toBe("false");
    expect(parseEnforcedV3(1)).toBe("false");
    expect(parseEnforcedV3(true)).toBe("false");
  });
});

describe("needsDefaultEnforcedV3Seed", () => {
  it("is false when storage already has a valid literal", () => {
    expect(needsDefaultEnforcedV3Seed("true")).toBe(false);
    expect(needsDefaultEnforcedV3Seed("false")).toBe(false);
  });

  it("is true for missing or invalid persisted values", () => {
    expect(needsDefaultEnforcedV3Seed(undefined)).toBe(true);
    expect(needsDefaultEnforcedV3Seed(null)).toBe(true);
    expect(needsDefaultEnforcedV3Seed("")).toBe(true);
    expect(needsDefaultEnforcedV3Seed("TRUE")).toBe(true);
  });
});

describe("storage and default mode constants", () => {
  it("uses stable storage key and default enforced mode", () => {
    expect(STORAGE_KEY_ENFORCED_V3).toBe("enforcedV3");
    expect(DEFAULT_ENFORCED_V3).toBe("false");
  });

  it("exports DNR ruleset ids used by buildUpdateRulesetOptions", () => {
    expect(DNR_RULESET_CLASSIC_EDITOR_ID).toBe("dnr-classic-editor");
    expect(DNR_RULESET_NEW_DESIGNER_ID).toBe("dnr-new-designer");
  });
});

describe("public/manifest.json (drift guard vs src/constants.ts)", () => {
  it("declarative_net_request rulesets use the same ids and paths as constants", () => {
    const manifest = readPublicManifest();
    const resources = manifest.declarative_net_request?.rule_resources;
    expect(Array.isArray(resources)).toBe(true);
    expect(resources).toHaveLength(2);

    const byId = new Map(resources!.map((r) => [r.id, r]));
    expect(byId.get(DNR_RULESET_CLASSIC_EDITOR_ID)?.path).toBe("dnr-classic-editor.json");
    expect(byId.get(DNR_RULESET_NEW_DESIGNER_ID)?.path).toBe("dnr-new-designer.json");

    expect(byId.get(DNR_RULESET_CLASSIC_EDITOR_ID)?.enabled).toBe(true);
    expect(byId.get(DNR_RULESET_NEW_DESIGNER_ID)?.enabled).toBe(false);
  });

  it("icon paths match packaged files under public/", () => {
    const manifest = readPublicManifest();
    const icons = manifest.icons;
    expect(icons).toBeDefined();
    for (const size of ["16", "32", "48", "128"] as const) {
      const rel = icons![size];
      expect(rel).toBe(`icons/icon_${size}.png`);
      expect(existsSync(join(repoRoot, "public", rel))).toBe(true);
    }
  });

  it("DNR rule JSON files exist next to manifest", () => {
    expect(existsSync(join(repoRoot, "public", "dnr-classic-editor.json"))).toBe(true);
    expect(existsSync(join(repoRoot, "public", "dnr-new-designer.json"))).toBe(true);
  });
});
