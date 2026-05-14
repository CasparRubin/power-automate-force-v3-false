import { STORAGE_KEY_ENFORCED_V3, STORAGE_KEY_V3SURVEY_ENABLED } from "./constants";

/**
 * True when `chrome.storage.sync` changed for a key the extension reads for URL policy: editor mode
 * (`enforcedV3`) or Survey policy (`v3surveyEnabled`, string `"true"` / `"false"` in storage).
 */
export function isEnforcerSyncChange(areaName: string, changes: Record<string, unknown>): boolean {
  if (areaName !== "sync") {
    return false;
  }
  return (
    Object.prototype.hasOwnProperty.call(changes, STORAGE_KEY_ENFORCED_V3) ||
    Object.prototype.hasOwnProperty.call(changes, STORAGE_KEY_V3SURVEY_ENABLED)
  );
}
