/**
 * MV3 service worker: toggles DNR rulesets from sync `enforcedV3`, configures `PowerAutomateUrlPolicy`
 * from `enforcedV3` + `v3surveyEnabled`, updates the toolbar badge, and rewrites main-frame flow/run URLs
 * via `webNavigation` and `tabs.update` when enforcement is not paused. Static DNR JSON only adjusts `v3`;
 * `v3survey` (**Hide** / **Show**) uses the same URL policy as the content script.
 *
 * Navigations await {@link createPolicyLoadQueue} so URL logic never runs before the first storage-backed
 * `reconcileFromStorage` completes (Chrome MV3 storage preload pattern).
 */
import { applyToolbarBadgeForEnforcement } from "./action-badge";
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
import { createPolicyLoadQueue } from "./policy-load-queue";
import { isEnforcerSyncChange } from "./storage-sync";
import { PowerAutomateUrlPolicy } from "./url-policy";

/**
 * Dedupes redundant `tabs.update` calls per tab. Not persisted: MV3 extension service workers can
 * terminate when idle; after wake this map is empty so we may issue extra updates until it refills.
 */
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
  const options = buildUpdateRulesetOptions(mode);
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets(options);
  } catch (error) {
    console.error(
      "[power-automate-editor-version-enforcer] declarativeNetRequest.updateEnabledRulesets failed",
      { mode, options, error },
    );
    throw error;
  }
}

async function reconcileFromStorage(): Promise<void> {
  try {
    const result = await chrome.storage.sync.get(SYNC_POLICY_KEYS);
    const preference = parseEnforcementPreference(result[STORAGE_KEY_ENFORCED_V3]);
    const surveyOn = parseV3SurveyEnabled(result[STORAGE_KEY_V3SURVEY_ENABLED]);
    PowerAutomateUrlPolicy.configure({ preference, v3surveyEnabled: surveyOn });
    applyToolbarBadgeForEnforcement(preference);
    await applyRulesetsForPreference(preference);
  } catch (error) {
    console.error("[power-automate-editor-version-enforcer] reconcileFromStorage failed", error);
  }
}

const policyQueue = createPolicyLoadQueue(reconcileFromStorage);

chrome.webNavigation.onCommitted.addListener(
  async (details) => {
    await policyQueue.awaitReconcileCaughtUp();
    if (!isMainFrameTabNavigation(details)) {
      return;
    }
    enforceCanonicalOnTab(details.tabId, details.url);
  },
  { url: POWER_AUTOMATE_URL_FILTERS },
);

chrome.webNavigation.onHistoryStateUpdated.addListener(
  async (details) => {
    await policyQueue.awaitReconcileCaughtUp();
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
  policyQueue.scheduleReconcile();
});

chrome.runtime.onInstalled.addListener((details) => {
  policyQueue.chainAfterTail(async () => {
    try {
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
    } catch (error) {
      console.error(
        "[power-automate-editor-version-enforcer] onInstalled policy chain failed",
        error,
      );
    }
  });
});
