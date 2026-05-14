/**
 * Power Automate URL canonicalizer (content script).
 * When enforcement is active (not `off`), applies the same policy as the service worker: normalizes
 * flow/run URLs to the stored `v3` value. Survey handling follows sync `v3surveyEnabled` (**Hide:**
 * default sync `"false"`, sets `v3survey=false` and adds it if missing; **Show:** sync `"true"`,
 * normalizes existing `v3survey` keys to `true` only and does not add the param when absent).
 * When paused (`off`), canonicalization is a no-op and short-lived polling/observer are not started.
 * While the fallback `MutationObserver` is active, its callbacks are coalesced with `requestAnimationFrame`
 * so rapid DOM mutations do not each synchronously re-run URL logic.
 * Assigns `globalThis.PowerAutomateUrlPolicy` for optional DevTools inspection (same implementation as
 * `./url-policy`; this bundle has its own module instance, configured from storage like the service worker).
 */
import {
  parseEnforcementPreference,
  parseV3SurveyEnabled,
  STORAGE_KEY_ENFORCED_V3,
  STORAGE_KEY_V3SURVEY_ENABLED,
  SYNC_POLICY_KEYS,
} from "./constants";
import { isEnforcerSyncChange } from "./storage-sync";
import { PowerAutomateUrlPolicy } from "./url-policy";

(
  globalThis as typeof globalThis & { PowerAutomateUrlPolicy?: typeof PowerAutomateUrlPolicy }
).PowerAutomateUrlPolicy = PowerAutomateUrlPolicy;

let isHistoryPatched = false;
let fallbackTimerId: number | null = null;
let fallbackStopTimerId: number | null = null;
let fallbackObserver: MutationObserver | null = null;
/** Coalesces MutationObserver callbacks to one canonicalization per animation frame (main-thread). */
let observerCanonicalRafId: number | null = null;
let lastEnforcedHref = "";
let lastEnforcedCanonicalKey = "";

function scheduleCanonicalFromMutationObserver(): void {
  if (observerCanonicalRafId !== null) {
    return;
  }
  observerCanonicalRafId = window.requestAnimationFrame(() => {
    observerCanonicalRafId = null;
    enforceCanonicalUrlOnCurrentPage();
  });
}

function enforceCanonicalUrlOnCurrentPage(): boolean {
  const currentHref = window.location.href;
  if (currentHref === lastEnforcedHref) {
    return false;
  }

  if (!PowerAutomateUrlPolicy.isTargetUrl(currentHref)) {
    lastEnforcedHref = currentHref;
    lastEnforcedCanonicalKey = "";
    return false;
  }

  const currentCanonicalKey = PowerAutomateUrlPolicy.getCanonicalKey(currentHref);
  if (currentCanonicalKey && currentCanonicalKey === lastEnforcedCanonicalKey) {
    lastEnforcedHref = currentHref;
    return false;
  }

  const nextUrl = PowerAutomateUrlPolicy.canonicalizeToEnforced(currentHref);
  if (!nextUrl) {
    lastEnforcedHref = currentHref;
    lastEnforcedCanonicalKey = currentCanonicalKey || "";
    return false;
  }

  lastEnforcedHref = nextUrl;
  lastEnforcedCanonicalKey = PowerAutomateUrlPolicy.getCanonicalKey(nextUrl) || "";

  window.history.replaceState(window.history.state, "", nextUrl);
  return true;
}

function patchHistoryApi(): void {
  if (isHistoryPatched) {
    return;
  }
  isHistoryPatched = true;

  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);

  window.history.pushState = function pushStateWrapper(...args: Parameters<History["pushState"]>) {
    const result = originalPushState(...args);
    enforceCanonicalUrlOnCurrentPage();
    return result;
  };

  window.history.replaceState = function replaceStateWrapper(
    ...args: Parameters<History["replaceState"]>
  ) {
    const result = originalReplaceState(...args);
    enforceCanonicalUrlOnCurrentPage();
    return result;
  };
}

function stopShortLivedFallback(): void {
  if (fallbackTimerId !== null) {
    window.clearInterval(fallbackTimerId);
    fallbackTimerId = null;
  }
  if (fallbackStopTimerId !== null) {
    window.clearTimeout(fallbackStopTimerId);
    fallbackStopTimerId = null;
  }
  if (fallbackObserver) {
    fallbackObserver.disconnect();
    fallbackObserver = null;
  }
  if (observerCanonicalRafId !== null) {
    window.cancelAnimationFrame(observerCanonicalRafId);
    observerCanonicalRafId = null;
  }
}

function startShortLivedFallback(): void {
  stopShortLivedFallback();

  fallbackTimerId = window.setInterval(() => {
    enforceCanonicalUrlOnCurrentPage();
  }, 400);

  fallbackStopTimerId = window.setTimeout(() => {
    stopShortLivedFallback();
  }, 6000);

  try {
    fallbackObserver = new MutationObserver(() => {
      scheduleCanonicalFromMutationObserver();
    });

    if (document.documentElement) {
      fallbackObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    } else {
      window.addEventListener("DOMContentLoaded", function onDomContentLoaded() {
        window.removeEventListener("DOMContentLoaded", onDomContentLoaded);
        if (fallbackObserver && document.documentElement) {
          fallbackObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
          });
        }
      });
    }
  } catch {
    fallbackObserver = null;
  }
}

function startCanonicalizer(): void {
  enforceCanonicalUrlOnCurrentPage();
  if (!PowerAutomateUrlPolicy.isEnforcementPaused()) {
    startShortLivedFallback();
  }

  window.addEventListener("popstate", () => {
    enforceCanonicalUrlOnCurrentPage();
    if (!PowerAutomateUrlPolicy.isEnforcementPaused()) {
      startShortLivedFallback();
    }
  });

  patchHistoryApi();
}

function applyPolicyFromSyncResult(result: {
  [STORAGE_KEY_ENFORCED_V3]?: unknown;
  [STORAGE_KEY_V3SURVEY_ENABLED]?: unknown;
}): void {
  PowerAutomateUrlPolicy.configure({
    preference: parseEnforcementPreference(result[STORAGE_KEY_ENFORCED_V3]),
    v3surveyEnabled: parseV3SurveyEnabled(result[STORAGE_KEY_V3SURVEY_ENABLED]),
  });
}

void chrome.storage.sync.get(SYNC_POLICY_KEYS).then((result) => {
  applyPolicyFromSyncResult(result);
  startCanonicalizer();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (!isEnforcerSyncChange(areaName, changes as Record<string, unknown>)) {
    return;
  }
  void chrome.storage.sync.get(SYNC_POLICY_KEYS).then((result) => {
    applyPolicyFromSyncResult(result);
    lastEnforcedHref = "";
    lastEnforcedCanonicalKey = "";
    if (PowerAutomateUrlPolicy.isEnforcementPaused()) {
      stopShortLivedFallback();
    } else {
      enforceCanonicalUrlOnCurrentPage();
      startShortLivedFallback();
    }
  });
});
