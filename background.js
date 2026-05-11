/**
 * Imperative fallback layer for navigations not covered by DNR alone.
 */
"use strict";

importScripts("url-policy.js");

var lastCanonicalKeyByTabId = Object.create(null);

function clearTabCanonicalKey(tabId) {
  delete lastCanonicalKeyByTabId[tabId];
}

function enforceOldEditorOnTab(tabId, urlValue) {
  if (!PowerAutomateUrlPolicy || !PowerAutomateUrlPolicy.isTargetUrl(urlValue)) {
    clearTabCanonicalKey(tabId);
    return;
  }

  var incomingCanonicalKey = PowerAutomateUrlPolicy.getCanonicalKey(urlValue);
  if (incomingCanonicalKey && lastCanonicalKeyByTabId[tabId] === incomingCanonicalKey) {
    return;
  }

  var nextUrl = PowerAutomateUrlPolicy.canonicalizeToOldEditor(urlValue);
  if (!nextUrl) {
    if (incomingCanonicalKey) {
      lastCanonicalKeyByTabId[tabId] = incomingCanonicalKey;
    } else {
      clearTabCanonicalKey(tabId);
    }
    return;
  }

  var nextCanonicalKey = PowerAutomateUrlPolicy.getCanonicalKey(nextUrl);
  if (nextCanonicalKey) {
    lastCanonicalKeyByTabId[tabId] = nextCanonicalKey;
  }

  chrome.tabs.update(tabId, { url: nextUrl }, function ignoreClosedTabError() {
    // Tab may have closed or navigated away before update applies.
    if (chrome.runtime.lastError) {
      clearTabCanonicalKey(tabId);
      return;
    }
  });
}

function isMainFrameNavigation(details) {
  return details && details.frameId === 0 && typeof details.tabId === "number";
}

var POWER_AUTOMATE_URL_FILTERS = [
  { hostSuffix: "powerautomate.com", schemes: ["https"] },
  { hostEquals: "flow.microsoft.com", schemes: ["https"] }
];

chrome.webNavigation.onCommitted.addListener(function onCommitted(details) {
  if (!isMainFrameNavigation(details)) {
    return;
  }

  enforceOldEditorOnTab(details.tabId, details.url);
}, { url: POWER_AUTOMATE_URL_FILTERS });

chrome.webNavigation.onHistoryStateUpdated.addListener(function onHistoryStateUpdated(details) {
  if (!isMainFrameNavigation(details)) {
    return;
  }

  enforceOldEditorOnTab(details.tabId, details.url);
}, { url: POWER_AUTOMATE_URL_FILTERS });

chrome.tabs.onRemoved.addListener(function onTabRemoved(tabId) {
  clearTabCanonicalKey(tabId);
});
