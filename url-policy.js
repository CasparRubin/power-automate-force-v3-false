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
  var V3_PARAM_KEY = "v3";
  var V3_SURVEY_PARAM_KEY = "v3survey";
  var FALSE_VALUE = "false";

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

  function normalizeV3SurveyIfPresent(searchParams) {
    searchParams.forEach(function enforceV3Survey(_value, key) {
      if (key.toLowerCase() === V3_SURVEY_PARAM_KEY) {
        searchParams.set(key, FALSE_VALUE);
      }
    });
  }

  function normalizeV3Param(searchParams) {
    var hasV3Param = false;
    searchParams.forEach(function enforceV3(_value, key) {
      if (key.toLowerCase() === V3_PARAM_KEY) {
        hasV3Param = true;
        searchParams.set(key, FALSE_VALUE);
      }
    });

    if (!hasV3Param) {
      searchParams.set(V3_PARAM_KEY, FALSE_VALUE);
    }
  }

  function canonicalizeToOldEditor(urlValue) {
    var parsed = new URL(urlValue);
    if (!isSupportedHost(parsed.hostname) || !isTargetPath(parsed.pathname)) {
      return null;
    }

    normalizeV3Param(parsed.searchParams);
    normalizeV3SurveyIfPresent(parsed.searchParams);
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
