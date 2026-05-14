import type { EnforcementPreference } from "../constants";
import { PowerAutomateUrlPolicy } from "../url-policy";

/**
 * Reloads the active tab in the last-focused browser window after a successful popup save when
 * editor enforcement is on (`"true"` or `"false"`, not `"off"`) and that tab is a flow/run URL.
 * Uses {@link PowerAutomateUrlPolicy.isTargetUrl} only (host/path); the popup does not call
 * `PowerAutomateUrlPolicy.configure`, so this does not depend on in-popup policy state.
 * Used after both **editor mode** and **v3survey** sync writes (Survey tab saves pass the current
 * editor preference so reload is skipped while Paused).
 *
 * Uses `lastFocusedWindow: true` so the query targets the window that had focus before the action
 * popup opened (Chrome extension popup / tabs behavior).
 */
export async function reloadFocusedTargetTabIfApplicable(
  savedPreference: EnforcementPreference,
): Promise<void> {
  if (savedPreference === "off") {
    return;
  }
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (tab?.id === undefined || !tab.url) {
    return;
  }
  if (!PowerAutomateUrlPolicy.isTargetUrl(tab.url)) {
    return;
  }
  try {
    await chrome.tabs.reload(tab.id);
  } catch {
    // Tab may have closed between query and reload.
  }
}
