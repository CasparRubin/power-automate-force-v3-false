import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENFORCED_V3,
  DEFAULT_ENFORCEMENT_PREFERENCE,
  DNR_RULESET_CLASSIC_EDITOR_ID,
  DNR_RULESET_NEW_DESIGNER_ID,
  needsDefaultEnforcedV3Seed,
  needsDefaultV3SurveyEnabledSeed,
  parseEnforcementPreference,
  parseV3SurveyEnabled,
  STORAGE_KEY_ENFORCED_V3,
  STORAGE_KEY_POPUP_THEME,
  STORAGE_KEY_V3SURVEY_ENABLED,
  SYNC_POLICY_KEYS,
} from "../src/constants";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

type PublicManifest = {
  manifest_version?: number;
  permissions?: string[];
  host_permissions?: string[];
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

describe("parseEnforcementPreference", () => {
  it('returns "true" only for strict string true', () => {
    expect(parseEnforcementPreference("true")).toBe("true");
  });

  it('returns "false" for string false', () => {
    expect(parseEnforcementPreference("false")).toBe("false");
  });

  it('returns "off" for strict string off', () => {
    expect(parseEnforcementPreference("off")).toBe("off");
  });

  it("returns default for missing, invalid, or wrong-casing values", () => {
    expect(parseEnforcementPreference(undefined)).toBe(DEFAULT_ENFORCEMENT_PREFERENCE);
    expect(parseEnforcementPreference(null)).toBe(DEFAULT_ENFORCEMENT_PREFERENCE);
    expect(parseEnforcementPreference("")).toBe(DEFAULT_ENFORCEMENT_PREFERENCE);
    expect(parseEnforcementPreference("TRUE")).toBe(DEFAULT_ENFORCEMENT_PREFERENCE);
    expect(parseEnforcementPreference("OFF")).toBe(DEFAULT_ENFORCEMENT_PREFERENCE);
    expect(parseEnforcementPreference(1)).toBe(DEFAULT_ENFORCEMENT_PREFERENCE);
    expect(parseEnforcementPreference(true)).toBe(DEFAULT_ENFORCEMENT_PREFERENCE);
  });
});

describe("needsDefaultEnforcedV3Seed", () => {
  it("is false when storage already has a valid literal", () => {
    expect(needsDefaultEnforcedV3Seed("true")).toBe(false);
    expect(needsDefaultEnforcedV3Seed("false")).toBe(false);
    expect(needsDefaultEnforcedV3Seed("off")).toBe(false);
  });

  it("is true for missing or invalid persisted values", () => {
    expect(needsDefaultEnforcedV3Seed(undefined)).toBe(true);
    expect(needsDefaultEnforcedV3Seed(null)).toBe(true);
    expect(needsDefaultEnforcedV3Seed("")).toBe(true);
    expect(needsDefaultEnforcedV3Seed("TRUE")).toBe(true);
    expect(needsDefaultEnforcedV3Seed("OFF")).toBe(true);
  });
});

describe("needsDefaultV3SurveyEnabledSeed", () => {
  it("is false for strict true or false strings", () => {
    expect(needsDefaultV3SurveyEnabledSeed("true")).toBe(false);
    expect(needsDefaultV3SurveyEnabledSeed("false")).toBe(false);
  });

  it("is true for missing or invalid values", () => {
    expect(needsDefaultV3SurveyEnabledSeed(undefined)).toBe(true);
    expect(needsDefaultV3SurveyEnabledSeed(null)).toBe(true);
    expect(needsDefaultV3SurveyEnabledSeed("TRUE")).toBe(true);
  });
});

describe("parseV3SurveyEnabled", () => {
  it("is true only for strict string true", () => {
    expect(parseV3SurveyEnabled("true")).toBe(true);
  });

  it("is false for any other input", () => {
    expect(parseV3SurveyEnabled("false")).toBe(false);
    expect(parseV3SurveyEnabled(undefined)).toBe(false);
  });
});

describe("storage and default mode constants", () => {
  it("uses stable storage key and default enforced mode", () => {
    expect(STORAGE_KEY_ENFORCED_V3).toBe("enforcedV3");
    expect(STORAGE_KEY_V3SURVEY_ENABLED).toBe("v3surveyEnabled");
    expect(STORAGE_KEY_POPUP_THEME).toBe("popupThemePreference");
    expect(DEFAULT_ENFORCED_V3).toBe("false");
    expect(DEFAULT_ENFORCEMENT_PREFERENCE).toBe("false");
  });

  it("exports sync policy key tuple for chrome.storage.get", () => {
    expect(SYNC_POLICY_KEYS).toEqual(["enforcedV3", "v3surveyEnabled"]);
  });

  it("exports DNR ruleset ids used by buildUpdateRulesetOptions", () => {
    expect(DNR_RULESET_CLASSIC_EDITOR_ID).toBe("dnr-classic-editor");
    expect(DNR_RULESET_NEW_DESIGNER_ID).toBe("dnr-new-designer");
  });
});

describe("public/manifest.json (drift guard vs src/constants.ts)", () => {
  it("is MV3 with expected API permissions (host access via host_permissions, not broad tabs)", () => {
    const manifest = readPublicManifest();
    expect(manifest.manifest_version).toBe(3);
    expect([...(manifest.permissions ?? [])].sort()).toEqual(
      ["declarativeNetRequest", "storage", "webNavigation"].sort(),
    );
    expect(manifest.host_permissions?.sort()).toEqual(
      ["https://*.powerautomate.com/*", "https://flow.microsoft.com/*"].sort(),
    );
  });

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
