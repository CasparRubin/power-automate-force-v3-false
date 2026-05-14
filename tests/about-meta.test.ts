import { describe, expect, it } from "vitest";
import { DEVELOPER_NAME, DEVELOPER_URL, SOURCE_REPO_URL } from "../src/popup/about-meta";

describe("about-meta", () => {
  it("exposes stable public links and display name", () => {
    expect(DEVELOPER_URL).toMatch(/^https:\/\//);
    expect(SOURCE_REPO_URL).toMatch(/^https:\/\/github\.com\//);
    expect(DEVELOPER_NAME.length).toBeGreaterThan(0);
  });
});
