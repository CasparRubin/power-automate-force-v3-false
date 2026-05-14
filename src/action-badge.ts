import type { EnforcementPreference } from "./constants";

type ToolbarBadgeSpec = {
  text: string;
  backgroundColor: [number, number, number, number];
};

const BADGE_CLASSIC: ToolbarBadgeSpec = {
  text: "C",
  backgroundColor: [110, 85, 60, 255],
};

const BADGE_NEW_DESIGNER: ToolbarBadgeSpec = {
  text: "N",
  backgroundColor: [26, 115, 232, 255],
};

/**
 * Maps sync enforcement preference to toolbar badge content. `off` clears the badge.
 * Classic = v3=false → "C"; New designer = v3=true → "N".
 */
export function enforcementPreferenceToToolbarBadge(
  preference: EnforcementPreference,
): ToolbarBadgeSpec | null {
  switch (preference) {
    case "off":
      return null;
    case "false":
      return BADGE_CLASSIC;
    case "true":
      return BADGE_NEW_DESIGNER;
    default: {
      const _exhaustive: never = preference;
      return _exhaustive;
    }
  }
}

/**
 * Invoked from the service worker during `reconcileFromStorage` (`background.ts`), immediately after
 * `PowerAutomateUrlPolicy.configure` and before `declarativeNetRequest.updateEnabledRulesets` (same queued run).
 */
export function applyToolbarBadgeForEnforcement(preference: EnforcementPreference): void {
  const spec = enforcementPreferenceToToolbarBadge(preference);
  if (!spec) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }
  chrome.action.setBadgeText({ text: spec.text });
  chrome.action.setBadgeBackgroundColor({ color: spec.backgroundColor });
}
