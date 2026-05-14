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
    await reloadFocusedTargetTabIfApplicable("off");
    expect(chromeMock.tabs.query).not.toHaveBeenCalled();
  });

  it("queries last-focused window and reloads when preference is classic or new designer", async () => {
    const reload = vi.fn().mockResolvedValue(undefined);
    const chromeMock = chromeTabsStub([{ id: 7, url: FLOW_TAB_URL }], reload);
    vi.stubGlobal("chrome", chromeMock as unknown as typeof chrome);
    await reloadFocusedTargetTabIfApplicable("true");
    expect(chromeMock.tabs.query).toHaveBeenCalledTimes(1);
    expect(chromeMock.tabs.query).toHaveBeenCalledWith({
      active: true,
      lastFocusedWindow: true,
    });
    expect(reload).toHaveBeenCalledWith(7);
  });

  it("does not reload when the active tab has no url", async () => {
    const reload = vi.fn();
    const chromeMock = chromeTabsStub([{ id: 1 }], reload);
    vi.stubGlobal("chrome", chromeMock as unknown as typeof chrome);
    await reloadFocusedTargetTabIfApplicable("false");
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not reload when url is not a flow/run target", async () => {
    const reload = vi.fn();
    const chromeMock = chromeTabsStub(
      [{ id: 2, url: "https://emea.powerautomate.com/environments/foo/home" }],
      reload,
    );
    vi.stubGlobal("chrome", chromeMock as unknown as typeof chrome);
    await reloadFocusedTargetTabIfApplicable("false");
    expect(reload).not.toHaveBeenCalled();
  });

  it("resolves when reload rejects (e.g. tab closed)", async () => {
    const reload = vi.fn().mockRejectedValue(new Error("no tab"));
    const chromeMock = chromeTabsStub([{ id: 3, url: FLOW_TAB_URL }], reload);
    vi.stubGlobal("chrome", chromeMock as unknown as typeof chrome);
    await expect(reloadFocusedTargetTabIfApplicable("true")).resolves.toBeUndefined();
  });
});
