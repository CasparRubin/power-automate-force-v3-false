import { describe, expect, it } from "vitest";
import {
  DEVELOPER_NAME,
  DEVELOPER_URL,
  EXTENSION_DISPLAY_NAME,
  SOURCE_REPO_URL,
} from "../src/popup/about-meta";

describe("about-meta", () => {
  it("exposes stable public links and display name", () => {
    expect(DEVELOPER_URL).toMatch(/^https:\/\//);
    expect(SOURCE_REPO_URL).toMatch(/^https:\/\/github\.com\//);
    expect(DEVELOPER_NAME.length).toBeGreaterThan(0);
  });

  it("keeps official extension title and source repo URL in sync with shipped constants", () => {
    expect(EXTENSION_DISPLAY_NAME).toBe("Power Automate Editor Version Enforcer");
    expect(SOURCE_REPO_URL).toBe(
      "https://github.com/CasparRubin/power-automate-editor-version-enforcer",
    );
  });
});
