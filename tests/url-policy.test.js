"use strict";

var assert = require("node:assert/strict");
var path = require("node:path");

delete globalThis.PowerAutomateUrlPolicy;
require(path.join(__dirname, "..", "url-policy.js"));

var policy = globalThis.PowerAutomateUrlPolicy;

assert.ok(policy, "PowerAutomateUrlPolicy should be initialized");

function runTest(name, fn) {
  try {
    fn();
    process.stdout.write("PASS " + name + "\n");
  } catch (error) {
    process.stderr.write("FAIL " + name + "\n");
    throw error;
  }
}

runTest("targets supported hosts and flow path", function () {
  assert.equal(
    policy.isTargetUrl("https://emea.powerautomate.com/environments/foo/flows/bar/details"),
    true
  );
  assert.equal(policy.isTargetUrl("https://flow.microsoft.com/en-us/flows/bar/details"), true);
});

runTest("ignores non-target paths and invalid URLs", function () {
  assert.equal(policy.isTargetUrl("https://emea.powerautomate.com/environments/foo/home"), false);
  assert.equal(policy.isTargetUrl("not-a-url"), false);
});

runTest("canonicalizes v3 to false when missing", function () {
  var nextUrl = policy.canonicalizeToOldEditor(
    "https://emea.powerautomate.com/environments/foo/flows/bar/details?x=1"
  );
  assert.ok(nextUrl, "Expected URL to be rewritten when v3 is missing");
  var parsed = new URL(nextUrl);
  assert.equal(parsed.searchParams.get("x"), "1");
  assert.equal(parsed.searchParams.get("v3"), "false");
});

runTest("normalizes mixed-case repeated v3 values", function () {
  var nextUrl = policy.canonicalizeToOldEditor(
    "https://flow.microsoft.com/en-us/runs/id?V3=true&v3=TRUE&z=1"
  );
  assert.ok(nextUrl, "Expected URL to be rewritten when repeated v3 values are not false");
  var parsed = new URL(nextUrl);
  assert.equal(parsed.searchParams.get("V3"), "false");
  assert.equal(parsed.searchParams.get("v3"), "false");
  assert.equal(parsed.searchParams.get("z"), "1");
});

runTest("normalizes v3survey when present but does not add if missing", function () {
  var withSurvey = policy.canonicalizeToOldEditor(
    "https://flow.microsoft.com/en-us/flows/id?v3=false&v3Survey=true"
  );
  assert.ok(withSurvey, "Expected rewrite when v3survey is not false");
  var parsedWithSurvey = new URL(withSurvey);
  assert.equal(parsedWithSurvey.searchParams.get("v3"), "false");
  assert.equal(parsedWithSurvey.searchParams.get("v3Survey"), "false");

  var withoutSurvey = policy.canonicalizeToOldEditor(
    "https://flow.microsoft.com/en-us/flows/id?v3=true"
  );
  assert.ok(withoutSurvey, "Expected v3 rewrite");
  var parsedWithoutSurvey = new URL(withoutSurvey);
  assert.equal(parsedWithoutSurvey.searchParams.has("v3survey"), false);
  assert.equal(parsedWithoutSurvey.searchParams.has("v3Survey"), false);
});

runTest("returns null when already compliant", function () {
  assert.equal(
    policy.canonicalizeToOldEditor(
      "https://emea.powerautomate.com/environments/foo/runs/bar?x=1&v3=false&v3survey=false"
    ),
    null
  );
});

runTest("uses canonical keys to dedupe encoding variants", function () {
  var keyWithPercent20 = policy.getCanonicalKey(
    "https://emea.powerautomate.com/environments/default/flows/new?name=hello%20world&v3=false"
  );
  var keyWithPlus = policy.getCanonicalKey(
    "https://emea.powerautomate.com/environments/default/flows/new?name=hello+world&v3=false"
  );
  assert.equal(keyWithPercent20, keyWithPlus);
});

runTest("canonical key distinguishes non-compliant values", function () {
  var compliant = policy.getCanonicalKey(
    "https://flow.microsoft.com/en-us/flows/id?v3=false&v3survey=false"
  );
  var nonCompliant = policy.getCanonicalKey(
    "https://flow.microsoft.com/en-us/flows/id?v3=true&v3survey=true"
  );
  assert.notEqual(compliant, nonCompliant);
});
