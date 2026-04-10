/**
 * Shared Power Automate URL policy used by background and content layers.
 */
(function initPowerAutomateUrlPolicy(global) {
  "use strict";

  var HOST_PATTERNS = [
    /(^|\.)powerautomate\.com$/i,
    /^flow\.microsoft\.com$/i
  ];

  var TARGET_PATH_SEGMENTS = ["/flows/", "/runs/"];

  function isSupportedHost(hostname) {
    for (var i = 0; i < HOST_PATTERNS.length; i += 1) {
      if (HOST_PATTERNS[i].test(hostname)) {
        return true;
      }
    }
    return false;
  }

  function isTargetPath(pathname) {
    for (var i = 0; i < TARGET_PATH_SEGMENTS.length; i += 1) {
      if (pathname.indexOf(TARGET_PATH_SEGMENTS[i]) !== -1) {
        return true;
      }
    }
    return false;
  }

  function isTargetUrl(urlValue) {
    var parsed;
    try {
      parsed = new URL(urlValue);
    } catch (error) {
      return false;
    }

    return isSupportedHost(parsed.hostname) && isTargetPath(parsed.pathname);
  }

  function canonicalizeToOldEditor(urlValue) {
    var parsed = new URL(urlValue);
    if (!isSupportedHost(parsed.hostname) || !isTargetPath(parsed.pathname)) {
      return null;
    }

    parsed.searchParams.set("v3", "false");
    var nextUrl = parsed.toString();
    if (nextUrl === urlValue) {
      return null;
    }

    return nextUrl;
  }

  global.PowerAutomateUrlPolicy = {
    isTargetUrl: isTargetUrl,
    canonicalizeToOldEditor: canonicalizeToOldEditor
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
