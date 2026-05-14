import type { EnforcementPreference } from "../constants";
import { PowerAutomateUrlPolicy } from "../url-policy";
import { policyPopupLog } from "./policy-popup-log";

/**
 * Reloads the active tab in the last-focused browser window from the popup **after** a successful
 * `chrome.storage.sync.set` (see `persist-policy-preference.ts`) when editor enforcement is on
 * (`"true"` or `"false"`, not `"off"`) and that tab is a flow/run URL.
 * Uses {@link PowerAutomateUrlPolicy.isTargetUrl} only (host/path); the popup does not call
 * `PowerAutomateUrlPolicy.configure`, so this does not depend on in-popup policy state.
 * Used after both **editor mode** and **v3survey** sync writes (Survey tab saves pass the current
 * editor mode so reload is skipped while Paused).
 *
 * Uses `lastFocusedWindow: true` so the query targets the window that had focus before the action
 * popup opened (Chrome extension popup / tabs behavior).
 *
 * @returns `true` if `chrome.tabs.reload` completed without throwing; otherwise `false`. The popup
 *   uses this for status auto-dismiss timing (longer only after an actual reload).
 */
export async function reloadFocusedTargetTabIfApplicable(
  savedPreference: EnforcementPreference,
): Promise<boolean> {
  if (savedPreference === "off") {
    policyPopupLog("reloadFocusedTargetTab: skip", { reason: "enforcement_paused" });
    return false;
  }
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const tab = tabs[0];
  if (tab?.id === undefined || !tab.url) {
    policyPopupLog("reloadFocusedTargetTab: skip", {
      reason: "no_active_tab_or_url",
      tabId: tab?.id,
      hasUrl: Boolean(tab?.url),
    });
    return false;
  }
  if (!PowerAutomateUrlPolicy.isTargetUrl(tab.url)) {
    policyPopupLog("reloadFocusedTargetTab: skip", {
      reason: "not_flow_or_run_target",
      tabId: tab.id,
    });
    return false;
  }
  try {
    await chrome.tabs.reload(tab.id);
    policyPopupLog("reloadFocusedTargetTab: reload ok", { tabId: tab.id });
    return true;
  } catch {
    policyPopupLog("reloadFocusedTargetTab: reload threw (tab may have closed)", {
      tabId: tab.id,
    });
    return false;
  }
}
