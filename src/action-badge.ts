import type { EnforcementPreference } from "./constants";

export type ToolbarBadgeSpec = {
  text: string;
  backgroundColor: [number, number, number, number];
};

/**
 * Maps sync enforcement preference to toolbar badge content. `off` clears the badge.
 * Classic = v3=false → "C"; New designer = v3=true → "N".
 */
export function enforcementPreferenceToToolbarBadge(
  preference: EnforcementPreference,
): ToolbarBadgeSpec | null {
  if (preference === "off") {
    return null;
  }
  if (preference === "false") {
    return { text: "C", backgroundColor: [110, 85, 60, 255] };
  }
  return { text: "N", backgroundColor: [26, 115, 232, 255] };
}

/** Invoked from the service worker after each successful `reconcileFromStorage` (sync-backed preference). */
export function applyToolbarBadgeForEnforcement(preference: EnforcementPreference): void {
  const spec = enforcementPreferenceToToolbarBadge(preference);
  if (!spec) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }
  chrome.action.setBadgeText({ text: spec.text });
  chrome.action.setBadgeBackgroundColor({ color: spec.backgroundColor });
}
