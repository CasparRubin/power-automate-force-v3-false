import type { EnforcementPreference } from "../constants";
import { policyPopupLog } from "./policy-popup-log";
import { reloadFocusedTargetTabIfApplicable } from "./reload-focused-target-tab";

export type PersistPolicyMountRef = { current: boolean };

/**
 * Writes policy keys to `chrome.storage.sync`, then optionally reloads the focused flow/run tab.
 * Used by the popup for editor (`enforcedV3`) and survey (`v3surveyEnabled`) saves — keeps one
 * implementation for status, busy flags, logging, and error handling.
 */
export async function persistPolicyPreferenceAndOptionalReload(options: {
  storagePatch: Record<string, string>;
  logLabel: string;
  /** Called after a successful sync write, so survey saves see up-to-date editor mode from refs. */
  getReloadPreference: () => EnforcementPreference;
  mountedRef: PersistPolicyMountRef;
  beginSyncWrite: () => void;
  endSyncWrite: () => void;
  clearPendingStatusDismiss: () => void;
  setStatus: (message: string) => void;
  setIsTargetTabReloadBusy: (busy: boolean) => void;
  resyncFromStorage: () => Promise<void>;
  scheduleStatusClear: (clearAfterMs: number) => void;
  onResyncHardFailure: () => void;
}): Promise<void> {
  const {
    storagePatch,
    logLabel,
    getReloadPreference,
    mountedRef,
    beginSyncWrite,
    endSyncWrite,
    clearPendingStatusDismiss,
    setStatus,
    setIsTargetTabReloadBusy,
    resyncFromStorage,
    scheduleStatusClear,
    onResyncHardFailure,
  } = options;

  const t0 = performance.now();
  policyPopupLog(`${logLabel} save: job start`, { keys: Object.keys(storagePatch) });

  clearPendingStatusDismiss();
  beginSyncWrite();
  setStatus("Saving preference…");
  let statusAutoDismissMs = 2000;
  let storageOk = false;
  try {
    await chrome.storage.sync.set(storagePatch);
    storageOk = true;
    policyPopupLog(`${logLabel} save: storage.sync.set ok`, {
      ms: Math.round(performance.now() - t0),
    });
  } catch (error: unknown) {
    policyPopupLog(`${logLabel} save: storage.sync.set failed`, {
      error: error instanceof Error ? error.message : String(error),
    });
    if (!mountedRef.current) {
      return;
    }
    statusAutoDismissMs = 2000;
    try {
      await resyncFromStorage();
    } catch {
      if (mountedRef.current) {
        onResyncHardFailure();
      }
    }
    const message =
      error instanceof Error
        ? error.message
        : "Save failed. Check Chrome sync sign-in, then try again.";
    if (mountedRef.current) {
      setStatus(message);
    }
  } finally {
    endSyncWrite();
    policyPopupLog(`${logLabel} save: persist barrier cleared`, {
      storageOk,
      ms: Math.round(performance.now() - t0),
    });
  }

  if (!mountedRef.current) {
    return;
  }

  if (!storageOk) {
    scheduleStatusClear(statusAutoDismissMs);
    return;
  }

  const reloadPreference = getReloadPreference();
  let tabReloaded = false;
  if (reloadPreference !== "off") {
    setStatus("Refreshing open Power Automate tab…");
    setIsTargetTabReloadBusy(true);
    try {
      tabReloaded = await reloadFocusedTargetTabIfApplicable(reloadPreference);
    } finally {
      if (mountedRef.current) {
        setIsTargetTabReloadBusy(false);
      }
    }
  }

  if (!mountedRef.current) {
    return;
  }
  setStatus("Saved.");
  if (tabReloaded) {
    statusAutoDismissMs = 3800;
  }
  scheduleStatusClear(statusAutoDismissMs);
}
