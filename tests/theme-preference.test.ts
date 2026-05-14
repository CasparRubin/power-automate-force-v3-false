import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyThemeClassToDocument,
  defaultThemeFromSystem,
  parseThemePreference,
  prefersDarkFromSystem,
  resolveIsDark,
  type ThemePreference,
} from "../src/popup/theme-preference";

function stubWindowWithMatchMedia(matches: boolean) {
  vi.stubGlobal("window", {
    matchMedia: (query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? matches : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }),
  } as unknown as Window);
}

describe("parseThemePreference", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes through light and dark", () => {
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
  });

  it("maps system and invalid values via OS preference when dark", () => {
    stubWindowWithMatchMedia(true);
    expect(parseThemePreference("system")).toBe("dark");
    expect(parseThemePreference(undefined)).toBe("dark");
    expect(parseThemePreference("LIGHT")).toBe("dark");
    expect(parseThemePreference(1)).toBe("dark");
  });

  it("maps system and invalid values via OS preference when light", () => {
    stubWindowWithMatchMedia(false);
    expect(parseThemePreference("system")).toBe("light");
    expect(parseThemePreference(undefined)).toBe("light");
  });
});

describe("defaultThemeFromSystem", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("follows prefers-color-scheme", () => {
    stubWindowWithMatchMedia(true);
    expect(defaultThemeFromSystem()).toBe("dark");
    stubWindowWithMatchMedia(false);
    expect(defaultThemeFromSystem()).toBe("light");
  });
});

describe("resolveIsDark", () => {
  it("forces dark and light for explicit preferences", () => {
    expect(resolveIsDark("dark")).toBe(true);
    expect(resolveIsDark("light")).toBe(false);
  });

  it("treats any non-dark runtime string as light (legacy callers)", () => {
    expect(resolveIsDark("system" as unknown as ThemePreference)).toBe(false);
  });
});

describe("prefersDarkFromSystem", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns matchMedia result when available", () => {
    stubWindowWithMatchMedia(true);
    expect(prefersDarkFromSystem()).toBe(true);
    stubWindowWithMatchMedia(false);
    expect(prefersDarkFromSystem()).toBe(false);
  });

  it("returns true when window is undefined", () => {
    vi.stubGlobal("window", undefined as unknown as Window & typeof globalThis);
    expect(prefersDarkFromSystem()).toBe(true);
  });

  it("returns true when matchMedia is not a function", () => {
    vi.stubGlobal("window", { matchMedia: undefined } as unknown as Window);
    expect(prefersDarkFromSystem()).toBe(true);
  });

  it("returns true when matchMedia throws", () => {
    vi.stubGlobal("window", {
      matchMedia: () => {
        throw new Error("blocked");
      },
    } as unknown as Window);
    expect(prefersDarkFromSystem()).toBe(true);
  });
});

describe("applyThemeClassToDocument", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("toggles dark class on documentElement", () => {
    const toggle = vi.fn();
    vi.stubGlobal("document", {
      documentElement: { classList: { toggle } },
    } as unknown as Document);
    applyThemeClassToDocument(true);
    expect(toggle).toHaveBeenCalledWith("dark", true);
    applyThemeClassToDocument(false);
    expect(toggle).toHaveBeenCalledWith("dark", false);
  });
});
