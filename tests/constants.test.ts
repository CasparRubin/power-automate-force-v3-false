import { describe, expect, it } from "vitest";
import {
  DEFAULT_ENFORCED_V3,
  needsDefaultEnforcedV3Seed,
  parseEnforcedV3,
  RULESET_V3_FALSE_ID,
  RULESET_V3_TRUE_ID,
  STORAGE_KEY_ENFORCED_V3,
} from "../src/constants";

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

describe("manifest contract constants", () => {
  it("uses stable storage key and ruleset ids aligned with public/manifest.json", () => {
    expect(STORAGE_KEY_ENFORCED_V3).toBe("enforcedV3");
    expect(RULESET_V3_FALSE_ID).toBe("editor-v3-false-rules");
    expect(RULESET_V3_TRUE_ID).toBe("editor-v3-true-rules");
    expect(DEFAULT_ENFORCED_V3).toBe("false");
  });
});
