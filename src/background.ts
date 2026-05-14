import {
  DEFAULT_ENFORCED_V3,
  needsDefaultEnforcedV3Seed,
  parseEnforcedV3,
  STORAGE_KEY_ENFORCED_V3,
  type EnforcedV3,
} from "./constants";
import { buildUpdateRulesetOptions } from "./dnr-rulesets";
import { isMainFrameTabNavigation } from "./navigation-guards";
import { isEnforcedV3SyncChange } from "./storage-sync";
import { PowerAutomateUrlPolicy } from "./url-policy";

const lastCanonicalKeyByTabId: Record<number, string> = Object.create(null);

function clearTabCanonicalKey(tabId: number): void {
  delete lastCanonicalKeyByTabId[tabId];
}

function enforceCanonicalOnTab(tabId: number, urlValue: string): void {
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

async function readStoredEnforcedV3(): Promise<EnforcedV3> {
  const result = await chrome.storage.sync.get(STORAGE_KEY_ENFORCED_V3);
  return parseEnforcedV3(result[STORAGE_KEY_ENFORCED_V3]);
}

async function applyRulesetsForMode(mode: EnforcedV3): Promise<void> {
  await chrome.declarativeNetRequest.updateEnabledRulesets(buildUpdateRulesetOptions(mode));
}

async function reconcileFromStorage(): Promise<void> {
  try {
    const mode = await readStoredEnforcedV3();
    PowerAutomateUrlPolicy.configure({ enforcedV3: mode });
    await applyRulesetsForMode(mode);
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
  if (
    !isEnforcedV3SyncChange(areaName, changes as Record<string, unknown>, STORAGE_KEY_ENFORCED_V3)
  ) {
    return;
  }
  void reconcileFromStorage();
});

chrome.runtime.onInstalled.addListener((details) => {
  void (async () => {
    if (details.reason === "install") {
      const existing = await chrome.storage.sync.get(STORAGE_KEY_ENFORCED_V3);
      const raw = existing[STORAGE_KEY_ENFORCED_V3];
      if (needsDefaultEnforcedV3Seed(raw)) {
        await chrome.storage.sync.set({
          [STORAGE_KEY_ENFORCED_V3]: DEFAULT_ENFORCED_V3,
        });
      }
    }
    await reconcileFromStorage();
  })();
});

void reconcileFromStorage();
