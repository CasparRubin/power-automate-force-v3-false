import {
  DEFAULT_ENFORCED_V3,
  needsDefaultEnforcedV3Seed,
  needsDefaultV3SurveyEnabledSeed,
  parseEnforcementPreference,
  parseV3SurveyEnabled,
  STORAGE_KEY_ENFORCED_V3,
  STORAGE_KEY_V3SURVEY_ENABLED,
  SYNC_POLICY_KEYS,
  type EnforcementPreference,
} from "./constants";
import { buildUpdateRulesetOptions } from "./dnr-rulesets";
import { isMainFrameTabNavigation } from "./navigation-guards";
import { isEnforcerSyncChange } from "./storage-sync";
import { PowerAutomateUrlPolicy } from "./url-policy";

const lastCanonicalKeyByTabId: Record<number, string> = Object.create(null);

function clearTabCanonicalKey(tabId: number): void {
  delete lastCanonicalKeyByTabId[tabId];
}

function enforceCanonicalOnTab(tabId: number, urlValue: string): void {
  if (PowerAutomateUrlPolicy.isEnforcementPaused()) {
    clearTabCanonicalKey(tabId);
    return;
  }

  if (!PowerAutomateUrlPolicy.isTargetUrl(urlValue)) {
    clearTabCanonicalKey(tabId);
    return;
  }

  const incomingCanonicalKey = PowerAutomateUrlPolicy.getCanonicalKey(urlValue);
  if (incomingCanonicalKey && lastCanonicalKeyByTabId[tabId] === incomingCanonicalKey) {
    return;
  }

  const nextUrl = PowerAutomateUrlPolicy.canonicalizeToEnforced(urlValue);
  if (!nextUrl) {
    if (incomingCanonicalKey) {
      lastCanonicalKeyByTabId[tabId] = incomingCanonicalKey;
    } else {
      clearTabCanonicalKey(tabId);
    }
    return;
  }

  const nextCanonicalKey = PowerAutomateUrlPolicy.getCanonicalKey(nextUrl);
  if (nextCanonicalKey) {
    lastCanonicalKeyByTabId[tabId] = nextCanonicalKey;
  }

  chrome.tabs.update(tabId, { url: nextUrl }, () => {
    if (chrome.runtime.lastError) {
      clearTabCanonicalKey(tabId);
    }
  });
}

const POWER_AUTOMATE_URL_FILTERS: chrome.events.UrlFilter[] = [
  { hostSuffix: "powerautomate.com", schemes: ["https"] },
  { hostEquals: "flow.microsoft.com", schemes: ["https"] },
];

async function applyRulesetsForPreference(mode: EnforcementPreference): Promise<void> {
  await chrome.declarativeNetRequest.updateEnabledRulesets(buildUpdateRulesetOptions(mode));
}

async function reconcileFromStorage(): Promise<void> {
  try {
    const result = await chrome.storage.sync.get(SYNC_POLICY_KEYS);
    const preference = parseEnforcementPreference(result[STORAGE_KEY_ENFORCED_V3]);
    const surveyOn = parseV3SurveyEnabled(result[STORAGE_KEY_V3SURVEY_ENABLED]);
    PowerAutomateUrlPolicy.configure({ preference, v3surveyEnabled: surveyOn });
    await applyRulesetsForPreference(preference);
  } catch (error) {
    console.error("[power-automate-version-enforcer] reconcileFromStorage failed", error);
  }
}

chrome.webNavigation.onCommitted.addListener(
  (details) => {
    if (!isMainFrameTabNavigation(details)) {
      return;
    }
    enforceCanonicalOnTab(details.tabId, details.url);
  },
  { url: POWER_AUTOMATE_URL_FILTERS },
);

chrome.webNavigation.onHistoryStateUpdated.addListener(
  (details) => {
    if (!isMainFrameTabNavigation(details)) {
      return;
    }
    enforceCanonicalOnTab(details.tabId, details.url);
  },
  { url: POWER_AUTOMATE_URL_FILTERS },
);

chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabCanonicalKey(tabId);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (!isEnforcerSyncChange(areaName, changes as Record<string, unknown>)) {
    return;
  }
  void reconcileFromStorage();
});

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    if (details.reason === "install") {
      const existing = await chrome.storage.sync.get(SYNC_POLICY_KEYS);
      const rawMode = existing[STORAGE_KEY_ENFORCED_V3];
      const rawSurvey = existing[STORAGE_KEY_V3SURVEY_ENABLED];
      const toSet: Record<string, string> = {};
      if (needsDefaultEnforcedV3Seed(rawMode)) {
        toSet[STORAGE_KEY_ENFORCED_V3] = DEFAULT_ENFORCED_V3;
      }
      if (needsDefaultV3SurveyEnabledSeed(rawSurvey)) {
        toSet[STORAGE_KEY_V3SURVEY_ENABLED] = "false";
      }
      if (Object.keys(toSet).length > 0) {
        await chrome.storage.sync.set(toSet);
      }
    }
    await reconcileFromStorage();
  })();
});

void reconcileFromStorage();
