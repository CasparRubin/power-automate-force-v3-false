import { describe, expect, it } from "vitest";
import { RULESET_V3_FALSE_ID, RULESET_V3_TRUE_ID } from "../src/constants";
import { buildUpdateRulesetOptions } from "../src/dnr-rulesets";

describe("buildUpdateRulesetOptions", () => {
  it("enables false ruleset and disables true when mode is false", () => {
    const opts = buildUpdateRulesetOptions("false");
    expect(opts.enableRulesetIds).toEqual([RULESET_V3_FALSE_ID]);
    expect(opts.disableRulesetIds).toEqual([RULESET_V3_TRUE_ID]);
  });

  it("enables true ruleset and disables false when mode is true", () => {
    const opts = buildUpdateRulesetOptions("true");
    expect(opts.enableRulesetIds).toEqual([RULESET_V3_TRUE_ID]);
    expect(opts.disableRulesetIds).toEqual([RULESET_V3_FALSE_ID]);
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
