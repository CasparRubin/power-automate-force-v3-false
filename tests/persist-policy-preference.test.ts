import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { reloadMock } = vi.hoisted(() => ({
  reloadMock: vi.fn(),
}));

vi.mock("../src/popup/reload-focused-target-tab", () => ({
  reloadFocusedTargetTabIfApplicable: (...args: unknown[]) => reloadMock(...args),
}));

vi.mock("../src/popup/policy-popup-log", () => ({
  policyPopupLog: vi.fn(),
}));

import { STORAGE_KEY_ENFORCED_V3, STORAGE_KEY_V3SURVEY_ENABLED } from "../src/constants";
import { persistPolicyPreferenceAndOptionalReload } from "../src/popup/persist-policy-preference";

type PersistArgs = Parameters<typeof persistPolicyPreferenceAndOptionalReload>[0];

describe("persistPolicyPreferenceAndOptionalReload", () => {
  const mountedRef = { current: true };
  let syncSet: ReturnType<typeof vi.fn>;
  let setStatus: ReturnType<typeof vi.fn>;
  let setReloadBusy: ReturnType<typeof vi.fn>;
  let beginSyncWrite: ReturnType<typeof vi.fn>;
  let endSyncWrite: ReturnType<typeof vi.fn>;
  let clearPendingStatusDismiss: ReturnType<typeof vi.fn>;
  let resync: ReturnType<typeof vi.fn>;
  let scheduleClear: ReturnType<typeof vi.fn>;
  let onResyncHardFailure: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mountedRef.current = true;
    syncSet = vi.fn().mockResolvedValue(undefined);
    setStatus = vi.fn();
    setReloadBusy = vi.fn();
    beginSyncWrite = vi.fn();
    endSyncWrite = vi.fn();
    clearPendingStatusDismiss = vi.fn();
    resync = vi.fn().mockResolvedValue(undefined);
    scheduleClear = vi.fn();
    onResyncHardFailure = vi.fn();
    reloadMock.mockReset();
    reloadMock.mockResolvedValue(false);
    vi.stubGlobal("chrome", {
      storage: { sync: { set: syncSet } },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("persists sync patch and skips reload when reload preference is off", async () => {
    await persistPolicyPreferenceAndOptionalReload({
      storagePatch: { [STORAGE_KEY_ENFORCED_V3]: "off" },
      logLabel: "enforcedV3",
      getReloadPreference: () => "off",
      mountedRef,
      beginSyncWrite,
      endSyncWrite,
      clearPendingStatusDismiss,
      setStatus,
      setIsTargetTabReloadBusy: setReloadBusy,
      resyncFromStorage: resync,
      scheduleStatusClear: scheduleClear,
      onResyncHardFailure,
    } as PersistArgs);

    expect(syncSet).toHaveBeenCalledWith({ [STORAGE_KEY_ENFORCED_V3]: "off" });
    expect(reloadMock).not.toHaveBeenCalled();
    expect(setReloadBusy).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith("Saved.");
    expect(scheduleClear).toHaveBeenCalledWith(2000);
  });

  it("reloads when enforcement is on", async () => {
    reloadMock.mockResolvedValue(true);

    await persistPolicyPreferenceAndOptionalReload({
      storagePatch: { [STORAGE_KEY_ENFORCED_V3]: "true" },
      logLabel: "enforcedV3",
      getReloadPreference: () => "true",
      mountedRef,
      beginSyncWrite,
      endSyncWrite,
      clearPendingStatusDismiss,
      setStatus,
      setIsTargetTabReloadBusy: setReloadBusy,
      resyncFromStorage: resync,
      scheduleStatusClear: scheduleClear,
      onResyncHardFailure,
    } as PersistArgs);

    expect(reloadMock).toHaveBeenCalledWith("true");
    expect(setReloadBusy).toHaveBeenCalledWith(true);
    expect(setReloadBusy).toHaveBeenCalledWith(false);
    expect(scheduleClear).toHaveBeenCalledWith(3800);
  });

  it("calls getReloadPreference only after storage succeeds", async () => {
    const getReload = vi.fn().mockReturnValue("false" as const);

    await persistPolicyPreferenceAndOptionalReload({
      storagePatch: { foo: "bar" },
      logLabel: "test",
      getReloadPreference: getReload,
      mountedRef,
      beginSyncWrite,
      endSyncWrite,
      clearPendingStatusDismiss,
      setStatus,
      setIsTargetTabReloadBusy: setReloadBusy,
      resyncFromStorage: resync,
      scheduleStatusClear: scheduleClear,
      onResyncHardFailure,
    } as PersistArgs);

    expect(getReload).toHaveBeenCalledTimes(1);
    expect(syncSet.mock.invocationCallOrder[0]).toBeLessThan(getReload.mock.invocationCallOrder[0]);
  });

  it("on storage failure, resyncs and schedules clear without reload", async () => {
    syncSet.mockRejectedValue(new Error("sync down"));

    await persistPolicyPreferenceAndOptionalReload({
      storagePatch: { [STORAGE_KEY_ENFORCED_V3]: "true" },
      logLabel: "enforcedV3",
      getReloadPreference: () => "true",
      mountedRef,
      beginSyncWrite,
      endSyncWrite,
      clearPendingStatusDismiss,
      setStatus,
      setIsTargetTabReloadBusy: setReloadBusy,
      resyncFromStorage: resync,
      scheduleStatusClear: scheduleClear,
      onResyncHardFailure,
    } as PersistArgs);

    expect(resync).toHaveBeenCalled();
    expect(reloadMock).not.toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith("sync down");
    expect(scheduleClear).toHaveBeenCalledWith(2000);
  });

  it("persists v3surveyEnabled patch (survey tab sync key)", async () => {
    await persistPolicyPreferenceAndOptionalReload({
      storagePatch: { [STORAGE_KEY_V3SURVEY_ENABLED]: "true" },
      logLabel: "v3survey",
      getReloadPreference: () => "off",
      mountedRef,
      beginSyncWrite,
      endSyncWrite,
      clearPendingStatusDismiss,
      setStatus,
      setIsTargetTabReloadBusy: setReloadBusy,
      resyncFromStorage: resync,
      scheduleStatusClear: scheduleClear,
      onResyncHardFailure,
    } as PersistArgs);

    expect(syncSet).toHaveBeenCalledWith({ [STORAGE_KEY_V3SURVEY_ENABLED]: "true" });
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it("on storage failure, skips resync when already unmounted", async () => {
    syncSet.mockRejectedValue(new Error("sync down"));
    mountedRef.current = false;

    await persistPolicyPreferenceAndOptionalReload({
      storagePatch: { [STORAGE_KEY_ENFORCED_V3]: "true" },
      logLabel: "enforcedV3",
      getReloadPreference: () => "true",
      mountedRef,
      beginSyncWrite,
      endSyncWrite,
      clearPendingStatusDismiss,
      setStatus,
      setIsTargetTabReloadBusy: setReloadBusy,
      resyncFromStorage: resync,
      scheduleStatusClear: scheduleClear,
      onResyncHardFailure,
    } as PersistArgs);

    expect(resync).not.toHaveBeenCalled();
    expect(reloadMock).not.toHaveBeenCalled();
    expect(scheduleClear).not.toHaveBeenCalled();
  });

  it("on storage failure, invokes onResyncHardFailure when resync throws", async () => {
    syncSet.mockRejectedValue(new Error("sync down"));
    resync.mockRejectedValue(new Error("resync failed"));

    await persistPolicyPreferenceAndOptionalReload({
      storagePatch: { [STORAGE_KEY_ENFORCED_V3]: "true" },
      logLabel: "enforcedV3",
      getReloadPreference: () => "true",
      mountedRef,
      beginSyncWrite,
      endSyncWrite,
      clearPendingStatusDismiss,
      setStatus,
      setIsTargetTabReloadBusy: setReloadBusy,
      resyncFromStorage: resync,
      scheduleStatusClear: scheduleClear,
      onResyncHardFailure,
    } as PersistArgs);

    expect(onResyncHardFailure).toHaveBeenCalledTimes(1);
    expect(setStatus).toHaveBeenCalledWith("sync down");
    expect(scheduleClear).toHaveBeenCalledWith(2000);
  });
});
