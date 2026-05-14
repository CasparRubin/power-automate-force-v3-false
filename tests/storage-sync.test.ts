import { describe, expect, it } from "vitest";
import { STORAGE_KEY_ENFORCED_V3, STORAGE_KEY_V3SURVEY_ENABLED } from "../src/constants";
import { isEnforcerSyncChange } from "../src/storage-sync";

describe("isEnforcerSyncChange", () => {
  it("is true when enforcedV3 changes", () => {
    expect(
      isEnforcerSyncChange("sync", {
        [STORAGE_KEY_ENFORCED_V3]: { oldValue: "false", newValue: "true" },
      }),
    ).toBe(true);
  });

  it("is true when enforcedV3 changes to paused (off)", () => {
    expect(
      isEnforcerSyncChange("sync", {
        [STORAGE_KEY_ENFORCED_V3]: { oldValue: "true", newValue: "off" },
      }),
    ).toBe(true);
  });

  it("is true when v3surveyEnabled changes alone", () => {
    expect(
      isEnforcerSyncChange("sync", {
        [STORAGE_KEY_V3SURVEY_ENABLED]: { oldValue: "false", newValue: "true" },
      }),
    ).toBe(true);
  });

  it("is false for local namespace", () => {
    expect(
      isEnforcerSyncChange("local", {
        [STORAGE_KEY_ENFORCED_V3]: { oldValue: "false", newValue: "true" },
      }),
    ).toBe(false);
    expect(
      isEnforcerSyncChange("local", {
        [STORAGE_KEY_V3SURVEY_ENABLED]: { oldValue: "false", newValue: "true" },
      }),
    ).toBe(false);
  });

  it("is false when sync omits both keys", () => {
    expect(isEnforcerSyncChange("sync", { otherKey: {} })).toBe(false);
  });
});
