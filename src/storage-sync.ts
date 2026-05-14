import { STORAGE_KEY_ENFORCED_V3, STORAGE_KEY_V3SURVEY_ENABLED } from "./constants";

/**
 * True when sync storage changed for any option read by the service worker / content script
 * (`enforcedV3` or `v3surveyEnabled`).
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
