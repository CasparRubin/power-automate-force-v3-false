import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyThemeClassToDocument,
  DEFAULT_THEME_PREFERENCE,
  parseThemePreference,
  prefersDarkFromSystem,
  resolveIsDark,
  subscribePrefersColorScheme,
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
  it("accepts system, light, and dark", () => {
    expect(parseThemePreference("system")).toBe("system");
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
  });

  it("returns default for invalid values", () => {
    expect(parseThemePreference(undefined)).toBe(DEFAULT_THEME_PREFERENCE);
    expect(parseThemePreference("LIGHT")).toBe(DEFAULT_THEME_PREFERENCE);
    expect(parseThemePreference(1)).toBe(DEFAULT_THEME_PREFERENCE);
  });
});

describe("resolveIsDark", () => {
  it("forces dark and light for explicit preferences", () => {
    expect(resolveIsDark("dark")).toBe(true);
    expect(resolveIsDark("light")).toBe(false);
  });
});

describe("resolveIsDark with system preference", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is true when prefers-color-scheme reports dark", () => {
    stubWindowWithMatchMedia(true);
    expect(resolveIsDark("system")).toBe(true);
  });

  it("is false when prefers-color-scheme reports light", () => {
    stubWindowWithMatchMedia(false);
    expect(resolveIsDark("system")).toBe(false);
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

describe("subscribePrefersColorScheme", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("subscribes to change and unsubscribes", () => {
    const listener = vi.fn();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal("window", {
      matchMedia: () => ({
        matches: false,
        media: "(prefers-color-scheme: dark)",
        addEventListener,
        removeEventListener,
      }),
    } as unknown as Window);

    const unsub = subscribePrefersColorScheme(listener);
    expect(addEventListener).toHaveBeenCalledWith("change", listener);
    unsub();
    expect(removeEventListener).toHaveBeenCalledWith("change", listener);
  });

  it("returns no-op unsub when matchMedia throws", () => {
    vi.stubGlobal("window", {
      matchMedia: () => {
        throw new Error("blocked");
      },
    } as unknown as Window);
    const unsub = subscribePrefersColorScheme(vi.fn());
    expect(() => unsub()).not.toThrow();
  });
});
