# Power Automate version enforcer

Chrome/Edge extension (Manifest V3) that **enforces the Power Automate designer query mode you choose**: keep URLs on `v3=false` (classic editor) or `v3=true` (new designer), including when Microsoft links omit or flip the flag. When `v3survey` is already present on a target URL, it is normalized to the **same** boolean as your selected mode.

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
- Only changes URLs whose path contains `/flows/` or `/runs/`.
- **Toolbar popup** (React + Tailwind + Radix): pick **Classic editor (`v3=false`)** or **New designer (`v3=true`)**. The choice is stored under `chrome.storage.sync` key `enforcedV3` and applied everywhere below. If the user has turned off Chrome sync, `chrome.storage.sync` still works; it behaves like local storage for that profile ([Chrome `storage` docs](https://developer.chrome.com/docs/extensions/reference/api/storage)).
- Adds or replaces the `v3` query parameter so it always matches your selection.
- If a target URL already includes `v3survey` (any casing), its value is normalized to the same enforced boolean; `v3survey` is **not** invented when absent.
- Uses semantic URL dedupe to avoid rewrite loops on equivalent `/flows/new` URLs (for example `%20` vs `+` encoding differences).
- **Layered enforcement** (aligned with Chromium MV3 best practices):
  - **Layer 1:** `declarativeNetRequest` — two static rulesets (`rules-v3-false.json`, `rules-v3-true.json`); exactly one is enabled at a time via `updateEnabledRulesets`. After each **extension update**, the service worker reconciles enabled rulesets with storage (Chromium does not persist which static rulesets were enabled across extension updates; the manifest defaults apply until the service worker runs again—see [Declarative Net Request](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest)).
  - **Layer 2:** Background `webNavigation` (`onCommitted`, `onHistoryStateUpdated`) rewrites navigations the declarative layer might miss, using the same URL policy as the content script.
  - **Layer 3:** Content script at `document_start` for SPA transitions (`history.pushState` / `replaceState`, `popstate`, short-lived polling + `MutationObserver`).

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
| `npm run verify:naming` | Fails if legacy repo/package/display names appear in tracked-style sources (see `scripts/verify-project-naming.mjs`).                                            |
| `npm run predeploy`     | `verify:naming` → `format:check` → `lint` → `typecheck` → `test` → `build` (run before releases).                                                                |

## Unit tests

Tests run **locally** with [Vitest](https://vitest.dev/) (already a devDependency). They use the **Node** environment. Small helpers (`dnr-rulesets`, `navigation-guards`, `storage-sync`, `constants`) are **pure functions**. `PowerAutomateUrlPolicy` keeps configurable state in the module; tests call `configure()` in `beforeEach` so each case starts from a known mode.

| Suite                                                                  | What it covers                                                                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [`tests/url-policy.test.ts`](./tests/url-policy.test.ts)               | URL targeting, canonicalization, `v3` / `v3survey` behavior for both enforced modes, edge cases (hash, duplicates). |
| [`tests/constants.test.ts`](./tests/constants.test.ts)                 | `parseEnforcedV3`, `needsDefaultEnforcedV3Seed`, stable ids and storage key contract.                               |
| [`tests/dnr-rulesets.test.ts`](./tests/dnr-rulesets.test.ts)           | `buildUpdateRulesetOptions` — which static ruleset is enabled per mode.                                             |
| [`tests/navigation-guards.test.ts`](./tests/navigation-guards.test.ts) | `isMainFrameTabNavigation` — main-frame vs subframe filtering.                                                      |
| [`tests/storage-sync.test.ts`](./tests/storage-sync.test.ts)           | `isEnforcedV3SyncChange` — background/content agree on when to react to storage events.                             |

**Service worker and content** still call Chromium extension APIs at runtime; unit tests target the **pure helpers** and **URL policy** only, so we do not need browser automation or mocked `chrome.*` for those suites. This repository does not define GitHub Actions—run `npm run test` locally before releases or after refactors.

## Repository layout

| Path                                                                                                                      | Purpose                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`public/manifest.json`](./public/manifest.json)                                                                          | MV3 manifest copied into `dist/` on build.                                                                                                                                                                                                                       |
| [`public/rules-v3-false.json`](./public/rules-v3-false.json) / [`public/rules-v3-true.json`](./public/rules-v3-true.json) | Declarative Net Request static rulesets (only one enabled at runtime).                                                                                                                                                                                           |
| [`public/icons/`](./public/icons/)                                                                                        | PNG icons referenced by the manifest (kept outside Vite’s `popup-assets` output so the popup build does not overwrite them). The repo’s [`assets/`](./assets/) folder may contain extra artwork for store listings; it is **not** copied into `dist` by default. |
| [`src/constants.ts`](./src/constants.ts)                                                                                  | Storage key, ruleset ids, `parseEnforcedV3`, `needsDefaultEnforcedV3Seed`, defaults.                                                                                                                                                                             |
| [`src/url-policy.ts`](./src/url-policy.ts)                                                                                | Shared URL targeting and canonicalization (`PowerAutomateUrlPolicy.configure`, `canonicalizeToEnforced`, …).                                                                                                                                                     |
| [`src/dnr-rulesets.ts`](./src/dnr-rulesets.ts)                                                                            | Pure mapping from enforced mode → DNR `updateEnabledRulesets` options.                                                                                                                                                                                           |
| [`src/navigation-guards.ts`](./src/navigation-guards.ts)                                                                  | Pure main-frame navigation check used by the service worker.                                                                                                                                                                                                     |
| [`src/storage-sync.ts`](./src/storage-sync.ts)                                                                            | Pure helper for `chrome.storage.onChanged` filtering (sync + `enforcedV3` key).                                                                                                                                                                                  |
| [`src/background.ts`](./src/background.ts)                                                                                | Service worker: DNR ruleset toggling, storage listeners, `webNavigation` enforcement.                                                                                                                                                                            |
| [`src/content.ts`](./src/content.ts)                                                                                      | In-page SPA URL enforcement; assigns `globalThis.PowerAutomateUrlPolicy` so the policy object is easy to inspect in DevTools (optional; not required for enforcement).                                                                                           |
| [`src/popup/`](./src/popup/)                                                                                              | React popup UI.                                                                                                                                                                                                                                                  |
| [`vite.popup.config.ts`](./vite.popup.config.ts)                                                                          | Vite config for the popup bundle (`base: './'`, `popup-assets/` for hashed JS/CSS).                                                                                                                                                                              |
| [`scripts/prebuild-copy-public.mjs`](./scripts/prebuild-copy-public.mjs)                                                  | Clears `dist/` and copies `public/` before bundling.                                                                                                                                                                                                             |
| [`scripts/verify-project-naming.mjs`](./scripts/verify-project-naming.mjs)                                                | Pre-release guard: errors if legacy project / package / display strings reappear in the tree.                                                                                                                                                                    |
| [`tests/*.test.ts`](./tests/)                                                                                             | Vitest unit suites (see **Unit tests** above).                                                                                                                                                                                                                   |

## Browser compatibility

- Manifest V3 extension intended for Chromium-based browsers (Chrome, Edge, Brave, Arc, Opera, etc.).
- Requires: `declarativeNetRequest` (query transforms), `webNavigation`, `storage`, History API, and `MutationObserver` in content scripts.

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

- **Service worker listeners** (`webNavigation`, `tabs.onRemoved`, `storage.onChanged`) are registered at the **top level** of `background.ts`, per Google’s MV3 guidance (avoid registering listeners only inside async callbacks).
- **Executable code** is fully bundled in the package (no remotely hosted extension logic), consistent with MV3 security expectations.
- JSON does not allow `//` comments in `manifest.json`; details live in this README.

## Known limitations

- URL enforcement applies only when pathname contains `/flows/` or `/runs/`.
- `v3survey` is normalized only when it already exists in the URL.
- If Power Automate changes hostnames or route structures, matching rules may need updates.

## Lightweight regression checks

```bash
npm run test
npm run typecheck
npm run build
```

## Validation checklist

After `npm run build`, load **`dist`** unpacked and verify:

- **Mode `v3=false`:** direct open with `v3=true` → becomes `v3=false`; without `v3` → gains `v3=false`; `v3survey` present and not false → becomes `false`.
- **Mode `v3=true`:** same scenarios with inverted expectations for `v3` / `v3survey`.
- Popup: switching mode updates open Power Automate tabs after navigation or SPA URL changes (content script listens to `chrome.storage.onChanged`).
- After packaging an update, confirm ruleset still matches the saved mode (background `onInstalled` + `update` path).
