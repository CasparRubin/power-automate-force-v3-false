# Power Automate: editor preference

Chrome/Edge extension (Manifest V3) that **keeps flow and run links opening in the editor you choose** while the extension is active: classic (`v3=false`) or new designer (`v3=true`), even when Microsoft links omit or flip the flag. You can **pause** anytime (extension stays installed; no URL rewrites or DNR rules). **Declarative Net Request** rules only add or replace the **`v3`** query parameter on matching navigations; the **service worker** and **content script** apply the full URL policy from sync, including **`v3survey`** from the popup **Survey** tab (sync key `v3surveyEnabled`). Microsoft sometimes uses **`v3survey`** for an in-product **classic-designer survey** prompt. **Hide** (default, sync `"false"`) sets **`v3survey=false`** on rewrites (adds the param if missing). **Show** (sync `"true"`) normalizes any existing `v3survey` query keys on the URL to a single **`v3survey=true`** and does **not** add the param when it is absent.

**Developer:** [Helvety](https://helvety.com)

## License and legal links

- This repository is licensed under the [MIT License](./LICENSE).
- Warranty and liability disclaimer: this software is provided "AS IS", without warranties or guarantees, and without liability to the maximum extent permitted by law (see `LICENSE`).
- Official legal pages:
  - Privacy Policy: [https://helvety.com/privacy](https://helvety.com/privacy)
  - Terms of Service: [https://helvety.com/terms](https://helvety.com/terms)
  - Impressum / Legal Notice: [https://helvety.com/impressum](https://helvety.com/impressum)
- Chrome Web Store / Edge Add-ons note: set the privacy policy URL in the store listing to `https://helvety.com/privacy`.

## What it does

- Runs on Microsoft Power Automate hosts:
  - `https://*.powerautomate.com/*`
  - `https://flow.microsoft.com/*`
- Only changes URLs whose path contains `/flows/` or `/runs/` (and only while enforcement is **not** paused).
- **Toolbar popup** (React + Tailwind + Radix): choose **Classic Designer**, **New Designer**, or **Paused**. Your choice is stored in `chrome.storage.sync` under `enforcedV3` as `"true"`, `"false"`, or `"off"` and applied in the service worker, content script, and DNR layer. If Chrome sync is off, `chrome.storage.sync` still works for that profile; it behaves like local storage ([Chrome `storage` docs](https://developer.chrome.com/docs/extensions/reference/api/storage/)). **Popup appearance** (About tab: **Light** or **Dark**; first open picks from the OS, then the choice is stored) lives in **`chrome.storage.local`** under `popupThemePreference` so it stays on this device and does not sync across signed-in browsers. Before React, `theme-boot.ts` applies the OS `prefers-color-scheme` to `<html>` only (MV3 extension CSP; no inline script); the popup then applies the saved **Light** / **Dark** from storage.
- **Declarative Net Request** static rulesets only add or replace the **`v3`** query parameter on matching **main_frame** requests (they do not read **`v3surveyEnabled`** from storage and do not change **`v3survey`**).
- The **service worker** and **content script** read `enforcedV3` and `v3surveyEnabled` from sync and run `PowerAutomateUrlPolicy`: they keep **`v3`** aligned with your editor choice. **`v3survey`**: **Hide** (default, sync `"false"`) sets **`v3survey=false`** (adds if missing) on rewrites. **Show** (sync `"true"`) collapses duplicate keys to a single **`v3survey=true`** only when the URL already had `v3survey`; it never adds the param when absent. Sync key: `v3surveyEnabled` (`"true"` / `"false"`).
- Uses semantic URL dedupe to avoid rewrite loops on equivalent `/flows/new` URLs (for example `%20` vs `+` encoding differences).
- **Layered enforcement** (aligned with Chromium MV3 best practices):
  - **Layer 1:** `declarativeNetRequest`: two static rulesets (`dnr-classic-editor.json`, `dnr-new-designer.json`); each rule’s `queryTransform` only sets **`v3`**. When enforcing, **exactly one** ruleset is enabled via `updateEnabledRulesets`; when **paused**, **both** are disabled. After each **extension update**, the service worker reconciles enabled rulesets with storage (Chromium does not persist which static rulesets were enabled across extension updates; the manifest defaults apply until the service worker runs again; see [Declarative Net Request](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)).
  - **Layer 2:** Background `webNavigation` (`onCommitted`, `onHistoryStateUpdated`) runs the full stored URL policy (including **`v3survey`** per **Hide** / **Show**) via `tabs.update` when enforcement is active (same canonicalization as the content script; no-op when paused).
  - **Layer 3:** Content script at `document_start` for SPA transitions (`history.pushState` / `replaceState`, `popstate`, short-lived polling + `MutationObserver`) when enforcement is active, applying the same full policy as Layer 2 (polling/observer are not started while paused).

## Build and load (development)

Source lives under `src/`. The loadable extension is produced in **`dist/`** after a build.

1. Install dependencies and build:

   ```bash
   npm install
   npm run build
   ```

2. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge), enable **Developer mode**, click **Load unpacked**, and select the **`dist`** folder (not the repository root).

3. After changing anything under `src/`, `public/`, or build config, run `npm run build` again before reloading the extension in the browser (the unpacked folder must be **`dist/`**, which is replaced on each full build).

### Scripts

| Command                 | Purpose                                                                                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`         | Clear `dist/`, copy `public/` → `dist/`, bundle `background` + `content` with esbuild, build the React popup with Vite.                                          |
| `npm run watch`         | **Popup only:** Vite watch rebuilds `dist/popup.html` and `dist/popup-assets/*`. After editing the service worker or content script, run a full `npm run build`. |
| `npm run test`          | Run **Vitest** unit tests under `tests/` (Node environment; no browser, no Playwright).                                                                          |
| `npm run typecheck`     | `tsc --noEmit` on the TypeScript project.                                                                                                                        |
| `npm run lint`          | ESLint on the repo (`eslint .`, ignoring `dist/` and `node_modules/`): `src/`, `tests/`, `scripts/`, config files.                                               |
| `npm run lint:fix`      | ESLint with `--fix`.                                                                                                                                             |
| `npm run format`        | Prettier `--write` on the repo (respects `.prettierignore`).                                                                                                     |
| `npm run format:check`  | Prettier `--check` (CI-style).                                                                                                                                   |
| `npm run verify:naming` | Fails if superseded repo slugs, old package name, or old store display title appear in scanned sources (see `scripts/verify-project-naming.mjs`).                |
| `npm run predeploy`     | `verify:naming` → `format:check` → `lint` → `typecheck` → `test` → `build` (run before releases).                                                                |

## Unit tests

Tests run **locally** with [Vitest](https://vitest.dev/) (already a devDependency). They use the **Node** environment (no browser, no Playwright). Suites cover **pure helpers**, **`PowerAutomateUrlPolicy`** (module-level state; tests call `configure({ preference, v3surveyEnabled })` in `beforeEach`), **popup helpers** (theme preference, tab reload with a **stubbed `chrome.tabs`**), and small **manifest drift** checks.

| Suite                                                                                  | What it covers                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`tests/url-policy.test.ts`](./tests/url-policy.test.ts)                               | URL targeting, canonicalization, `v3` / `v3survey` behavior for enforced and **paused** modes, edge cases (hash, duplicates).                                                                                                                                                                 |
| [`tests/constants.test.ts`](./tests/constants.test.ts)                                 | `parseEnforcementPreference`, `parseV3SurveyEnabled`, `needsDefaultEnforcedV3Seed`, `needsDefaultV3SurveyEnabledSeed`, storage keys / defaults, DNR ruleset id strings, and a **manifest drift guard** (MV3 permissions, hosts, `manifest.json`, content/background wiring, DNR JSON, icons). |
| [`tests/dnr-rulesets.test.ts`](./tests/dnr-rulesets.test.ts)                           | `buildUpdateRulesetOptions`: which static ruleset is enabled per **preference** (`true` / `false` / `off`).                                                                                                                                                                                   |
| [`tests/navigation-guards.test.ts`](./tests/navigation-guards.test.ts)                 | `isMainFrameTabNavigation`: main-frame vs subframe filtering.                                                                                                                                                                                                                                 |
| [`tests/storage-sync.test.ts`](./tests/storage-sync.test.ts)                           | `isEnforcerSyncChange`: true when sync `enforcedV3` or `v3surveyEnabled` appears in `chrome.storage.onChanged`.                                                                                                                                                                               |
| [`tests/reload-focused-target-tab.test.ts`](./tests/reload-focused-target-tab.test.ts) | Stubbed `chrome.tabs.query` / `reload`: last-focused window, skip when paused or URL not a flow/run target (used after editor and Survey-tab saves).                                                                                                                                          |
| [`tests/theme-preference.test.ts`](./tests/theme-preference.test.ts)                   | `parseThemePreference`, `defaultThemeFromSystem`, `resolveIsDark`, `prefersDarkFromSystem`, `applyThemeClassToDocument`, `subscribePrefersColorScheme`.                                                                                                                                       |
| [`tests/utils.test.ts`](./tests/utils.test.ts)                                         | `cn()` (clsx + tailwind-merge) used by popup components.                                                                                                                                                                                                                                      |
| [`tests/about-meta.test.ts`](./tests/about-meta.test.ts)                               | Stable public URLs / display name for the About tab.                                                                                                                                                                                                                                          |

**Service worker and content** still call Chromium extension APIs at runtime; unit tests target **pure helpers**, **URL policy**, and **small chrome-stubbed flows** so we do not need Playwright or a headed browser for CI.

## Repository layout

| Path                                                                                                                                    | Purpose                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`public/manifest.json`](./public/manifest.json)                                                                                        | MV3 manifest copied into `dist/` on build.                                                                                                                                                                                                                                                                 |
| [`public/dnr-classic-editor.json`](./public/dnr-classic-editor.json) / [`public/dnr-new-designer.json`](./public/dnr-new-designer.json) | Declarative Net Request static rulesets: when enforcing, **one** is enabled (classic → `v3=false`, new-designer → `v3=true`); when **paused**, **neither** is enabled.                                                                                                                                     |
| [`public/icons/`](./public/icons/)                                                                                                      | PNG icons referenced by the manifest (kept outside Vite’s `popup-assets` output so the popup build does not overwrite them). The repo’s [`assets/`](./assets/) folder may contain extra artwork for store listings; it is **not** copied into `dist` by default.                                           |
| [`src/constants.ts`](./src/constants.ts)                                                                                                | Storage keys (`SYNC_POLICY_KEYS`, `STORAGE_KEY_POPUP_THEME`), ruleset ids, parsers (`parseEnforcementPreference`, `parseV3SurveyEnabled`), install seed helpers (`needsDefaultEnforcedV3Seed`, `needsDefaultV3SurveyEnabledSeed`), defaults.                                                               |
| [`src/url-policy.ts`](./src/url-policy.ts)                                                                                              | Shared URL targeting and canonicalization (`PowerAutomateUrlPolicy.configure`, `canonicalizeToEnforced`, paused mode, `v3survey` **Hide** / **Show** from sync `v3surveyEnabled`, …).                                                                                                                      |
| [`src/dnr-rulesets.ts`](./src/dnr-rulesets.ts)                                                                                          | Pure mapping from enforcement **preference** → DNR `updateEnabledRulesets` options.                                                                                                                                                                                                                        |
| [`src/navigation-guards.ts`](./src/navigation-guards.ts)                                                                                | Pure main-frame navigation check used by the service worker.                                                                                                                                                                                                                                               |
| [`src/storage-sync.ts`](./src/storage-sync.ts)                                                                                          | `isEnforcerSyncChange`: true when sync `enforcedV3` or `v3surveyEnabled` appears in `chrome.storage.onChanged`.                                                                                                                                                                                            |
| [`src/background.ts`](./src/background.ts)                                                                                              | Service worker: DNR ruleset toggling, `PowerAutomateUrlPolicy` from sync, storage listeners, `webNavigation` + `tabs.update` URL enforcement (full policy including **`v3survey`** per Survey tab; skipped when paused).                                                                                   |
| [`src/content.ts`](./src/content.ts)                                                                                                    | In-page SPA URL enforcement when not paused; assigns `globalThis.PowerAutomateUrlPolicy` for optional DevTools inspection (separate module instance from the service worker, same policy logic).                                                                                                           |
| [`src/popup/`](./src/popup/)                                                                                                            | React popup: Editor / Survey / About tabs; sync-backed enforcement and Survey (`v3surveyEnabled`); **local-only** theme (`theme-preference.ts`, `theme-boot.ts` before React for CSP-safe first paint); reload of the last-focused flow/run tab after saves when enforcement is on (skipped while Paused). |
| [`vite.popup.config.ts`](./vite.popup.config.ts)                                                                                        | Vite config for the popup bundle (`base: './'`, `popup-assets/` for hashed JS/CSS).                                                                                                                                                                                                                        |
| [`scripts/prebuild-copy-public.mjs`](./scripts/prebuild-copy-public.mjs)                                                                | Clears `dist/` and copies `public/` before bundling.                                                                                                                                                                                                                                                       |
| [`scripts/verify-project-naming.mjs`](./scripts/verify-project-naming.mjs)                                                              | Pre-release guard: errors if superseded repo slugs, old npm package name, or old store display title reappear in scanned files (see the `forbidden` list in the script).                                                                                                                                   |
| [`tests/*.test.ts`](./tests/)                                                                                                           | Vitest unit suites (see **Unit tests** above).                                                                                                                                                                                                                                                             |

## Browser compatibility

- Manifest V3 extension intended for Chromium-based browsers (Chrome, Edge, Brave, Arc, Opera, etc.).
- Requires: `declarativeNetRequest` (static rulesets with query transforms), `webNavigation`, `storage`, and `host_permissions` for Power Automate hosts. The manifest does **not** list the `tabs` permission; `chrome.tabs.query` / `chrome.tabs.reload` / `chrome.tabs.update` are used where Chromium allows it for permitted origins (see [tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs)). Content scripts rely on the History API and `MutationObserver`.

## Store listing vs manifest

What **comes from the manifest** (Chrome/Edge extension details):

| Field          | Role                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| `name`         | Title in the browser’s extension management UI.                                                              |
| `version`      | Version string shown in extension details.                                                                   |
| `description`  | Short summary (often used as the default listing description unless you override it in the store dashboard). |
| `homepage_url` | Optional link shown as the extension’s homepage / support site (here: Helvety).                              |
| `icons`        | Maps size keys to PNG paths under `icons/` in the built package.                                             |

What **does not** live in the manifest (you set these in each store’s developer dashboard):

- **Publisher / developer display name**: tied to your store account.
- **Screenshots, promotional images, detailed description**: uploaded in the store.
- **Privacy policy URL**: set in the store listing (recommended: `https://helvety.com/privacy`).

## Implementation notes

- **Service worker listeners** (`webNavigation`, `tabs.onRemoved`, `storage.onChanged`, `runtime.onInstalled`) are registered at the **top level** of `background.ts`, per Google’s MV3 guidance (avoid registering listeners only inside async callbacks).
- **`reconcileFromStorage()`** runs once at service worker startup (top-level `void reconcileFromStorage()` in `background.ts`) and again after `chrome.storage.onChanged` (when `enforcedV3` or `v3surveyEnabled` changes in sync) and after `chrome.runtime.onInstalled` (both **install** and **update** paths end by awaiting it). Together with manifest defaults, that restores the correct DNR ruleset state after an extension update even when the browser resets static ruleset enablement.
- **Executable code** is fully bundled in the package (no remotely hosted extension logic), consistent with MV3 security expectations.
- JSON does not allow `//` comments in `manifest.json`; details live in this README.

## Known limitations

- URL enforcement applies only when pathname contains `/flows/` or `/runs/`, and not while the extension is **paused**.
- **`v3survey` (Survey tab, while enforcing):** **Hide** (default) sets `v3survey=false` on rewrites (adds if missing). **Show** normalizes any existing `v3survey` keys to a single `true` only; it does not add `v3survey` when missing. Nothing runs while **Paused**.
- If Power Automate changes hostnames or route structures, matching rules may need updates.

## Lightweight regression checks

```bash
npm run format:check
npm run lint
npm run test
npm run typecheck
npm run build
```

For a release-style gate (naming scan + the above), use **`npm run predeploy`**.

## Validation checklist

After `npm run build`, load **`dist`** unpacked and verify:

- **Classic designer:** links that would open the new designer should open classic instead; links with no editor hint should gain classic. **`v3survey`:** with **Hide** (default), rewrites include **`v3survey=false`**; with **Show**, an existing `v3survey` on the URL becomes **`true`** (never added when absent).
- **New designer:** the same idea with roles flipped: links should land in the new designer, and **`v3survey`** behavior matches **Hide** / **Show** above.
- **Paused:** no link changes; both DNR rulesets off; the in-page watcher is idle.
- **Popup:** switching Classic Designer / New Designer saves right away and may refresh the flow or run tab you had focused. Changing **Survey** (`v3survey`) options saves immediately; the active flow/run tab may reload only when an editor mode is active (not while Paused). **About → Appearance** saves to this device only (`chrome.storage.local`). Background and content still react when `enforcedV3` or `v3surveyEnabled` changes in sync storage.
- After packaging an update, confirm DNR ruleset enablement still matches the saved preference (service worker startup and `chrome.runtime.onInstalled` both call `reconcileFromStorage()`).
