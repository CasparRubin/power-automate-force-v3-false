import type { EnforcementPreference, EnforcedV3 } from "./constants";

/**
 * Shared Power Automate URL policy for background and content scripts (and for `isTargetUrl` checks
 * in the popup reload helper). Call `PowerAutomateUrlPolicy.configure({ preference, v3surveyEnabled })`
 * before relying on canonicalization; the **service worker** and **content script** load preferences
 * from `chrome.storage.sync` and call `configure()`. The popup bundle does not configure policy state
 * (it only uses `isTargetUrl`, which does not depend on the stored preference).
 */
const HOST_PATTERNS = [/(^|\.)powerautomate\.com$/i, /^flow\.microsoft\.com$/i];
const TARGET_PATH_SEGMENTS = ["/flows/", "/runs/"];
const V3_PARAM_KEY = "v3";
const V3_SURVEY_PARAM_KEY = "v3survey";
const MISSING_VALUE = "__missing__";
/** Canonical survey token when survey mode is off (survey query is ignored for dedupe). */
const SURVEY_CANONICAL_IGNORED = "__survey_ignored__";

let preference: EnforcementPreference = "false";
let enforcedV3: EnforcedV3 = "false";
let v3surveyEnabled = false;

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

function allV3SurveyValuesTrue(values: string[]): boolean {
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] !== "true") {
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
  if (v3surveyEnabled) {
    const v3SurveyValues = getParamValues(parsed.searchParams, V3_SURVEY_PARAM_KEY);
    if (v3SurveyValues.length === 0 || !allV3SurveyValuesTrue(v3SurveyValues)) {
      return false;
    }
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

function ensureV3SurveyTrue(searchParams: URLSearchParams): void {
  const keysToRemove: string[] = [];
  searchParams.forEach((_value, key) => {
    if (key.toLowerCase() === V3_SURVEY_PARAM_KEY) {
      keysToRemove.push(key);
    }
  });
  for (const k of keysToRemove) {
    searchParams.delete(k);
  }
  searchParams.set("v3survey", "true");
}

function canonicalTokenForParam(searchParams: URLSearchParams, paramKey: string): string {
  const values = getParamValues(searchParams, paramKey);
  if (values.length === 0) {
    return MISSING_VALUE;
  }
  return allMatchEnforced(values) ? enforcedV3 : "other";
}

function canonicalTokenForV3Survey(searchParams: URLSearchParams): string {
  if (!v3surveyEnabled) {
    return SURVEY_CANONICAL_IGNORED;
  }
  const values = getParamValues(searchParams, V3_SURVEY_PARAM_KEY);
  if (values.length === 0) {
    return MISSING_VALUE;
  }
  return allV3SurveyValuesTrue(values) ? "true" : "other";
}

export const PowerAutomateUrlPolicy = {
  configure(opts: { preference: EnforcementPreference; v3surveyEnabled?: boolean }): void {
    preference = opts.preference;
    if (opts.preference === "true" || opts.preference === "false") {
      enforcedV3 = opts.preference;
    }
    v3surveyEnabled = opts.v3surveyEnabled === true;
  },

  isEnforcementPaused(): boolean {
    return preference === "off";
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
    const canonicalV3Survey = canonicalTokenForV3Survey(parsed.searchParams);
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
   * Rewrites the URL to match the configured v3 / optional v3survey rules, or returns null if already compliant.
   * When preference is `"off"`, always returns null (no rewrite).
   */
  canonicalizeToEnforced(urlValue: string): string | null {
    if (preference === "off") {
      return null;
    }
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
    if (v3surveyEnabled) {
      ensureV3SurveyTrue(parsed.searchParams);
    }
    return parsed.toString();
  },
};
