import { afterEach, describe, expect, it, vi } from "vitest";
import { reloadFocusedTargetTabIfApplicable } from "../src/popup/reload-focused-target-tab";

const FLOW_TAB_URL = "https://emea.powerautomate.com/environments/foo/flows/bar/details?v3=false";

function chromeTabsStub(
  queryResult: Array<{ id?: number; url?: string }>,
  reload: ReturnType<typeof vi.fn>,
): { tabs: { query: ReturnType<typeof vi.fn>; reload: ReturnType<typeof vi.fn> } } {
  return {
    tabs: {
      query: vi.fn().mockResolvedValue(queryResult),
      reload,
    },
  };
}

describe("reloadFocusedTargetTabIfApplicable", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not query tabs when preference is off", async () => {
    const chromeMock = chromeTabsStub([], vi.fn());
    vi.stubGlobal("chrome", chromeMock as unknown as typeof chrome);
    await expect(reloadFocusedTargetTabIfApplicable("off")).resolves.toBe(false);
    expect(chromeMock.tabs.query).not.toHaveBeenCalled();
  });

  it.each(["true", "false"] as const)(
    "queries last-focused window and reloads when preference is %s (enforcement on)",
    async (preference) => {
      const reload = vi.fn().mockResolvedValue(undefined);
      const chromeMock = chromeTabsStub([{ id: 7, url: FLOW_TAB_URL }], reload);
      vi.stubGlobal("chrome", chromeMock as unknown as typeof chrome);
      await expect(reloadFocusedTargetTabIfApplicable(preference)).resolves.toBe(true);
      expect(chromeMock.tabs.query).toHaveBeenCalledTimes(1);
      expect(chromeMock.tabs.query).toHaveBeenCalledWith({
        active: true,
        lastFocusedWindow: true,
      });
      expect(reload).toHaveBeenCalledWith(7);
    },
  );

  it("does not reload when query returns no tabs", async () => {
    const reload = vi.fn();
    const chromeMock = chromeTabsStub([], reload);
    vi.stubGlobal("chrome", chromeMock as unknown as typeof chrome);
    await expect(reloadFocusedTargetTabIfApplicable("false")).resolves.toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not reload when active tab has no id", async () => {
    const reload = vi.fn();
    const chromeMock = chromeTabsStub([{ url: FLOW_TAB_URL }], reload);
    vi.stubGlobal("chrome", chromeMock as unknown as typeof chrome);
    await expect(reloadFocusedTargetTabIfApplicable("false")).resolves.toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not reload when the active tab has no url", async () => {
    const reload = vi.fn();
    const chromeMock = chromeTabsStub([{ id: 1 }], reload);
    vi.stubGlobal("chrome", chromeMock as unknown as typeof chrome);
    await expect(reloadFocusedTargetTabIfApplicable("false")).resolves.toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not reload when url is not a flow/run target", async () => {
    const reload = vi.fn();
    const chromeMock = chromeTabsStub(
      [{ id: 2, url: "https://emea.powerautomate.com/environments/foo/home" }],
      reload,
    );
    vi.stubGlobal("chrome", chromeMock as unknown as typeof chrome);
    await expect(reloadFocusedTargetTabIfApplicable("false")).resolves.toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads when active tab is a /runs/ target URL", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    const runUrl = "https://emea.powerautomate.com/environments/foo/runs/run-1?v3=false";
    const chromeMock = chromeTabsStub([{ id: 9, url: runUrl }], reload);
    vi.stubGlobal("chrome", chromeMock as unknown as typeof chrome);
    await expect(reloadFocusedTargetTabIfApplicable("false")).resolves.toBe(true);
    expect(reload).toHaveBeenCalledWith(9);
  });

  it("resolves false when reload rejects (e.g. tab closed)", async () => {
    const reload = vi.fn().mockRejectedValue(new Error("no tab"));
    const chromeMock = chromeTabsStub([{ id: 3, url: FLOW_TAB_URL }], reload);
    vi.stubGlobal("chrome", chromeMock as unknown as typeof chrome);
    await expect(reloadFocusedTargetTabIfApplicable("true")).resolves.toBe(false);
  });

  it("rejects when tabs.query rejects (unexpected Chrome failure)", async () => {
    const query = vi.fn().mockRejectedValue(new Error("query failed"));
    const chromeMock = {
      tabs: {
        query,
        reload: vi.fn(),
      },
    };
    vi.stubGlobal("chrome", chromeMock as unknown as typeof chrome);
    await expect(reloadFocusedTargetTabIfApplicable("false")).rejects.toThrow("query failed");
  });
});
