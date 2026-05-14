/**
 * Power Automate URL canonicalizer (content script).
 * Normalizes flow/run URLs to the user-selected `v3` value and aligns `v3survey` when that key already exists.
 * Assigns `globalThis.PowerAutomateUrlPolicy` for optional DevTools inspection (same object as the `PowerAutomateUrlPolicy` export from `./url-policy`).
 */
import { parseEnforcedV3, STORAGE_KEY_ENFORCED_V3 } from "./constants";
import { isEnforcedV3SyncChange } from "./storage-sync";
import { PowerAutomateUrlPolicy } from "./url-policy";

(
  globalThis as typeof globalThis & { PowerAutomateUrlPolicy?: typeof PowerAutomateUrlPolicy }
).PowerAutomateUrlPolicy = PowerAutomateUrlPolicy;

let isHistoryPatched = false;
let fallbackTimerId: number | null = null;
let fallbackStopTimerId: number | null = null;
let fallbackObserver: MutationObserver | null = null;
let lastEnforcedHref = "";
let lastEnforcedCanonicalKey = "";

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
      enforceCanonicalUrlOnCurrentPage();
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
  startShortLivedFallback();

  window.addEventListener("popstate", () => {
    enforceCanonicalUrlOnCurrentPage();
    startShortLivedFallback();
  });

  patchHistoryApi();
}

void chrome.storage.sync.get(STORAGE_KEY_ENFORCED_V3).then((result) => {
  PowerAutomateUrlPolicy.configure({
    enforcedV3: parseEnforcedV3(result[STORAGE_KEY_ENFORCED_V3]),
  });
  startCanonicalizer();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (
    !isEnforcedV3SyncChange(areaName, changes as Record<string, unknown>, STORAGE_KEY_ENFORCED_V3)
  ) {
    return;
  }
  const next = changes[STORAGE_KEY_ENFORCED_V3]?.newValue;
  PowerAutomateUrlPolicy.configure({
    enforcedV3: parseEnforcedV3(next),
  });
  lastEnforcedHref = "";
  lastEnforcedCanonicalKey = "";
  enforceCanonicalUrlOnCurrentPage();
  startShortLivedFallback();
});
