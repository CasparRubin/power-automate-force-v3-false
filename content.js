/**
 * Power Automate v3=false enforcer
 *
 * This content script runs on make.powerautomate.com and ensures that URLs
 * related to flow editing/viewing include v3=false.
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
(function initV3FalseEnforcer() {
  "use strict";

  // Paths that indicate a flow editor/view or a flow run page.
  var TARGET_PATH_SEGMENTS = ["/flows/", "/runs/"];

  // Guard to avoid patching History API multiple times.
  var isHistoryPatched = false;

  /**
   * Returns true when the current path should be enforced.
   */
  function isTargetPath(pathname) {
    for (var i = 0; i < TARGET_PATH_SEGMENTS.length; i += 1) {
      if (pathname.indexOf(TARGET_PATH_SEGMENTS[i]) !== -1) {
        return true;
      }
    }
    return false;
  }

  /**
   * Ensures v3=false on the current URL when path matches /flows/ or /runs/.
   * Returns true when a URL change is applied, false otherwise.
   */
  function enforceV3FalseOnCurrentUrl() {
    var current = new URL(window.location.href);

    if (!isTargetPath(current.pathname)) {
      return false;
    }

    var currentV3 = current.searchParams.get("v3");
    if (currentV3 === "false") {
      return false;
    }

    current.searchParams.set("v3", "false");
    var nextUrl = current.toString();

    if (nextUrl === window.location.href) {
      return false;
    }

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
      enforceV3FalseOnCurrentUrl();
      return result;
    };

    window.history.replaceState = function replaceStateWrapper() {
      var result = originalReplaceState.apply(window.history, arguments);
      enforceV3FalseOnCurrentUrl();
      return result;
    };
  }

  // Initial pass for direct navigation and refresh.
  enforceV3FalseOnCurrentUrl();

  // Back/forward navigation in SPA/browser history.
  window.addEventListener("popstate", function onPopState() {
    enforceV3FalseOnCurrentUrl();
  });

  // Patch SPA navigation methods for in-app route changes.
  patchHistoryApi();
})();
