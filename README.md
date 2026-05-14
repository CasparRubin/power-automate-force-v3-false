# Power Automate: editor preference

Chrome/Edge extension (Manifest V3) that **keeps flow and run links opening in the editor you choose** while the extension is active: classic (`v3=false`) or new designer (`v3=true`), even when Microsoft links omit or flip the flag. You can **pause** anytime (extension stays installed; no URL rewrites or DNR rules). Optional **`v3survey`** control lives in the popup section **Survey links (optional)**: default leaves it untouched; when enabled, adds `v3survey=true` when missing and collapses duplicate keys to a single `true` while enforcement is on.

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
- **Toolbar popup** (React + Tailwind + Radix): choose **Classic editor**, **New designer**, or **Paused**. Your choice is stored in `chrome.storage.sync` under `enforcedV3` as `"true"`, `"false"`, or `"off"` and applied in the service worker, content script, and DNR layer. If Chrome sync is off, `chrome.storage.sync` still works for that profile—it behaves like local storage ([Chrome `storage` docs](https://developer.chrome.com/docs/extensions/reference/api/storage)).
- While enforcing, adds or replaces the `v3` query parameter so it matches your selected boolean mode.
- Optional **survey flag** (**Survey links (optional)** in the popup): **Leave survey links alone (default)** never adds or rewrites `v3survey`. **Turn on survey flag** adds `v3survey=true` when missing and aligns existing values to `true`. Stored as `chrome.storage.sync` key `v3surveyEnabled` (`"true"` / `"false"`).
- When **survey is off** (default), any `v3survey` value already in a URL is left as-is; only the main `v3` editor flag is adjusted. When **survey is on**, we also add `v3survey=true` when it is missing and normalize duplicate keys to a single `true` value.
- Uses semantic URL dedupe to avoid rewrite loops on equivalent `/flows/new` URLs (for example `%20` vs `+` encoding differences).
- **Layered enforcement** (aligned with Chromium MV3 best practices):
  - **Layer 1:** `declarativeNetRequest` — two static rulesets (`dnr-classic-editor.json`, `dnr-new-designer.json`); when enforcing, **exactly one** is enabled via `updateEnabledRulesets`; when **paused**, **both** are disabled. After each **extension update**, the service worker reconciles enabled rulesets with storage (Chromium does not persist which static rulesets were enabled across extension updates; the manifest defaults apply until the service worker runs again—see [Declarative Net Request](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)).
  - **Layer 2:** Background `webNavigation` (`onCommitted`, `onHistoryStateUpdated`) rewrites navigations the declarative layer might miss when enforcement is active (same URL policy as the content script; no-op when paused).
  - **Layer 3:** Content script at `document_start` for SPA transitions (`history.pushState` / `replaceState`, `popstate`, short-lived polling + `MutationObserver`) when enforcement is active (polling/observer are not started while paused).

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
| `npm run build`         | Copy `public/` → `dist/`, bundle `background` + `content` with esbuild, build the React popup with Vite.                                                         |
| `npm run watch`         | **Popup only:** Vite watch rebuilds `dist/popup.html` and `dist/popup-assets/*`. After editing the service worker or content script, run a full `npm run build`. |
| `npm run test`          | Run **Vitest** unit tests under `tests/` (Node environment; no browser, no Playwright).                                                                          |
| `npm run typecheck`     | `tsc --noEmit` on the TypeScript project.                                                                                                                        |
| `npm run lint`          | ESLint on `src/`, `tests/`, `scripts/`, and config files.                                                                                                        |
| `npm run lint:fix`      | ESLint with `--fix`.                                                                                                                                             |
| `npm run format`        | Prettier `--write` on the repo (respects `.prettierignore`).                                                                                                     |
| `npm run format:check`  | Prettier `--check` (CI-style).                                                                                                                                   |
| `npm run verify:naming` | Fails if superseded repo slugs, old package name, or old store display title appear in scanned sources (see `scripts/verify-project-naming.mjs`).                |
| `npm run predeploy`     | `verify:naming` → `format:check` → `lint` → `typecheck` → `test` → `build` (run before releases).                                                                |

## Unit tests

Tests run **locally** with [Vitest](https://vitest.dev/) (already a devDependency). They use the **Node** environment. Most suites exercise **pure helpers** (`dnr-rulesets`, `navigation-guards`, `storage-sync`, and `constants` helpers). `PowerAutomateUrlPolicy` keeps configurable state in the module; tests call `configure({ preference, v3surveyEnabled })` in `beforeEach` so each case starts from a known mode. The popup reload helper is covered with a **stubbed `chrome.tabs`** API (no real browser).

| Suite                                                                                  | What it covers                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`tests/url-policy.test.ts`](./tests/url-policy.test.ts)                               | URL targeting, canonicalization, `v3` / `v3survey` behavior for enforced and **paused** modes, edge cases (hash, duplicates).                                                                              |
| [`tests/constants.test.ts`](./tests/constants.test.ts)                                 | `parseEnforcementPreference`, `needsDefaultEnforcedV3Seed`, storage key / default mode, DNR ruleset id strings, and a **manifest drift guard** (MV3 permissions, hosts, `manifest.json`, DNR JSON, icons). |
| [`tests/dnr-rulesets.test.ts`](./tests/dnr-rulesets.test.ts)                           | `buildUpdateRulesetOptions` — which static ruleset is enabled per **preference** (`true` / `false` / `off`).                                                                                               |
| [`tests/navigation-guards.test.ts`](./tests/navigation-guards.test.ts)                 | `isMainFrameTabNavigation` — main-frame vs subframe filtering.                                                                                                                                             |
| [`tests/storage-sync.test.ts`](./tests/storage-sync.test.ts)                           | `isEnforcerSyncChange` — background/content reload policy when `enforcedV3` or `v3surveyEnabled` changes in sync.                                                                                          |
| [`tests/reload-focused-target-tab.test.ts`](./tests/reload-focused-target-tab.test.ts) | Stubbed `chrome.tabs.query` / `reload` — last-focused window query, skip when paused or URL not a flow/run target; also used after survey saves when an editor mode is active.                             |

**Service worker and content** still call Chromium extension APIs at runtime; unit tests target **pure helpers**, **URL policy**, and **small chrome-stubbed flows** so we do not need Playwright or a headed browser for CI.

## Repository layout

| Path                                                                                                                                    | Purpose                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`public/manifest.json`](./public/manifest.json)                                                                                        | MV3 manifest copied into `dist/` on build.                                                                                                                                                                                                                       |
| [`public/dnr-classic-editor.json`](./public/dnr-classic-editor.json) / [`public/dnr-new-designer.json`](./public/dnr-new-designer.json) | Declarative Net Request static rulesets: when enforcing, **one** is enabled (classic → `v3=false`, new-designer → `v3=true`); when **paused**, **neither** is enabled.                                                                                           |
| [`public/icons/`](./public/icons/)                                                                                                      | PNG icons referenced by the manifest (kept outside Vite’s `popup-assets` output so the popup build does not overwrite them). The repo’s [`assets/`](./assets/) folder may contain extra artwork for store listings; it is **not** copied into `dist` by default. |
| [`src/constants.ts`](./src/constants.ts)                                                                                                | Storage keys (`SYNC_POLICY_KEYS`), ruleset ids, parsers (`parseEnforcementPreference`, `parseV3SurveyEnabled`), install seeds, defaults.                                                                                                                         |
| [`src/url-policy.ts`](./src/url-policy.ts)                                                                                              | Shared URL targeting and canonicalization (`PowerAutomateUrlPolicy.configure`, `canonicalizeToEnforced`, paused mode, optional `v3survey=true`, …).                                                                                                              |
| [`src/dnr-rulesets.ts`](./src/dnr-rulesets.ts)                                                                                          | Pure mapping from enforcement **preference** → DNR `updateEnabledRulesets` options.                                                                                                                                                                              |
| [`src/navigation-guards.ts`](./src/navigation-guards.ts)                                                                                | Pure main-frame navigation check used by the service worker.                                                                                                                                                                                                     |
| [`src/storage-sync.ts`](./src/storage-sync.ts)                                                                                          | `isEnforcerSyncChange` — true when sync `enforcedV3` or `v3surveyEnabled` appears in `chrome.storage.onChanged`.                                                                                                                                                 |
| [`src/background.ts`](./src/background.ts)                                                                                              | Service worker: DNR ruleset toggling, storage listeners, `webNavigation` enforcement (skipped when paused).                                                                                                                                                      |
| [`src/content.ts`](./src/content.ts)                                                                                                    | In-page SPA URL enforcement when not paused; assigns `globalThis.PowerAutomateUrlPolicy` for optional DevTools inspection (separate module instance from the service worker, same policy logic).                                                                 |
| [`src/popup/`](./src/popup/)                                                                                                            | React popup: plain-language choices (classic vs new designer, pause, optional survey links), optimistic saves, optional reload of the last-focused flow/run tab after saving an editor mode (not after pausing).                                                 |
| [`vite.popup.config.ts`](./vite.popup.config.ts)                                                                                        | Vite config for the popup bundle (`base: './'`, `popup-assets/` for hashed JS/CSS).                                                                                                                                                                              |
| [`scripts/prebuild-copy-public.mjs`](./scripts/prebuild-copy-public.mjs)                                                                | Clears `dist/` and copies `public/` before bundling.                                                                                                                                                                                                             |
| [`scripts/verify-project-naming.mjs`](./scripts/verify-project-naming.mjs)                                                              | Pre-release guard: errors if superseded repo slugs, old npm package name, or old store display title reappear in scanned files (see the `forbidden` list in the script).                                                                                         |
| [`tests/*.test.ts`](./tests/)                                                                                                           | Vitest unit suites (see **Unit tests** above).                                                                                                                                                                                                                   |

## Browser compatibility

- Manifest V3 extension intended for Chromium-based browsers (Chrome, Edge, Brave, Arc, Opera, etc.).
- Requires: `declarativeNetRequest` (query transforms), `webNavigation`, `storage`, `host_permissions` for Power Automate hosts (popup tab reload uses `chrome.tabs` on those URLs), History API, and `MutationObserver` in content scripts.

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

- **Publisher / developer display name** — tied to your store account.
- **Screenshots, promotional images, detailed description** — uploaded in the store.
- **Privacy policy URL** — set in the store listing (recommended: `https://helvety.com/privacy`).

## Implementation notes

- **Service worker listeners** (`webNavigation`, `tabs.onRemoved`, `storage.onChanged`, `runtime.onInstalled`) are registered at the **top level** of `background.ts`, per Google’s MV3 guidance (avoid registering listeners only inside async callbacks).
- **`reconcileFromStorage()`** runs once at service worker startup (top-level `void reconcileFromStorage()` in `background.ts`) and again after `chrome.storage.onChanged` (when `enforcedV3` or `v3surveyEnabled` changes in sync) and after `chrome.runtime.onInstalled` (both **install** and **update** paths end by awaiting it). Together with manifest defaults, that restores the correct DNR ruleset state after an extension update even when the browser resets static ruleset enablement.
- **Executable code** is fully bundled in the package (no remotely hosted extension logic), consistent with MV3 security expectations.
- JSON does not allow `//` comments in `manifest.json`; details live in this README.

## Known limitations

- URL enforcement applies only when pathname contains `/flows/` or `/runs/`, and not while the extension is **paused**.
- **Survey links:** default leaves URLs alone. Optional **on** adds `v3survey=true` when missing; see the popup section **Survey links (optional)**.
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

- **Classic editor:** links that would open the new designer should open classic instead; links with no editor hint should gain classic. With **survey links off**, any survey-related part of the URL stays as you pasted it; with **survey links on**, expect the survey flag to be turned on when missing.
- **New designer:** the same idea with roles flipped—links should land in the new designer, and survey behavior matches the bullets above.
- **Paused:** no link changes; both DNR rulesets off; the in-page watcher is idle.
- **Popup:** switching Classic / New designer saves right away and may refresh the flow or run tab you had focused. Changing **Survey links** does the same when an editor mode is active (not while Paused). Background and content still react when `enforcedV3` or `v3surveyEnabled` changes in sync storage.
- After packaging an update, confirm DNR ruleset enablement still matches the saved preference (service worker startup and `chrome.runtime.onInstalled` both call `reconcileFromStorage()`).
