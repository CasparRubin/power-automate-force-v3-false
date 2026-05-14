/** User preference: query param value for `v3` to enforce on flow/run URLs. */
export type EnforcedV3 = "true" | "false";

export const STORAGE_KEY_ENFORCED_V3 = "enforcedV3" as const;

export const DNR_RULESET_CLASSIC_EDITOR_ID = "dnr-classic-editor" as const;
export const DNR_RULESET_NEW_DESIGNER_ID = "dnr-new-designer" as const;

export const DEFAULT_ENFORCED_V3: EnforcedV3 = "false";

export function parseEnforcedV3(value: unknown): EnforcedV3 {
  if (value === "true") {
    return "true";
  }
  return "false";
}

/** True when the stored value is not the literal `"true"` or `"false"` (missing, wrong type, or other string). Used on first install to seed {@link DEFAULT_ENFORCED_V3}. */
export function needsDefaultEnforcedV3Seed(raw: unknown): boolean {
  return raw !== "true" && raw !== "false";
}
