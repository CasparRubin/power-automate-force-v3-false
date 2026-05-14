import { describe, expect, it } from "vitest";
import { isMainFrameTabNavigation } from "../src/navigation-guards";

describe("isMainFrameTabNavigation", () => {
  it("accepts main frame with numeric tab id", () => {
    expect(isMainFrameTabNavigation({ frameId: 0, tabId: 42 })).toBe(true);
  });

  it("rejects subframes", () => {
    expect(isMainFrameTabNavigation({ frameId: 1, tabId: 42 })).toBe(false);
  });

  it("rejects undefined frame id (not main frame)", () => {
    expect(isMainFrameTabNavigation({ tabId: 42 })).toBe(false);
  });

  it("rejects missing or non-numeric tab id", () => {
    expect(isMainFrameTabNavigation({ frameId: 0 })).toBe(false);
    expect(isMainFrameTabNavigation({ frameId: 0, tabId: undefined })).toBe(false);
    expect(isMainFrameTabNavigation({ frameId: 0, tabId: NaN })).toBe(false);
  });

  it("rejects string tab id (Chrome always supplies a number)", () => {
    expect(isMainFrameTabNavigation({ frameId: 0, tabId: "1" as unknown as number })).toBe(false);
  });
});
