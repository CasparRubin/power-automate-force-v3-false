import { beforeEach, describe, expect, it } from "vitest";
import { PowerAutomateUrlPolicy } from "../src/url-policy";

/** Default `v3surveyEnabled: false` = hide survey (`v3survey=false` on rewrites). */

beforeEach(() => {
  PowerAutomateUrlPolicy.configure({ preference: "false", v3surveyEnabled: false });
});

describe("PowerAutomateUrlPolicy (v3=false, hide survey)", () => {
  it("is not paused when enforcing false", () => {
    expect(PowerAutomateUrlPolicy.isEnforcementPaused()).toBe(false);
  });

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

  it("canonicalizes v3 to false when missing and adds v3survey=false (hide)", () => {
    const nextUrl = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://emea.powerautomate.com/environments/foo/flows/bar/details?x=1",
    );
    expect(nextUrl).toBeTruthy();
    const parsed = new URL(nextUrl!);
    expect(parsed.searchParams.get("x")).toBe("1");
    expect(parsed.searchParams.get("v3")).toBe("false");
    expect(parsed.searchParams.get("v3survey")).toBe("false");
  });

  it("normalizes mixed-case repeated v3 values and sets v3survey=false", () => {
    const nextUrl = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://flow.microsoft.com/en-us/runs/id?V3=true&v3=TRUE&z=1",
    );
    expect(nextUrl).toBeTruthy();
    const parsed = new URL(nextUrl!);
    expect(parsed.searchParams.get("V3")).toBe("false");
    expect(parsed.searchParams.get("v3")).toBe("false");
    expect(parsed.searchParams.get("z")).toBe("1");
    expect(parsed.searchParams.get("v3survey")).toBe("false");
  });

  it("hide mode rewrites v3survey=true to v3survey=false when fixing v3", () => {
    const nextUrl = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://flow.microsoft.com/en-us/flows/id?v3=true&v3Survey=true",
    );
    expect(nextUrl).toBeTruthy();
    const parsed = new URL(nextUrl!);
    expect(parsed.searchParams.get("v3")).toBe("false");
    expect(parsed.searchParams.get("v3survey")).toBe("false");
  });

  it("returns null when already compliant (hide)", () => {
    expect(
      PowerAutomateUrlPolicy.canonicalizeToEnforced(
        "https://emea.powerautomate.com/environments/foo/runs/bar?x=1&v3=false&v3survey=false",
      ),
    ).toBeNull();
  });

  it("uses canonical keys to dedupe encoding variants", () => {
    const keyWithPercent20 = PowerAutomateUrlPolicy.getCanonicalKey(
      "https://emea.powerautomate.com/environments/default/flows/new?name=hello%20world&v3=false&v3survey=false",
    );
    const keyWithPlus = PowerAutomateUrlPolicy.getCanonicalKey(
      "https://emea.powerautomate.com/environments/default/flows/new?name=hello+world&v3=false&v3survey=false",
    );
    expect(keyWithPercent20).toBe(keyWithPlus);
  });

  it("canonical key distinguishes v3survey true vs false when hiding", () => {
    const a = PowerAutomateUrlPolicy.getCanonicalKey(
      "https://flow.microsoft.com/en-us/flows/id?v3=false&v3survey=false",
    );
    const b = PowerAutomateUrlPolicy.getCanonicalKey(
      "https://flow.microsoft.com/en-us/flows/id?v3=false&v3survey=true",
    );
    expect(a).not.toBe(b);
    expect(a).toContain("|v3survey=false");
    expect(b).toContain("|v3survey=other");
  });
});

describe("PowerAutomateUrlPolicy (paused)", () => {
  beforeEach(() => {
    PowerAutomateUrlPolicy.configure({ preference: "off", v3surveyEnabled: false });
  });

  it("reports enforcement paused", () => {
    expect(PowerAutomateUrlPolicy.isEnforcementPaused()).toBe(true);
  });

  it("does not canonicalize when v3 would change", () => {
    expect(
      PowerAutomateUrlPolicy.canonicalizeToEnforced(
        "https://emea.powerautomate.com/environments/foo/flows/bar/details?v3=true",
      ),
    ).toBeNull();
  });
});

