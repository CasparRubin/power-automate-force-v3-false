import {
  DNR_RULESET_CLASSIC_EDITOR_ID,
  DNR_RULESET_NEW_DESIGNER_ID,
  type EnforcedV3,
} from "./constants";

/** Options passed to `chrome.declarativeNetRequest.updateEnabledRulesets`. */
export function buildUpdateRulesetOptions(mode: EnforcedV3): {
  enableRulesetIds: string[];
  disableRulesetIds: string[];
} {
  const useTrue = mode === "true";
  return {
    enableRulesetIds: useTrue ? [DNR_RULESET_NEW_DESIGNER_ID] : [DNR_RULESET_CLASSIC_EDITOR_ID],
    disableRulesetIds: useTrue ? [DNR_RULESET_CLASSIC_EDITOR_ID] : [DNR_RULESET_NEW_DESIGNER_ID],
  };
}
