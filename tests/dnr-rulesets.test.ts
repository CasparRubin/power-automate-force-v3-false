import { describe, expect, it } from "vitest";
import { DNR_RULESET_CLASSIC_EDITOR_ID, DNR_RULESET_NEW_DESIGNER_ID } from "../src/constants";
import { buildUpdateRulesetOptions } from "../src/dnr-rulesets";

describe("buildUpdateRulesetOptions", () => {
  it("enables classic-editor ruleset and disables new-designer when mode is false", () => {
    const opts = buildUpdateRulesetOptions("false");
    expect(opts.enableRulesetIds).toEqual([DNR_RULESET_CLASSIC_EDITOR_ID]);
    expect(opts.disableRulesetIds).toEqual([DNR_RULESET_NEW_DESIGNER_ID]);
  });

  it("enables new-designer ruleset and disables classic-editor when mode is true", () => {
    const opts = buildUpdateRulesetOptions("true");
    expect(opts.enableRulesetIds).toEqual([DNR_RULESET_NEW_DESIGNER_ID]);
    expect(opts.disableRulesetIds).toEqual([DNR_RULESET_CLASSIC_EDITOR_ID]);
  });

  it("never enables both rulesets", () => {
    for (const mode of ["true", "false"] as const) {
      const { enableRulesetIds, disableRulesetIds } = buildUpdateRulesetOptions(mode);
      expect(enableRulesetIds).toHaveLength(1);
      expect(disableRulesetIds).toHaveLength(1);
      expect(enableRulesetIds[0]).not.toBe(disableRulesetIds[0]);
    }
  });
});
