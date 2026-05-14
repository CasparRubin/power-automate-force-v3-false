import {
  DNR_RULESET_CLASSIC_EDITOR_ID,
  DNR_RULESET_NEW_DESIGNER_ID,
  type EnforcementPreference,
} from "./constants";

/** Options for `chrome.declarativeNetRequest.updateEnabledRulesets` (one ruleset on for `true`/`false`, both off for `"off"`). */
export function buildUpdateRulesetOptions(mode: EnforcementPreference): {
  enableRulesetIds: string[];
  disableRulesetIds: string[];
} {
  if (mode === "off") {
    return {
      enableRulesetIds: [],
      disableRulesetIds: [DNR_RULESET_CLASSIC_EDITOR_ID, DNR_RULESET_NEW_DESIGNER_ID],
    };
  }
  const useTrue = mode === "true";
  return {
    enableRulesetIds: useTrue ? [DNR_RULESET_NEW_DESIGNER_ID] : [DNR_RULESET_CLASSIC_EDITOR_ID],
    disableRulesetIds: useTrue ? [DNR_RULESET_CLASSIC_EDITOR_ID] : [DNR_RULESET_NEW_DESIGNER_ID],
  };
}
