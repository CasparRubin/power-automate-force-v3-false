import type { EnforcedV3 } from "./constants";

/**
 * Shared Power Automate URL policy for background and content scripts.
 * Call `PowerAutomateUrlPolicy.configure({ enforcedV3 })` before relying on canonicalization;
 * the service worker and popup keep this in sync with `chrome.storage.sync`.
 */
const HOST_PATTERNS = [/(^|\.)powerautomate\.com$/i, /^flow\.microsoft\.com$/i];
const TARGET_PATH_SEGMENTS = ["/flows/", "/runs/"];
const V3_PARAM_KEY = "v3";
const V3_SURVEY_PARAM_KEY = "v3survey";
const MISSING_VALUE = "__missing__";

let enforcedV3: EnforcedV3 = "false";

function isSupportedHost(hostname: string): boolean {
  return HOST_PATTERNS.some((re) => re.test(hostname));
}

function isTargetPath(pathname: string): boolean {
  return TARGET_PATH_SEGMENTS.some((seg) => pathname.includes(seg));
}

function getParamValues(searchParams: URLSearchParams, expectedKey: string): string[] {
  const values: string[] = [];
  searchParams.forEach((value, key) => {
    if (key.toLowerCase() === expectedKey) {
      values.push(String(value).toLowerCase());
    }
  });
  return values;
}

function allMatchEnforced(values: string[]): boolean {
  const target = enforcedV3;
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] !== target) {
      return false;
    }
  }
  return true;
}

function isCompliant(parsed: URL): boolean {
  const v3Values = getParamValues(parsed.searchParams, V3_PARAM_KEY);
  if (v3Values.length === 0 || !allMatchEnforced(v3Values)) {
    return false;
  }
  const v3SurveyValues = getParamValues(parsed.searchParams, V3_SURVEY_PARAM_KEY);
  if (v3SurveyValues.length > 0 && !allMatchEnforced(v3SurveyValues)) {
    return false;
  }
  return true;
}

function normalizeV3Param(searchParams: URLSearchParams): void {
  const target = enforcedV3;
  let hasV3Param = false;
  searchParams.forEach((_value, key) => {
    if (key.toLowerCase() === V3_PARAM_KEY) {
      hasV3Param = true;
      searchParams.set(key, target);
    }
  });
  if (!hasV3Param) {
    searchParams.set(V3_PARAM_KEY, target);
  }
}

function normalizeV3SurveyIfPresent(searchParams: URLSearchParams): void {
  const target = enforcedV3;
  searchParams.forEach((_value, key) => {
    if (key.toLowerCase() === V3_SURVEY_PARAM_KEY) {
      searchParams.set(key, target);
    }
  });
}

function canonicalTokenForParam(searchParams: URLSearchParams, paramKey: string): string {
  const values = getParamValues(searchParams, paramKey);
  if (values.length === 0) {
    return MISSING_VALUE;
  }
  return allMatchEnforced(values) ? enforcedV3 : "other";
}

export const PowerAutomateUrlPolicy = {
  configure(opts: { enforcedV3: EnforcedV3 }): void {
    enforcedV3 = opts.enforcedV3 === "true" ? "true" : "false";
  },

  isTargetUrl(urlValue: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(urlValue);
    } catch {
      return false;
    }
    return isSupportedHost(parsed.hostname) && isTargetPath(parsed.pathname);
  },

  getCanonicalKey(urlValue: string): string | null {
    let parsed: URL;
    try {
      parsed = new URL(urlValue);
    } catch {
      return null;
    }
    if (!isSupportedHost(parsed.hostname) || !isTargetPath(parsed.pathname)) {
      return null;
    }
    const canonicalV3 = canonicalTokenForParam(parsed.searchParams, V3_PARAM_KEY);
    const canonicalV3Survey = canonicalTokenForParam(parsed.searchParams, V3_SURVEY_PARAM_KEY);
    return (
      parsed.hostname.toLowerCase() +
      parsed.pathname +
      "|v3=" +
      canonicalV3 +
      "|v3survey=" +
      canonicalV3Survey
    );
  },

  /**
   * Rewrites the URL to match the configured v3 / v3survey enforcement, or returns null if already compliant.
   */
  canonicalizeToEnforced(urlValue: string): string | null {
    let parsed: URL;
    try {
      parsed = new URL(urlValue);
    } catch {
      return null;
    }
    if (!isSupportedHost(parsed.hostname) || !isTargetPath(parsed.pathname)) {
      return null;
    }
    if (isCompliant(parsed)) {
      return null;
    }
    normalizeV3Param(parsed.searchParams);
    normalizeV3SurveyIfPresent(parsed.searchParams);
    return parsed.toString();
  },
};
