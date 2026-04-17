/**
 * Power Automate URL canonicalizer.
 *
 * This content script runs on supported Power Automate hosts and ensures flow/run
 * URLs are normalized to v3=false and v3survey=false (when v3survey exists).
 *
 * Scope:
 * - Only URLs whose path contains /flows/ or /runs/
 * - No changes to other app pages
 *
 * Navigation support:
 * - Initial page load / refresh
 * - Browser back/forward (popstate)
 * - SPA navigation via history.pushState / history.replaceState
 */
(function initUrlCanonicalizer() {
  "use strict";

  // Guard to avoid patching History API multiple times.
  var isHistoryPatched = false;
  var fallbackTimerId = null;
  var fallbackStopTimerId = null;
  var fallbackObserver = null;
  var lastEnforcedHref = "";

  function hasPolicy() {
    return Boolean(
      window.PowerAutomateUrlPolicy &&
        typeof window.PowerAutomateUrlPolicy.isTargetUrl === "function" &&
        typeof window.PowerAutomateUrlPolicy.canonicalizeToOldEditor === "function"
    );
  }

  /**
   * Applies shared URL policy to the current URL when in scope.
   * Returns true when a URL change is applied, false otherwise.
   */
  function enforceCanonicalUrlOnCurrentPage() {
    if (!hasPolicy()) {
      return false;
    }

    var currentHref = window.location.href;
    if (currentHref === lastEnforcedHref) {
      return false;
    }

    if (!window.PowerAutomateUrlPolicy.isTargetUrl(currentHref)) {
      lastEnforcedHref = currentHref;
      return false;
    }

    var nextUrl = window.PowerAutomateUrlPolicy.canonicalizeToOldEditor(currentHref);
    if (!nextUrl) {
      lastEnforcedHref = currentHref;
      return false;
    }

    lastEnforcedHref = nextUrl;

    // Use replaceState so we do not create extra history entries or reload.
    window.history.replaceState(window.history.state, "", nextUrl);
    return true;
  }

  /**
   * Wraps pushState/replaceState so SPA URL changes also trigger enforcement.
   */
  function patchHistoryApi() {
    if (isHistoryPatched) {
      return;
    }
    isHistoryPatched = true;

    var originalPushState = window.history.pushState;
    var originalReplaceState = window.history.replaceState;

    window.history.pushState = function pushStateWrapper() {
      var result = originalPushState.apply(window.history, arguments);
      enforceCanonicalUrlOnCurrentPage();
      return result;
    };

    window.history.replaceState = function replaceStateWrapper() {
      var result = originalReplaceState.apply(window.history, arguments);
      enforceCanonicalUrlOnCurrentPage();
      return result;
    };
  }

  function stopShortLivedFallback() {
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

  function startShortLivedFallback() {
    stopShortLivedFallback();

    fallbackTimerId = window.setInterval(function fallbackTick() {
      enforceCanonicalUrlOnCurrentPage();
    }, 400);

    fallbackStopTimerId = window.setTimeout(function stopFallback() {
      stopShortLivedFallback();
    }, 6000);

    fallbackObserver = new MutationObserver(function onMutation() {
      enforceCanonicalUrlOnCurrentPage();
    });

    fallbackObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // Initial pass for direct navigation and refresh.
  enforceCanonicalUrlOnCurrentPage();
  startShortLivedFallback();

  // Back/forward navigation in SPA/browser history.
  window.addEventListener("popstate", function onPopState() {
    enforceCanonicalUrlOnCurrentPage();
    startShortLivedFallback();
  });

  // Patch SPA navigation methods for in-app route changes.
  patchHistoryApi();
})();
