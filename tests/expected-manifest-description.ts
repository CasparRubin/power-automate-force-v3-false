/**
 * Expected `description` in `public/manifest.json` (Edge/Chrome installed-extensions blurb).
 * Keep identical to `POWER_AUTOMATE_EDITOR_ENFORCER_PUBLIC_SUMMARY` in the Helvety monorepo
 * (`packages/shared/src/power-automate-editor-enforcer-copy.ts`).
 *
 * Note: this line is long on purpose; some store dashboards suggest a shorter listing field than
 * the shipped manifest uses—use a shorter dashboard description if required, but keep this file
 * and the manifest in sync with the Helvety constant for the actual package.
 */
export const EXPECTED_MANIFEST_DESCRIPTION =
  "Allows you to enforce either the Classic or New Designer experience in Microsoft Power Automate Cloud Flows using v3=false or v3=true, while also giving you the option to hide the Microsoft survey prompt asking why you made your selection." as const;
