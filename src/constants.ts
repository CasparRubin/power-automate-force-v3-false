/** Query param value for `v3` when enforcement is active (`true` or `false`). */
export type EnforcedV3 = "true" | "false";

/** Stored user preference: enforce v3=true, v3=false, or pause all enforcement (`off`). */
export type EnforcementPreference = EnforcedV3 | "off";

/** Sync storage key; value is {@link EnforcementPreference} (`"true"` | `"false"` | `"off"`). */
export const STORAGE_KEY_ENFORCED_V3 = "enforcedV3" as const;

/** When `"true"`, target URLs get `v3survey=true` (added if missing). When `"false"` (default), `v3survey` is never added or rewritten. */
export const STORAGE_KEY_V3SURVEY_ENABLED = "v3surveyEnabled" as const;

/** Keys loaded together by the service worker, content script, and popup. */
export const SYNC_POLICY_KEYS = [STORAGE_KEY_ENFORCED_V3, STORAGE_KEY_V3SURVEY_ENABLED] as const;

export const DNR_RULESET_CLASSIC_EDITOR_ID = "dnr-classic-editor" as const;
export const DNR_RULESET_NEW_DESIGNER_ID = "dnr-new-designer" as const;

export const DEFAULT_ENFORCED_V3: EnforcedV3 = "false";

/** Default when storage is missing or invalid (same as classic editor). */
export const DEFAULT_ENFORCEMENT_PREFERENCE: EnforcementPreference = DEFAULT_ENFORCED_V3;

export function parseEnforcementPreference(value: unknown): EnforcementPreference {
  if (value === "true") {
    return "true";
  }
  if (value === "false") {
    return "false";
  }
  if (value === "off") {
    return "off";
  }
  return DEFAULT_ENFORCEMENT_PREFERENCE;
}

/** True when install-time seeding should write {@link DEFAULT_ENFORCEMENT_PREFERENCE}. */
export function needsDefaultEnforcedV3Seed(raw: unknown): boolean {
  return raw !== "true" && raw !== "false" && raw !== "off";
}

/** True when the stored `v3surveyEnabled` value is not the literal strings `"true"` or `"false"`. */
export function needsDefaultV3SurveyEnabledSeed(raw: unknown): boolean {
  return raw !== "true" && raw !== "false";
}

/** Whether to add and enforce `v3survey=true` on flow/run URLs. */
export function parseV3SurveyEnabled(value: unknown): boolean {
  return value === "true";
}
