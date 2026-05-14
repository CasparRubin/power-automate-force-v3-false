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

  it("is true when v3surveyEnabled (Survey tab preference) changes alone", () => {
    expect(
      isEnforcerSyncChange("sync", {
        [STORAGE_KEY_V3SURVEY_ENABLED]: { oldValue: "false", newValue: "true" },
      }),
    ).toBe(true);
  });

  it("is true when both policy keys appear in one sync change payload", () => {
    expect(
      isEnforcerSyncChange("sync", {
        [STORAGE_KEY_ENFORCED_V3]: { oldValue: "false", newValue: "true" },
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

  it("is false for an empty sync change object", () => {
    expect(isEnforcerSyncChange("sync", {})).toBe(false);
  });

  it("is true when a policy key is present on a null-prototype changes object", () => {
    const changes = Object.create(null) as Record<string, unknown>;
    changes[STORAGE_KEY_ENFORCED_V3] = { oldValue: "false", newValue: "true" };
    expect(isEnforcerSyncChange("sync", changes)).toBe(true);
  });
});
