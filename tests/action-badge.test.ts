import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyToolbarBadgeForEnforcement,
  enforcementPreferenceToToolbarBadge,
} from "../src/action-badge";

describe("enforcementPreferenceToToolbarBadge", () => {
  it("returns null for off (enforcement paused)", () => {
    expect(enforcementPreferenceToToolbarBadge("off")).toBeNull();
  });

  it("returns C and a background color for classic (v3=false)", () => {
    const spec = enforcementPreferenceToToolbarBadge("false");
    expect(spec).not.toBeNull();
    expect(spec!.text).toBe("C");
    expect(spec!.backgroundColor).toEqual([110, 85, 60, 255]);
  });

  it("returns N and a background color for new designer (v3=true)", () => {
    const spec = enforcementPreferenceToToolbarBadge("true");
    expect(spec).not.toBeNull();
    expect(spec!.text).toBe("N");
    expect(spec!.backgroundColor).toEqual([26, 115, 232, 255]);
  });

  it("returns stable classic vs new objects (identity) for repeated calls", () => {
    expect(enforcementPreferenceToToolbarBadge("false")).toBe(
      enforcementPreferenceToToolbarBadge("false"),
    );
    expect(enforcementPreferenceToToolbarBadge("true")).toBe(
      enforcementPreferenceToToolbarBadge("true"),
    );
  });
});

describe("applyToolbarBadgeForEnforcement", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clears badge text when preference is off", () => {
    const setBadgeText = vi.fn();
    const setBadgeBackgroundColor = vi.fn();
    vi.stubGlobal("chrome", {
      action: { setBadgeText, setBadgeBackgroundColor },
    } as unknown as typeof chrome);
    applyToolbarBadgeForEnforcement("off");
    expect(setBadgeText).toHaveBeenCalledWith({ text: "" });
    expect(setBadgeBackgroundColor).not.toHaveBeenCalled();
  });

  it.each(["false", "true"] as const)("sets text then background color for %s", (preference) => {
    const setBadgeText = vi.fn();
    const setBadgeBackgroundColor = vi.fn();
    vi.stubGlobal("chrome", {
      action: { setBadgeText, setBadgeBackgroundColor },
    } as unknown as typeof chrome);
    applyToolbarBadgeForEnforcement(preference);
    const spec = enforcementPreferenceToToolbarBadge(preference)!;
    expect(setBadgeText).toHaveBeenCalledWith({ text: spec.text });
    expect(setBadgeBackgroundColor).toHaveBeenCalledWith({ color: spec.backgroundColor });
    expect(setBadgeText.mock.invocationCallOrder[0]).toBeLessThan(
      setBadgeBackgroundColor.mock.invocationCallOrder[0]!,
    );
  });
});
