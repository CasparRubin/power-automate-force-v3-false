/**
 * Imperative fallback layer for navigations not covered by DNR alone.
 */
"use strict";

importScripts("url-policy.js");

function enforceOldEditorOnTab(tabId, urlValue) {
  if (!PowerAutomateUrlPolicy || !PowerAutomateUrlPolicy.isTargetUrl(urlValue)) {
    return;
  }

  var nextUrl = PowerAutomateUrlPolicy.canonicalizeToOldEditor(urlValue);
  if (!nextUrl) {
    return;
  }

  chrome.tabs.update(tabId, { url: nextUrl });
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
