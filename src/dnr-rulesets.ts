import { RULESET_V3_FALSE_ID, RULESET_V3_TRUE_ID, type EnforcedV3 } from "./constants";

/** Options passed to `chrome.declarativeNetRequest.updateEnabledRulesets`. */
export function buildUpdateRulesetOptions(mode: EnforcedV3): {
  enableRulesetIds: string[];
  disableRulesetIds: string[];
} {
  const useTrue = mode === "true";
  return {
    enableRulesetIds: useTrue ? [RULESET_V3_TRUE_ID] : [RULESET_V3_FALSE_ID],
    disableRulesetIds: useTrue ? [RULESET_V3_FALSE_ID] : [RULESET_V3_TRUE_ID],
  };
}