describe("PowerAutomateUrlPolicy (show survey, enforced v3=false)", () => {
  beforeEach(() => {
    PowerAutomateUrlPolicy.configure({ preference: "false", v3surveyEnabled: true });
  });

  it("getCanonicalKey distinguishes v3survey when show mode and key present", () => {
    const compliant = PowerAutomateUrlPolicy.getCanonicalKey(
      "https://flow.microsoft.com/en-us/flows/id?v3=false&v3survey=true",
    );
    const nonCompliant = PowerAutomateUrlPolicy.getCanonicalKey(
      "https://flow.microsoft.com/en-us/flows/id?v3=false&v3survey=false",
    );
    expect(compliant).not.toBe(nonCompliant);
    expect(compliant).toContain("|v3survey=true");
    expect(nonCompliant).toContain("|v3survey=other");
  });

  it("does not add v3survey=true when key is absent (show)", () => {
    const nextUrl = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://emea.powerautomate.com/environments/foo/flows/bar/details?x=1&v3=false",
    );
    expect(nextUrl).toBeNull();
    const parsed = new URL(
      "https://emea.powerautomate.com/environments/foo/flows/bar/details?x=1&v3=false",
    );
    expect(parsed.searchParams.has("v3survey")).toBe(false);
  });

  it("coerces existing v3survey values to true when key present (show)", () => {
    const nextUrl = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://flow.microsoft.com/en-us/flows/id?v3=false&v3Survey=false",
    );
    expect(nextUrl).toBeTruthy();
    const parsed = new URL(nextUrl!);
    expect(parsed.searchParams.get("v3")).toBe("false");
    expect(parsed.searchParams.get("v3survey")).toBe("true");
  });

  it("fixes wrong v3 without adding v3survey when survey key was absent (show)", () => {
    const nextUrl = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://flow.microsoft.com/en-us/flows/id?v3=true&x=1",
    );
    expect(nextUrl).toBeTruthy();
    const parsed = new URL(nextUrl!);
    expect(parsed.searchParams.get("v3")).toBe("false");
    expect(parsed.searchParams.get("x")).toBe("1");
    expect(parsed.searchParams.has("v3survey")).toBe(false);
  });

  it("collapses duplicate v3survey keys to a single v3survey=true (show)", () => {
    const nextUrl = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://flow.microsoft.com/en-us/flows/id?v3=false&v3survey=false&v3Survey=true",
    );
    expect(nextUrl).toBeTruthy();
    const parsed = new URL(nextUrl!);
    expect(parsed.searchParams.get("v3")).toBe("false");
    expect(parsed.searchParams.get("v3survey")).toBe("true");
    expect(
      [...parsed.searchParams.keys()].filter((k) => k.toLowerCase() === "v3survey"),
    ).toHaveLength(1);
  });
});

describe("PowerAutomateUrlPolicy (v3=true, hide survey)", () => {
  beforeEach(() => {
    PowerAutomateUrlPolicy.configure({ preference: "true", v3surveyEnabled: false });
  });

  it("is not paused when enforcing true", () => {
    expect(PowerAutomateUrlPolicy.isEnforcementPaused()).toBe(false);
  });

  it("canonicalizes v3 to true when missing and adds v3survey=false", () => {
    const nextUrl = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://emea.powerautomate.com/environments/foo/flows/bar/details?x=1",
    );
    expect(nextUrl).toBeTruthy();
    const parsed = new URL(nextUrl!);
    expect(parsed.searchParams.get("v3")).toBe("true");
    expect(parsed.searchParams.get("x")).toBe("1");
    expect(parsed.searchParams.get("v3survey")).toBe("false");
  });

  it("rewrites v3=false to v3=true and sets v3survey=false", () => {
    const nextUrl = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://flow.microsoft.com/en-us/flows/id?v3=false",
    );
    expect(nextUrl).toBeTruthy();
    const parsed = new URL(nextUrl!);
    expect(parsed.searchParams.get("v3")).toBe("true");
    expect(parsed.searchParams.get("v3survey")).toBe("false");
  });

  it("returns null when v3 and hide survey already match", () => {
    expect(
      PowerAutomateUrlPolicy.canonicalizeToEnforced(
        "https://flow.microsoft.com/en-us/flows/id?v3=true&v3survey=false",
      ),
    ).toBeNull();
  });
});

describe("PowerAutomateUrlPolicy (show survey, enforced v3=true)", () => {
  beforeEach(() => {
    PowerAutomateUrlPolicy.configure({ preference: "true", v3surveyEnabled: true });
  });

  it("does not add v3survey when absent even if v3 is correct (show)", () => {
    const nextUrl = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://flow.microsoft.com/en-us/flows/id?v3=true",
    );
    expect(nextUrl).toBeNull();
  });

  it("normalizes v3survey to true when present (show)", () => {
    const nextUrl = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://flow.microsoft.com/en-us/flows/id?v3=true&v3survey=false",
    );
    expect(nextUrl).toBeTruthy();
    expect(new URL(nextUrl!).searchParams.get("v3survey")).toBe("true");
  });

  it("fixes wrong v3 without adding v3survey when survey key was absent (show)", () => {
    const nextUrl = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://flow.microsoft.com/en-us/flows/id?v3=false",
    );
    expect(nextUrl).toBeTruthy();
    const parsed = new URL(nextUrl!);
    expect(parsed.searchParams.get("v3")).toBe("true");
    expect(parsed.searchParams.has("v3survey")).toBe(false);
  });
});

describe("PowerAutomateUrlPolicy edges (v3=false, hide survey)", () => {
  beforeEach(() => {
    PowerAutomateUrlPolicy.configure({ preference: "false", v3surveyEnabled: false });
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
    expect(new URL(next!).searchParams.get("v3survey")).toBe("false");
  });

  it("hide mode collapses duplicate v3survey keys to a single v3survey=false", () => {
    const next = PowerAutomateUrlPolicy.canonicalizeToEnforced(
      "https://flow.microsoft.com/en-us/flows/x?v3=true&v3survey=false&v3Survey=true",
    );
    expect(next).toBeTruthy();
    const parsed = new URL(next!);
    expect(parsed.searchParams.get("v3")).toBe("false");
    expect(parsed.searchParams.get("v3survey")).toBe("false");
  });
});
