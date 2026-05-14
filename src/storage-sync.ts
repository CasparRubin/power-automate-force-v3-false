import { STORAGE_KEY_ENFORCED_V3 } from "./constants";

/**
 * True when `chrome.storage.onChanged` fired for our preference in the sync area.
 */
export function isEnforcedV3SyncChange(
  areaName: string,
  changes: Record<string, unknown>,
  key: typeof STORAGE_KEY_ENFORCED_V3,
): boolean {
  return areaName === "sync" && Object.prototype.hasOwnProperty.call(changes, key);
}
