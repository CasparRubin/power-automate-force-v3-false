/** User preference: query param value for `v3` to enforce on flow/run URLs. */
export type EnforcedV3 = "true" | "false";

export const STORAGE_KEY_ENFORCED_V3 = "enforcedV3" as const;

export const RULESET_V3_FALSE_ID = "editor-v3-false-rules" as const;
export const RULESET_V3_TRUE_ID = "editor-v3-true-rules" as const;

export const DEFAULT_ENFORCED_V3: EnforcedV3 = "false";

export function parseEnforcedV3(value: unknown): EnforcedV3 {
  if (value === "true") {
    return "true";
  }
  return "false";
}

/** True when install-time storage has no valid persisted mode yet. */
export function needsDefaultEnforcedV3Seed(raw: unknown): boolean {
  return raw !== "true" && raw !== "false";
}
