import { beforeEach, describe, expect, it } from "vitest";
import { PowerAutomateUrlPolicy } from "../src/url-policy";

beforeEach(() => {
  PowerAutomateUrlPolicy.configure({ enforcedV3: "false" });
});

describe("PowerAutomateUrlPolicy (v3=false)", () => {
  it("targets supported hosts and flow path", () => {
    expect(
      PowerAutomateUrlPolicy.isTargetUrl(
        "https://emea.powerautomate.com/environments/foo/flows/bar/details",
      ),
    ).toBe(true);
    expect(
      PowerAutomateUrlPolicy.isTargetUrl("https://flow.microsoft.com/en-us/flows/bar/details"),
    ).toBe(true);
  });

  it("ignores non-target paths and invalid URLs", () => {
    expect(
      PowerAutomateUrlPolicy.isTargetUrl("https://emea.powerautomate.com/environments/foo/home"),
    ).toBe(false);
    expect(PowerAutomateUrlPolicy.isTargetUrl("not-a-url")).toBe(false);
  });

  it("canonicalizes v3 to false when missing", () => {
    const nextUrl = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://emea.powerautomate.com/environments/foo/flows/bar/details?x=1",
    );
    expect(nextUrl).toBeTruthy();
    const parsed = new URL(nextUrl!);
    expect(parsed.searchParams.get("x")).toBe("1");
    expect(parsed.searchParams.get("v3")).toBe("false");
  });

  it("normalizes mixed-case repeated v3 values", () => {
    const nextUrl = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://flow.microsoft.com/en-us/runs/id?V3=true&v3=TRUE&z=1",
    );
    expect(nextUrl).toBeTruthy();
    const parsed = new URL(nextUrl!);
    expect(parsed.searchParams.get("V3")).toBe("false");
    expect(parsed.searchParams.get("v3")).toBe("false");
    expect(parsed.searchParams.get("z")).toBe("1");
  });

  it("normalizes v3survey when present but does not add if missing", () => {
    const withSurvey = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://flow.microsoft.com/en-us/flows/id?v3=false&v3Survey=true",
    );
    expect(withSurvey).toBeTruthy();
    const parsedWithSurvey = new URL(withSurvey!);
    expect(parsedWithSurvey.searchParams.get("v3")).toBe("false");
    expect(parsedWithSurvey.searchParams.get("v3Survey")).toBe("false");

    const withoutSurvey = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://flow.microsoft.com/en-us/flows/id?v3=true",
    );
    expect(withoutSurvey).toBeTruthy();
    const parsedWithoutSurvey = new URL(withoutSurvey!);
    expect(parsedWithoutSurvey.searchParams.has("v3survey")).toBe(false);
    expect(parsedWithoutSurvey.searchParams.has("v3Survey")).toBe(false);
  });

  it("returns null when already compliant", () => {
    expect(
      PowerAutomateUrlPolicy.canonicalizeToEnforced(
        "https://emea.powerautomate.com/environments/foo/runs/bar?x=1&v3=false&v3survey=false",
      ),
    ).toBeNull();
  });

  it("uses canonical keys to dedupe encoding variants", () => {
    const keyWithPercent20 = PowerAutomateUrlPolicy.getCanonicalKey(
      "https://emea.powerautomate.com/environments/default/flows/new?name=hello%20world&v3=false",
    );
    const keyWithPlus = PowerAutomateUrlPolicy.getCanonicalKey(
      "https://emea.powerautomate.com/environments/default/flows/new?name=hello+world&v3=false",
    );
    expect(keyWithPercent20).toBe(keyWithPlus);
  });

  it("canonical key distinguishes non-compliant values", () => {
    const compliant = PowerAutomateUrlPolicy.getCanonicalKey(
      "https://flow.microsoft.com/en-us/flows/id?v3=false&v3survey=false",
    );
    const nonCompliant = PowerAutomateUrlPolicy.getCanonicalKey(
      "https://flow.microsoft.com/en-us/flows/id?v3=true&v3survey=true",
    );
    expect(compliant).not.toBe(nonCompliant);
  });
});

describe("PowerAutomateUrlPolicy (v3=true)", () => {
  beforeEach(() => {
    PowerAutomateUrlPolicy.configure({ enforcedV3: "true" });
  });

  it("canonicalizes v3 to true when missing", () => {
    const nextUrl = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://emea.powerautomate.com/environments/foo/flows/bar/details?x=1",
    );
    expect(nextUrl).toBeTruthy();
    const parsed = new URL(nextUrl!);
    expect(parsed.searchParams.get("v3")).toBe("true");
    expect(parsed.searchParams.get("x")).toBe("1");
  });

  it("rewrites v3=false to v3=true", () => {
    const nextUrl = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://flow.microsoft.com/en-us/flows/id?v3=false",
    );
    expect(nextUrl).toBeTruthy();
    const parsed = new URL(nextUrl!);
    expect(parsed.searchParams.get("v3")).toBe("true");
  });

  it("normalizes v3survey to true when present", () => {
    const nextUrl = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://flow.microsoft.com/en-us/flows/id?v3=true&v3Survey=false",
    );
    expect(nextUrl).toBeTruthy();
    const parsed = new URL(nextUrl!);
    expect(parsed.searchParams.get("v3")).toBe("true");
    expect(parsed.searchParams.get("v3Survey")).toBe("true");
  });

  it("returns null when already compliant for true mode", () => {
    expect(
      PowerAutomateUrlPolicy.canonicalizeToEnforced(
        "https://flow.microsoft.com/en-us/flows/id?v3=true&v3survey=true",
      ),
    ).toBeNull();
  });
});

describe("PowerAutomateUrlPolicy edges (v3=false)", () => {
  beforeEach(() => {
    PowerAutomateUrlPolicy.configure({ enforcedV3: "false" });
  });

  it("treats /runs/ paths as in scope", () => {
    expect(
      PowerAutomateUrlPolicy.isTargetUrl("https://emea.powerautomate.com/env/runs/run-1"),
    ).toBe(true);
  });

  it("preserves hash fragment when rewriting query", () => {
    const next = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://flow.microsoft.com/en-us/flows/a/details?v3=true#leftNavPane",
    );
    expect(next).toBeTruthy();
    expect(next!.endsWith("#leftNavPane")).toBe(true);
    expect(new URL(next!).searchParams.get("v3")).toBe("false");
  });

  it("normalizes conflicting duplicate v3survey keys", () => {
    const next = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://flow.microsoft.com/en-us/flows/x?v3=false&v3survey=false&v3Survey=true",
    );
    expect(next).toBeTruthy();
    const parsed = new URL(next!);
    expect(parsed.searchParams.get("v3")).toBe("false");
    expect(parsed.searchParams.get("v3survey")).toBe("false");
    expect(parsed.searchParams.get("v3Survey")).toBe("false");
  });
});
