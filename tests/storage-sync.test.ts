import { describe, expect, it } from "vitest";
import { STORAGE_KEY_ENFORCED_V3 } from "../src/constants";
import { isEnforcedV3SyncChange } from "../src/storage-sync";

describe("isEnforcedV3SyncChange", () => {
  it("is true only for sync namespace and our storage key", () => {
    expect(
      isEnforcedV3SyncChange(
        "sync",
        { [STORAGE_KEY_ENFORCED_V3]: { oldValue: "false", newValue: "true" } },
        STORAGE_KEY_ENFORCED_V3,
      ),
    ).toBe(true);
  });

  it("is false for local namespace", () => {
    expect(
      isEnforcedV3SyncChange(
        "local",
        { [STORAGE_KEY_ENFORCED_V3]: { oldValue: "false", newValue: "true" } },
        STORAGE_KEY_ENFORCED_V3,
      ),
    ).toBe(false);
  });

  it("is false when sync event omits our key", () => {
    expect(isEnforcedV3SyncChange("sync", { otherKey: {} }, STORAGE_KEY_ENFORCED_V3)).toBe(false);
  });
});
